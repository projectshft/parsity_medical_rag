/**
 * Setup doctor — run this FIRST, and any time something stops working.
 *
 *   npm run doctor
 *   node scripts/doctor.mjs     # works even if `npm install` won't run yet
 *
 * Deliberately plain .mjs with no third-party dependencies — only dynamic
 * `node:` builtins, which have worked for many major versions. It has to be able
 * to run on a Node version this project does NOT support, because telling you
 * "your Node is too old" is its main job, and a checker that needs the right
 * Node in order to say your Node is wrong is useless. Same reason it isn't
 * TypeScript: `npx ts-node` is one of the things that breaks on a bad version.
 *
 * Nothing here talks to the network or needs a key to be valid. It checks that
 * your machine and your .env are shaped right. `npm run verify` (and
 * infra/litellm/verify-proxy.sh, for instructors) checks that the keys work.
 */

// --- the Node requirement, derived from what the dependencies actually demand
// vitest: ^22.12.0 || ^24.0.0 || >=26.0.0   <- the strictest, and it rules out 20
// prisma: ^20.19 || ^22.12 || >=24.0
// qdrant / pinecone / ai-sdk / langchain: >=22
// So: 22.12+, or 24.x, or 26+. NOT 20, NOT 22.0-22.11, NOT 23, NOT 25.
const NODE_OK = (maj, min) =>
	(maj === 22 && min >= 12) || maj === 24 || maj >= 26;
const NODE_WANTED = '22.12+ (or 24.x, or 26+) — 22 LTS is what we test on';

const [major, minor] = process.versions.node.split('.').map(Number);

let failures = 0;
const pass = (m) => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const fail = (m, fix) => {
	console.log(`  \x1b[31mFIX\x1b[0m   ${m}`);
	if (fix) for (const line of fix.split('\n')) console.log(`        ${line}`);
	failures++;
};
const warn = (m) => console.log(`  \x1b[33mNOTE\x1b[0m  ${m}`);

console.log('\nChecking your setup\n');

// ---------------------------------------------------------------- 1. Node
if (NODE_OK(major, minor)) {
	pass(`Node ${process.versions.node}`);
} else {
	const platform = process.platform;
	const nvm =
		platform === 'win32'
			? [
					'Windows — install nvm-windows:',
					'  https://github.com/coreybutler/nvm-windows/releases  (nvm-setup.exe)',
					'then, in a NEW terminal:',
					'  nvm install 22.12.0',
					'  nvm use 22.12.0',
				].join('\n')
			: [
					'Install nvm, then Node 22:',
					'  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash',
					'  # close and reopen your terminal, then:',
					'  nvm install 22',
					'  nvm use 22',
					'',
					'This repo has a .nvmrc, so inside the project folder you can just run:',
					'  nvm use',
				].join('\n');

	fail(
		`Node ${process.versions.node} is too old. This project needs ${NODE_WANTED}.`,
		nvm +
			'\n\nThen delete node_modules and reinstall, because packages compiled\n' +
			'against the old version will stay broken otherwise:\n' +
			'  rm -rf node_modules package-lock.json && npm install',
	);
	// Everything below still runs — knowing about your .env now saves a round trip.
}

if (major === 23 || major === 25) {
	warn(
		`Node ${major} is an odd-numbered release. Several of our dependencies ` +
			'skip those entirely, so use 22 or 24 even though this check passed.',
	);
}

// ------------------------------------------------------------------ 2. .env
// Read it by hand: dotenv may not be installed yet, and this file imports nothing.
let env = {};

