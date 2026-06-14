/**
 * Naive fixed-size chunking: slice the raw text into windows of N characters.
 *
 * This is deliberately the WRONG way to chunk a structured document —
 * it ignores verse and book boundaries entirely. Run it, then read what
 * it produces. The damage is the lesson.
 *
 * Usage:
 *   npm run bible:fixed                 # 500-char chunks, no overlap
 *   npm run bible:fixed -- --size 800 --overlap 100
 */

import * as fs from 'fs';
import { extractBody } from './parse';

type Chunk = {
  id: number;
  text: string;
};

function args(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return parseInt(process.argv[i + 1], 10);
}

const SIZE = args('--size', 500);
const OVERLAP = args('--overlap', 0);

function main() {
  const raw = fs.readFileSync('data/bible/kjv.txt', 'utf-8');
  // Collapse the wrapped lines into one long string — naive chunking
  // doesn't even look at paragraph structure
  const text = extractBody(raw).replace(/\s+/g, ' ').trim();

  const chunks: Chunk[] = [];
  const step = SIZE - OVERLAP;
  for (let start = 0, id = 0; start < text.length; start += step, id++) {
    chunks.push({ id, text: text.slice(start, start + SIZE) });
  }

  fs.writeFileSync(
    'data/bible/chunks-fixed.jsonl',
    chunks.map((c) => JSON.stringify(c)).join('\n')
  );

  console.log(`Corpus: ${text.length.toLocaleString()} characters`);
  console.log(`Chunks: ${chunks.length.toLocaleString()} (size=${SIZE}, overlap=${OVERLAP})`);
  console.log(`Wrote data/bible/chunks-fixed.jsonl\n`);

  // Show a few chunks so the boundary damage is visible immediately
  for (const i of [0, 1000, 5000]) {
    if (!chunks[i]) continue;
    console.log(`--- chunk ${i} ---`);
    console.log(chunks[i].text.slice(0, 200) + (chunks[i].text.length > 200 ? '…' : ''));
    console.log();
  }
}

main();
