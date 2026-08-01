/**
 * Reranking demo — verse-chunked Bible, cosine vs reranked side by side.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bible/rerank-demo.ts ingest
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/bible/rerank-demo.ts query "who should I forgive?"
 *
 * Ingest: one chunk PER VERSE (metadata: book, chapter, verse, reference) into
 * its own index ("bible-verses") — ~31k vectors, ~$0.02, a few minutes, one time.
 * Query: fetch top-20 by cosine, rerank them, print both top-5s side by side
 * with movement markers. Tiny verse chunks are exactly where cosine gets fooled
 * by surface wording — which makes the reranker's corrections visible.
 */

import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbeddings, createEmbedding } from '../../lib/openai';
import { loadVerses } from './parse';

// Free tier caps serverless indexes at 5 — so the verses live in a NAMESPACE
// on the existing medical index instead. Same isolation for queries, no new index.
const INDEX = process.env.PINECONE_INDEX || 'medical-notes';
const NAMESPACE = 'bible-verses';
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const ns = () => pc.Index(INDEX).namespace(NAMESPACE);

async function retry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (err) {
			if (attempt >= tries) throw err;
			if (attempt > 1) console.log(`  (retry ${attempt}/${tries})`);
			await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 10000)));
		}
	}
}

async function ingest(from = 0) {
	const verses = loadVerses().filter((v) => v.text.length > 0);
	console.log(
		`Ingesting ${verses.length - from} verses into ${INDEX}/${NAMESPACE} (starting at ${from})…`,
	);
	const index = ns();
	const EMBED_BATCH = 500;
	const UPSERT_BATCH = 200;
	let done = from;
	const started = Date.now();

	for (let i = from; i < verses.length; i += EMBED_BATCH) {
		const batch = verses.slice(i, i + EMBED_BATCH);
		const embeddings = await retry(() =>
			createEmbeddings(batch.map((v) => v.text)),
		);
		const vectors = batch.map((v, j) => ({
			id: `${v.book}-${v.chapter}-${v.verse}`.replace(/[^a-zA-Z0-9-]/g, ''),
			values: embeddings[j],
			metadata: {
				book: v.book,
				chapter: v.chapter,
				verse: v.verse,
				reference: `${v.book} ${v.chapter}:${v.verse}`,
				content: v.text,
			},
		}));
		for (let k = 0; k < vectors.length; k += UPSERT_BATCH) {
			const slice = vectors.slice(k, k + UPSERT_BATCH);
			await retry(() => index.upsert(slice));
		}
		done += batch.length;
		const secs = Math.round((Date.now() - started) / 1000);
		console.log(`  ${done}/${verses.length} (${secs}s)`);
	}
	console.log('Done.');
}

function short(book: string): string {
	// "The First Book of Moses: Called Genesis" -> "Genesis"
	const called = book.match(/Called (.+)$/);
	if (called) return called[1].trim();
	// "The First Epistle of Paul the Apostle to the Corinthians" -> "1 Corinthians"
	const num = /First/.test(book) ? '1 ' : /Second/.test(book) ? '2 ' : /Third/.test(book) ? '3 ' : '';
	const toThe = book.match(/to the (.+)$/) || book.match(/According to (?:St\.? )?(.+)$/) || book.match(/of (?:St\.? )?([A-Za-z]+)$/);
	if (toThe) return (num + toThe[1]).trim();
	return book.replace(/^The /, '').trim();
}

async function query(q: string) {
	const index = ns();
	const emb = await createEmbedding(q);
	const res = await index.query({ vector: emb, topK: 20, includeMetadata: true });
	const matches = res.matches ?? [];
	const texts = matches.map((m) => String(m.metadata?.content ?? ''));

	const rr = await pc.inference.rerank('bge-reranker-v2-m3', q, texts, {
		topN: 5,
		returnDocuments: false,
	});

	const line = (ref: string, score: number, text: string, tag = '') =>
		`  ${score.toFixed(3)}  ${ref.padEnd(24)} ${text.slice(0, 68)}${text.length > 68 ? '…' : ''}${tag}`;

	console.log(`\nQUERY: "${q}"\n`);
	console.log('— COSINE top 5 (of 20 fetched) ————————————————');
	matches.slice(0, 5).forEach((m) => {
		const ref = `${short(String(m.metadata?.book))} ${m.metadata?.chapter}:${m.metadata?.verse}`;
		console.log(line(ref, m.score ?? 0, String(m.metadata?.content)));
	});

	console.log('\n— RERANKED top 5 (same 20 candidates) —————————');
	rr.data.forEach((d) => {
		const m = matches[d.index];
		const ref = `${short(String(m.metadata?.book))} ${m.metadata?.chapter}:${m.metadata?.verse}`;
		const moved = d.index >= 5 ? `   ⬆ was cosine #${d.index + 1}` : `   (was #${d.index + 1})`;
		console.log(line(ref, d.score, String(m.metadata?.content), moved));
	});
	console.log();
}

const [cmd, ...rest] = process.argv.slice(2);
(cmd === 'ingest'
	? ingest(parseInt(rest[0] ?? '0', 10) || 0)
	: query(rest.join(' ') || 'who should I forgive?')
).catch(
	(e) => {
		console.error(e);
		process.exit(1);
	},
);
