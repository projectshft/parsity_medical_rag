/**
 * Structure-aware chunking — YOUR TASK (Bible chunking homework)
 *
 * Read docs/CHALLENGE-CHUNKING.md FIRST — the strategy is yours to choose
 * (by verse? chapter? packed passages? with overlap?) and defending that choice
 * is the assignment. The naive chunker (`npm run bible:fixed`) slices blindly by
 * character count and shreds verses mid-sentence; whatever you design should
 * beat it, and `npm run bible:audit` will measure both.
 *
 * You have: `loadVerses()` from ./parse returns [{ book, chapter, verse, text }].
 * You write: data/bible/chunks-smart.jsonl (one JSON chunk per line), each chunk
 * carrying metadata (at minimum a human-readable reference like "Genesis 1:1-5").
 */

import { loadVerses, Verse } from './parse';

type Chunk = {
  id: number;
  text: string;
  metadata: {
    book: string;
    chapter: number;
    verseStart: number;
    verseEnd: number;
    reference: string; // e.g. "Genesis 1:1-5"
  };
};

function main() {
  const verses: Verse[] = loadVerses();
  const chunks: Chunk[] = [];
  console.log(`Loaded ${verses.length} verses; produced ${chunks.length} chunks so far.`);

  // TODO — build structure-aware chunks:
  //  1. Walk verses in order, accumulating them into a buffer.
  //  2. Flush the buffer into a Chunk once it reaches the --target size...
  //  3. ...but NEVER split a verse, and NEVER let a chunk span two books.
  //  4. Optionally carry the last --overlap-verses verses into the next chunk.
  //  5. Tag each chunk with its book / chapter / verse-range `reference`.
  //  6. Write data/bible/chunks-smart.jsonl (JSON.stringify(chunk) per line).
  // Then: `npm run bible:audit -- data/bible/chunks-smart.jsonl` and compare it
  // to the fixed-size output. Why is the smart one better for retrieval?
  throw new Error('Not implemented — your turn! (scripts/bible/chunk-smart.ts)');
}

main();
