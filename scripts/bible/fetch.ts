/**
 * Fetch the King James Bible plain text from Project Gutenberg into
 * data/bible/kjv.txt — the corpus for the chunking homework.
 *
 *   npm run bible:fetch
 *
 * data/bible/ is gitignored (neither the source text nor your generated chunk
 * files get committed), so run this once before bible:fixed / bible:smart /
 * bible:audit. Re-running is a no-op if the file is already there.
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_URL = 'https://www.gutenberg.org/cache/epub/10/pg10.txt';
const OUT = path.join('data', 'bible', 'kjv.txt');

async function main() {
  if (fs.existsSync(OUT)) {
    const mb = (fs.statSync(OUT).size / 1e6).toFixed(1);
    console.log(`Already have ${OUT} (${mb} MB). Delete it to re-download.`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  console.log(`Downloading KJV from ${SOURCE_URL} ...`);

  const res = await fetch(SOURCE_URL);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  fs.writeFileSync(OUT, text);

  const mb = (text.length / 1e6).toFixed(1);
  console.log(`Wrote ${OUT} (${mb} MB, ${text.split('\n').length.toLocaleString()} lines).`);
  console.log(`Next: npm run bible:fixed  and  npm run bible:smart`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