// Minimal .env parser — dotenv may not be installed yet.
const readEnvFile = async () => {
	try {
		const { readFileSync } = await import('node:fs');
		const raw = readFileSync('.env', 'utf8');
		const out = {};
		for (const line of raw.split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const i = t.indexOf('=');
			if (i === -1) continue;
			// Strip an inline comment BEFORE trimming. `.env.example` uses them
			// to annotate blank values (`KEY=   # same as above`), and without
			// this the COMMENT becomes the value: the key reads as set and the
			// app ends up sending a sentence as an API key. Trimming first hides
			// the leading whitespace and makes the comment look like a value, so
			// the order here matters. A '#' inside a real password or URL
			// survives, because it is not preceded by whitespace or line-start.
			let v = t.slice(i + 1);
			if (!/^\s*["']/.test(v)) {
				const m = v.match(/(?:^|\s)#/);
				if (m) v = v.slice(0, m.index);
			}
			v = v.trim().replace(/^["']|["']$/g, '');
			out[t.slice(0, i).trim()] = v;
		}
		return out;
	} catch {
		return null;
	}
};

const REQUIRED = [
	['DATABASE_URL', 'the pre-loaded patient database — emailed to you'],
	['OPENAI_API_KEY', 'ours, via the proxy — emailed to you'],
	['OPENAI_BASE_URL', 'the proxy URL — emailed to you'],
	['PINECONE_API_KEY', 'yours: https://pinecone.io (free tier)'],
	['QDRANT_URL', 'yours: https://cloud.qdrant.io (free, no card) — weeks 1-2'],
	['TYPESAFE_API_KEY', 'the SAME value as OPENAI_API_KEY (not a typo) — week 5'],
	['TYPESAFE_BASE_URL', 'the same proxy URL as OPENAI_BASE_URL — week 5'],
];
const PLACEHOLDERS = [
	'sk-...',
	'your-pinecone-api-key',
	'...',
	'changeme',
	'xxx',
];
/** Substrings that only ever appear in `.env.example`'s illustrative values. */
const EXAMPLE_MARKERS = [
	'xxxxxxxx',
	'ep-xxx',
	':password@',
	'user:pw@',
	'example.com',
	'cal_live_...',
];

const main = async () => {
	env = await readEnvFile();

	console.log('');
	if (env === null) {
		fail(
			'No .env file.',
			'cp .env.example .env     then fill in the values it describes',
		);
	} else {
		let missing = 0;
		for (const [key, where] of REQUIRED) {
			const v = env[key];
			if (!v) {
				fail(`${key} is not set`, where);
				missing++;
			} else if (
				PLACEHOLDERS.some((p) => v === p) ||
				EXAMPLE_MARKERS.some((m) => v.includes(m)) ||
				v.startsWith('your-')
			) {
				fail(`${key} is still the .env.example placeholder`, where);
				missing++;
			}
		}
		if (missing === 0) pass(`.env has all ${REQUIRED.length} required values`);

		// The one that confuses everybody, every cohort.
		if (
			env.OPENAI_API_KEY &&
			env.TYPESAFE_API_KEY &&
			env.OPENAI_API_KEY !== env.TYPESAFE_API_KEY
		) {
			warn(
				'TYPESAFE_API_KEY differs from OPENAI_API_KEY. That is usually wrong: ' +
					'the Jev judge rides the same proxy, so it is the same key twice. ' +
					'Only differ if you brought your own TypeSafe account.',
			);
		}
	}

	// -------------------------------------------------------- 3. dependencies
	console.log('');
	try {
		const { existsSync } = await import('node:fs');
		if (!existsSync('node_modules')) {
			fail('Dependencies are not installed.', 'npm install');
		} else {
			pass('node_modules exists');
			if (!existsSync('node_modules/.prisma/client')) {
				fail(
					'The Prisma client has not been generated — every database call will fail at import.',
					'npm run db:generate',
				);
			} else {
				pass('Prisma client generated');
			}
		}
	} catch {}

	// ------------------------------------------------------------- summary
	console.log('');
	if (failures === 0) {
		console.log(
			'\x1b[32mYou are set up.\x1b[0m Next: npm run dev, then open http://localhost:3000\n',
		);
	} else {
		console.log(
			`\x1b[31m${failures} thing${failures === 1 ? '' : 's'} to fix.\x1b[0m ` +
				'Work top to bottom — the Node version first if it is listed,\n' +
				'because fixing it changes what the others do.\n',
		);
		console.log('Still stuck after that? Post in Slack with this output.\n');
	}
	process.exit(failures === 0 ? 0 : 1);
};

main();
