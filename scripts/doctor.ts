/**
 * Check every moving part and tell you exactly which one is broken.
 *
 *   npm run doctor
 *
 * Run this before class. Cohort 3 lost most of its first session to setup —
 * a misspelled env var, a stale Node, an index name that didn't match, a key
 * that was never picked up because `.env` was in the wrong folder. Every one of
 * those is a line in this report now.
 *
 * It only reads. It never writes to your database or your index.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type Status = 'ok' | 'warn' | 'fail';
type Check = { name: string; status: Status; detail: string; fix?: string };

const results: Check[] = [];
const record = (c: Check) => {
	results.push(c);
	const mark = c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '✗';
	console.log(`  ${mark}  ${c.name.padEnd(26)} ${c.detail}`);
};

/** Run a check, turning any thrown error into a failure line. */
async function check(
	name: string,
	fix: string,
	fn: () => Promise<Omit<Check, 'name' | 'fix'>>,
) {
	try {
		record({ name, fix, ...(await fn()) });
	} catch (err) {
		const raw = err instanceof Error ? err.message : String(err);
		// Prisma's errors start with a blank line; take the first line that
		// actually says something, or we print a check with no explanation.
		const detail =
			raw.split('\n').map((l) => l.trim()).find(Boolean) ?? 'failed';
		record({ name, fix, status: 'fail', detail });
	}
}

async function main() {
	console.log('\nmedical-rag doctor\n');

	await check('node', 'Install Node 20 or newer (nvm install 20).', async () => {
		const major = Number(process.versions.node.split('.')[0]);
		return major >= 20
			? { status: 'ok', detail: `v${process.versions.node}` }
			: { status: 'fail', detail: `v${process.versions.node} — need 20+` };
	});

	await check(
		'.env',
		'Copy .env.example to .env at the project root and fill it in.',
		async () => {
			const required = ['DATABASE_URL', 'OPENAI_API_KEY', 'PINECONE_API_KEY'];
			const missing = required.filter((k) => !process.env[k]);
			return missing.length
				? { status: 'fail', detail: `missing ${missing.join(', ')}` }
				: { status: 'ok', detail: 'all required keys present' };
		},
	);

	// --- Postgres: is it yours, does it have tables, does it have rows? -----
	const prisma = new PrismaClient();
	await check(
		'postgres',
		'Check DATABASE_URL, then run `npm run db:push && npm run db:seed`.',
		async () => {
			if (!process.env.DATABASE_URL) {
				return { status: 'fail', detail: 'DATABASE_URL is not set' };
			}
			const host =
				process.env.DATABASE_URL.match(/@([^/:]+)/)?.[1] ?? 'unknown host';
			const patients = await prisma.patient.count();
			const notes = await prisma.note.count();
			if (patients === 0) {
				return {
					status: 'fail',
					detail: `connected to ${host}, but it's empty — run \`npm run db:seed\``,
				};
			}
			return {
				status: 'ok',
				detail: `${patients} patients, ${notes} notes on ${host}`,
			};
		},
	);

	// --- OpenAI: the key AND the base URL. A wrong base URL is silent. ------
	await check(
		'openai',
		'Check OPENAI_API_KEY (and OPENAI_BASE_URL if your cohort uses the proxy).',
		async () => {
			if (!process.env.OPENAI_API_KEY) {
				return { status: 'fail', detail: 'OPENAI_API_KEY is not set' };
			}
			const { createEmbedding } = await import('../lib/openai');
			const vector = await createEmbedding('doctor smoke test');
			const via = process.env.OPENAI_BASE_URL ?? 'api.openai.com';
			return vector.length === 1536
				? { status: 'ok', detail: `embeddings working (1536 dims) via ${via}` }
				: {
						status: 'fail',
						detail: `got ${vector.length} dimensions, expected 1536`,
					};
		},
	);

	// --- Pinecone: key, and does the index in .env actually exist? ----------
	await check(
		'pinecone',
		'Create the index in the Pinecone console, or fix PINECONE_INDEX to match its real name.',
		async () => {
			if (!process.env.PINECONE_API_KEY) {
				return { status: 'fail', detail: 'PINECONE_API_KEY is not set' };
			}
			// Deliberately NOT importing lib/pinecone.ts: it pulls in lib/openai.ts,
			// which would report a missing OpenAI key as a Pinecone failure. A
			// doctor that blames the wrong service is worse than no doctor.
			const { Pinecone } = await import('@pinecone-database/pinecone');
			const pinecone = new Pinecone({
				apiKey: process.env.PINECONE_API_KEY,
			});
			const INDEX_NAME = process.env.PINECONE_INDEX || 'medical-notes';
			const list = await pinecone.listIndexes();
			const names = list.indexes?.map((i) => i.name) ?? [];
			if (!names.includes(INDEX_NAME)) {
				return {
					status: 'fail',
					detail:
						`no index named "${INDEX_NAME}". ` +
						(names.length
							? `Your indexes: ${names.join(', ')}`
							: 'You have no indexes yet.'),
				};
			}
			const stats = await pinecone.Index(INDEX_NAME).describeIndexStats();
			const count = stats.totalRecordCount ?? 0;
			if (count === 0) {
				return {
					status: 'warn',
					detail: `"${INDEX_NAME}" exists but is empty — run \`npm run vectorize\``,
				};
			}
			return { status: 'ok', detail: `"${INDEX_NAME}" holds ${count} vectors` };
		},
	);

	// --- Optional services: absent is fine, broken is worth knowing. --------
	await check('langsmith (optional)', 'Set LANGSMITH_TRACING=true and LANGSMITH_API_KEY to see traces.', async () => {
		const { isLangSmithEnabled } = await import('../lib/langsmith');
		return isLangSmithEnabled()
			? { status: 'ok', detail: `tracing to project "${process.env.LANGSMITH_PROJECT ?? 'medical-rag'}"` }
			: { status: 'warn', detail: 'not configured — you need this from week 2' };
	});

	await check('cal.com (optional)', 'Set CAL_API_KEY and CAL_EVENT_TYPE_ID before week 4.', async () => {
		const { isCalConfigured } = await import('../lib/calendar');
		return isCalConfigured()
			? { status: 'ok', detail: 'configured' }
			: { status: 'warn', detail: 'not configured — you need this from week 4' };
	});

	await prisma.$disconnect();

	// --- Verdict -----------------------------------------------------------
	const failures = results.filter((r) => r.status === 'fail');
	const warnings = results.filter((r) => r.status === 'warn');
	console.log('');

	if (!failures.length) {
		console.log(
			warnings.length
				? `Ready. ${warnings.length} optional thing(s) still to set up:\n` +
						warnings.map((w) => `  - ${w.name}: ${w.fix}`).join('\n')
				: 'Everything is green. You are ready for class.',
		);
		console.log('');
		return;
	}

	console.log(`${failures.length} thing(s) to fix, in this order:\n`);
	failures.forEach((f, i) => {
		console.log(`  ${i + 1}. ${f.name} — ${f.detail}`);
		console.log(`     ${f.fix}\n`);
	});
	console.log(
		'Still stuck after that? Paste this whole output into the class Slack.\n',
	);
	process.exit(1);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
