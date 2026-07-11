/**
 * Structure-aware chunking — REFERENCE SOLUTION for docs/CHALLENGE-CHUNKING.md
 * (one valid strategy; students design their own): pack whole verses, never splitting
 * a verse, never crossing a book boundary, with optional verse overlap —
 * and carry metadata (book, chapter, verse range) on every chunk.
 *
 * Usage:
 *   npm run bible:smart                        # target 500 chars, 1-verse overlap
 *   npm run bible:smart -- --target 800 --overlap-verses 2
 */

import * as fs from 'fs';
import { loadVerses, Verse } from './parse';

type Chunk = {
  id: number;
  text: string;
  metadata: {
    book: string;
    chapter: number;
    verseStart: number;
    verseEnd: number;
    reference: string; // e.g. "Genesis 1:1-5" style citation
  };
};

function args(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return parseInt(process.argv[i + 1], 10);
}

const TARGET = args('--target', 500);
const OVERLAP_VERSES = args('--overlap-verses', 1);

function buildChunk(id: number, verses: Verse[]): Chunk {
  const first = verses[0];
  const last = verses[verses.length - 1];
  const reference =
    first.chapter === last.chapter
      ? `${first.book} ${first.chapter}:${first.verse}-${last.verse}`
      : `${first.book} ${first.chapter}:${first.verse}-${last.chapter}:${last.verse}`;

  return {
    id,
    text: verses.map((v) => `${v.chapter}:${v.verse} ${v.text}`).join(' '),
    metadata: {
      book: first.book,
      chapter: first.chapter,
      verseStart: first.verse,
      verseEnd: last.verse,
      reference,
    },
  };
}

function main() {
  const verses = loadVerses();
  const chunks: Chunk[] = [];

  let id = 0;
  let buffer: Verse[] = [];
  let bufferLen = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    chunks.push(buildChunk(id++, buffer));
    // Overlap: the last N verses also start the next chunk, so content
    // straddling a boundary is findable from either side
    buffer = OVERLAP_VERSES > 0 ? buffer.slice(-OVERLAP_VERSES) : [];
    bufferLen = buffer.reduce((n, v) => n + v.text.length, 0);
  };

  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const prev = buffer[buffer.length - 1];

    // Never let a chunk cross into a new book
    if (prev && prev.book !== v.book) {
      buffer = []; // book boundary: no overlap across books either
      bufferLen = 0;
      flush();
    }

    buffer.push(v);
    bufferLen += v.text.length;

    if (bufferLen >= TARGET) flush();
  }
  flush();

  fs.writeFileSync(
    'data/bible/chunks-smart.jsonl',
    chunks.map((c) => JSON.stringify(c)).join('\n')
  );

  console.log(`Verses: ${verses.length.toLocaleString()}`);
  console.log(`Chunks: ${chunks.length.toLocaleString()} (target=${TARGET}, overlapVerses=${OVERLAP_VERSES})`);
  console.log(`Wrote data/bible/chunks-smart.jsonl\n`);

  for (const i of [0, 1000, 5000]) {
    if (!chunks[i]) continue;
    console.log(`--- chunk ${i} [${chunks[i].metadata.reference}] ---`);
    console.log(chunks[i].text.slice(0, 200) + (chunks[i].text.length > 200 ? '…' : ''));
    console.log();
  }
}

main();
