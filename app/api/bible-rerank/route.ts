import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Pinecone } from '@pinecone-database/pinecone';
import { createEmbedding } from '@/lib/openai';

// Demo endpoint: cosine top-20 over the verse namespace, rerank, return both
// orderings so the UI can show them side by side.

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const INDEX = process.env.PINECONE_INDEX || 'medical-notes';
const NAMESPACE = 'bible-verses';

const BodySchema = z.object({ query: z.string().min(1) });

function shortBook(book: string): string {
	const called = book.match(/Called (.+)$/);
	if (called) return called[1].trim();
	const num = /First/.test(book) ? '1 ' : /Second/.test(book) ? '2 ' : /Third/.test(book) ? '3 ' : '';
	const m =
		book.match(/to the (.+)$/) ||
		book.match(/According to (?:St\.? )?(.+)$/) ||
		book.match(/of (?:St\.? )?([A-Za-z]+)$/);
	if (m) return (num + m[1]).trim();
	return book.replace(/^The /, '').trim();
}

export async function POST(request: Request) {
	try {
		const { query } = BodySchema.parse(await request.json());

		const emb = await createEmbedding(query);
		const res = await pc
			.Index(INDEX)
			.namespace(NAMESPACE)
			.query({ vector: emb, topK: 20, includeMetadata: true });
		const matches = res.matches ?? [];

		const shape = (i: number, score: number) => {
			const m = matches[i];
			const meta = m.metadata ?? {};
			return {
				score,
				cosineRank: i + 1,
				reference: `${shortBook(String(meta.book))} ${meta.chapter}:${meta.verse}`,
				text: String(meta.content ?? ''),
			};
		};

		const cosine = matches.map((m, i) => shape(i, m.score ?? 0));

		const rr = await pc.inference.rerank(
			'bge-reranker-v2-m3',
			query,
			matches.map((m) => String(m.metadata?.content ?? '')),
			{ topN: matches.length, returnDocuments: false },
		);
		const reranked = rr.data.map((d) => shape(d.index, d.score));

		return NextResponse.json({ query, cosine, reranked });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		console.error('bible-rerank error:', error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 },
		);
	}
}
