/**
 * Vector similarity — a tiny hands-on exercise.
 *
 *   npm run similarity
 *
 * Embeds a query and a few candidate phrases, then ranks the candidates by
 * COSINE SIMILARITY (the dot product of the vectors over their lengths). The
 * point to feel: the top match shares *meaning* with the query, not words —
 * "dyspnea on exertion" beats everything for "short of breath" despite having
 * zero words in common. That's the whole idea behind the vector store.
 *
 * Change the query / candidates below and re-run to build the intuition.
 * Needs OPENAI_API_KEY.
 */

import 'dotenv/config';
import { createEmbeddings } from '../lib/openai';

/** cosine(a, b) = (a · b) / (|a| × |b|) — 1.0 = same direction, 0 = unrelated */
function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function main() {
  const query = 'patient is short of breath';
  const candidates = [
    'dyspnea on exertion',
    'winded climbing the stairs',
    'complains of a persistent cough',
    'well-controlled type 2 diabetes',
    'fractured left ankle',
  ];

  // One API call embeds them all: [query, ...candidates]
  const [queryVec, ...candidateVecs] = await createEmbeddings([query, ...candidates]);

  console.log(`\nquery: "${query}"\n`);
  candidates
    .map((text, i) => ({ text, score: cosine(queryVec, candidateVecs[i]) }))
    .sort((a, b) => b.score - a.score)
    .forEach((r) => console.log(`  ${r.score.toFixed(3)}  ${r.text}`));

  console.log(
    '\n→ "dyspnea on exertion" ranks highest and shares zero words with the query.',
  );
  console.log('  That gap — meaning over letters — is why the vector store exists.\n');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
