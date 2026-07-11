/**
 * Chunk auditor: structural quality metrics for a chunks .jsonl file.
 * No search engine needed — these are properties you can measure the
 * moment chunks exist, and they predict retrieval pain later.
 *
 * Usage:
 *   npm run bible:audit -- data/bible/chunks-fixed.jsonl
 *   npm run bible:audit -- data/bible/chunks-smart.jsonl
 */

import * as fs from 'fs';

type AnyChunk = {
  id: number;
  text: string;
  metadata?: Record<string, unknown>;
};

function pct(n: number, total: number): string {
  return ((100 * n) / total).toFixed(1) + '%';
}

function main() {
  const path = process.argv[2];
  if (!path || !fs.existsSync(path)) {
    console.error('Usage: npm run bible:audit -- <chunks.jsonl>');
    process.exit(1);
  }

  const chunks: AnyChunk[] = fs
    .readFileSync(path, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const total = chunks.length;
  const sizes = chunks.map((c) => c.text.length).sort((a, b) => a - b);

  // 1. Mid-sentence end: chunk text stops without sentence-ending punctuation
  const midSentenceEnd = chunks.filter((c) => !/[.!?:;'"”)\]]$/.test(c.text.trim())).length;

  // 2. Mid-word start: chunk begins lowercase or mid-token (orphaned fragment)
  const midWordStart = chunks.filter((c) => /^[a-z]/.test(c.text.trim())).length;

  // 3. Size outliers: too small to stand alone, or far past target
  const tooSmall = sizes.filter((s) => s < 100).length;

  // 4. Metadata coverage: can this chunk be cited and filtered?
  const withMetadata = chunks.filter(
    (c) => c.metadata && Object.keys(c.metadata).length > 0
  ).length;

  const median = sizes[Math.floor(total / 2)];

  console.log(`Audit: ${path}`);
  console.log(`  chunks:               ${total.toLocaleString()}`);
  console.log(`  size min/median/max:  ${sizes[0]} / ${median} / ${sizes[total - 1]} chars`);
  console.log(`  starts mid-word:      ${midWordStart.toLocaleString()} (${pct(midWordStart, total)})`);
  console.log(`  ends mid-sentence:    ${midSentenceEnd.toLocaleString()} (${pct(midSentenceEnd, total)})`);
  console.log(`  under 100 chars:      ${tooSmall.toLocaleString()} (${pct(tooSmall, total)})`);
  console.log(`  has metadata:         ${withMetadata.toLocaleString()} (${pct(withMetadata, total)})`);
}

main();
