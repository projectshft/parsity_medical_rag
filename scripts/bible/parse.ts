/**
 * Parser for the Project Gutenberg King James Bible plain text
 * (https://www.gutenberg.org/cache/epub/10/pg10.txt)
 *
 * Format: books appear as title lines; each verse is a paragraph starting
 * with "chapter:verse " and may wrap across lines. Some paragraphs are
 * CONTINUATIONS of the previous verse (no chapter:verse prefix) — a
 * non-verse paragraph is only a book title if the next verse is 1:1.
 */

import * as fs from 'fs';

export type Verse = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

const START_MARKER = '*** START OF THE PROJECT GUTENBERG EBOOK';
const END_MARKER = '*** END OF THE PROJECT GUTENBERG EBOOK';
const VERSE_RE = /^(\d+):(\d+)\s+/;

/** Strip the Gutenberg header/footer, returning only the scripture body */
export function extractBody(raw: string): string {
  const start = raw.indexOf(START_MARKER);
  const end = raw.indexOf(END_MARKER);
  const afterStart = raw.indexOf('\n', start) + 1;
  return raw.slice(afterStart, end);
}

/** Parse the body into verse records with book metadata */
export function parseVerses(body: string): Verse[] {
  // Paragraphs are separated by blank lines; verses wrap across lines
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const verses: Verse[] = [];
  let currentBook = 'Unknown';
  let pendingTitle: string | null = null;

  for (const para of paragraphs) {
    const match = para.match(VERSE_RE);

    if (!match) {
      // Either a book title or a continuation of the previous verse.
      // Titles are short; continuations belong to the verse before them.
      if (pendingTitle === null && verses.length > 0 && para.length > 0 && !looksLikeTitle(para)) {
        verses[verses.length - 1].text += ' ' + para;
      } else {
        pendingTitle = para; // keep the LAST candidate (TOC lines overwrite each other)
      }
      continue;
    }

    const chapter = parseInt(match[1], 10);
    const verse = parseInt(match[2], 10);

    // A pending title only becomes the book when a book actually starts (1:1)
    if (pendingTitle !== null) {
      if (chapter === 1 && verse === 1) {
        currentBook = pendingTitle;
      } else if (verses.length > 0) {
        // Not a title after all — it was a continuation paragraph
        verses[verses.length - 1].text += ' ' + pendingTitle;
      }
      pendingTitle = null;
    }

    // A paragraph can contain SEVERAL verses run together — split on
    // inline "chapter:verse " references, not just the one at the start
    for (const piece of para.split(/\s(?=\d+:\d+\s)/)) {
      const m = piece.match(VERSE_RE);
      if (!m) {
        // stray fragment — attach to the previous verse
        if (verses.length > 0) verses[verses.length - 1].text += ' ' + piece;
        continue;
      }
      verses.push({
        book: currentBook,
        chapter: parseInt(m[1], 10),
        verse: parseInt(m[2], 10),
        text: piece.replace(VERSE_RE, '').trim(),
      });
    }
  }

  return verses;
}

/** Heuristic: title lines are short and have no sentence-ending punctuation */
function looksLikeTitle(para: string): boolean {
  return para.length < 80 && !/[.!?]$/.test(para);
}

export function loadVerses(path = 'data/bible/kjv.txt'): Verse[] {
  const raw = fs.readFileSync(path, 'utf-8');
  return parseVerses(extractBody(raw));
}
