/**
 * Semantic search over the clinical notes (CLI).
 *
 *   npm run search -- "patient short of breath"
 *   npm run search -- "chest pain" <patientId>     # filter to one patient
 *
 * Runs the same `searchClinicalNotes` the app uses, and prints the ranked
 * matches — the fastest way to see meaning-based search working (and to watch
 * it find "dyspnea" notes for a "short of breath" query). Pass a patientId to
 * scope the search to one patient (the metadata filter). Needs a populated
 * vector store: `npm run vectorize -- --limit 200`.
 */

import 'dotenv/config';
import { searchClinicalNotes } from '../lib/vector-search';

async function main() {
  const query = process.argv[2];
  const patientId = process.argv[3]; // optional — filter to one patient

  if (!query) {
    console.log('Usage: npm run search -- "your query" [patientId]');
    process.exit(1);
  }

  const results = await searchClinicalNotes(query, {
    topK: 5,
    patientIds: patientId ? [patientId] : undefined,
  });
  console.log(`\n"${query}" — top ${results.length}:\n`);
  for (const r of results) {
    const name = r.patientName || 'Unknown';
    console.log(`  ${r.score.toFixed(3)}  ${name} · ${r.documentType || 'note'} (${r.date || 'undated'})`);
    console.log(`         ${(r.contentPreview || '').replace(/\s+/g, ' ').slice(0, 90)}…\n`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
