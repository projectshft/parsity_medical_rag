import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";

// Server-only: reads the curriculum markdown from disk. The files are
// bundled into the serverless function via outputFileTracingIncludes in
// next.config.ts. The markdown is the single source of truth — edit a
// day file, push, and the site reflects it.

export type Lesson = {
  day: number; // 1..36
  title: string; // from "# Day N — Title"
  needs: string; // from the "**Needs: ...**" line (markdown, may contain code spans)
  body: string; // lesson markdown, after the title + needs lines
  isDeliverable: boolean; // a 🎥 video-submission day
};

export type Block = {
  name: string; // e.g. "Foundations"
  startDay: number;
  endDay: number;
  lessons: Lesson[];
};

const CURRICULUM_DIR = path.join(process.cwd(), "curriculum");
const DELIVERABLE_DAYS = new Set([6, 12, 18, 24, 30, 36]);

const DAY_FILE_RE = /^day-(\d{2})\.md$/;
const TITLE_RE = /^#\s*Day\s*\d+\s*[—–-]\s*(.+?)\s*$/m;
const NEEDS_RE = /^\*\*Needs:\s*([\s\S]*?)\*\*\s*$/m;
const BLOCK_HEADER_RE = /^\*\*Days\s*(\d+)[–-](\d+)\s*[—–-]\s*(.+?)\*\*\s*$/gm;

function parseLesson(day: number, raw: string): Lesson {
  const title = TITLE_RE.exec(raw)?.[1]?.trim() ?? `Day ${day}`;
  const needsMatch = NEEDS_RE.exec(raw);
  const needs = needsMatch?.[1]?.trim() ?? "";

  // Body = everything after the "**Needs:**" line (or after the title if
  // there's no needs line). Keeps the lesson page clean: title + needs
  // render in page chrome, the rest is the lesson content.
  let body = raw;
  if (needsMatch) {
    body = raw.slice(needsMatch.index + needsMatch[0].length);
  } else {
    const titleMatch = TITLE_RE.exec(raw);
    if (titleMatch) body = raw.slice(titleMatch.index + titleMatch[0].length);
  }

  return {
    day,
    title,
    needs,
    body: body.replace(/^\s+/, ""),
    isDeliverable: DELIVERABLE_DAYS.has(day),
  };
}

/** All 36 lessons, ascending by day. Memoized per render. */
export const getLessons = cache(async (): Promise<Lesson[]> => {
  const entries = await fs.readdir(CURRICULUM_DIR);
  const lessons: Lesson[] = [];

  for (const name of entries) {
    const m = DAY_FILE_RE.exec(name);
    if (!m) continue; // skips README.md, AUTHORING.md, assets/, junk drafts
    const day = parseInt(m[1], 10);
    const raw = await fs.readFile(path.join(CURRICULUM_DIR, name), "utf-8");
    lessons.push(parseLesson(day, raw));
  }

  return lessons.sort((a, b) => a.day - b.day);
});

/** A single lesson by day number, or null if out of range. */
export const getLesson = cache(async (day: number): Promise<Lesson | null> => {
  const lessons = await getLessons();
  return lessons.find((l) => l.day === day) ?? null;
});

/** Block names + day ranges parsed from README.md, in order. */
const getBlockRanges = cache(
  async (): Promise<Array<{ name: string; startDay: number; endDay: number }>> => {
    let readme = "";
    try {
      readme = await fs.readFile(path.join(CURRICULUM_DIR, "README.md"), "utf-8");
    } catch {
      readme = "";
    }

    const ranges: Array<{ name: string; startDay: number; endDay: number }> = [];
    BLOCK_HEADER_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BLOCK_HEADER_RE.exec(readme)) !== null) {
      ranges.push({
        startDay: parseInt(match[1], 10),
        endDay: parseInt(match[2], 10),
        name: match[3].trim(),
      });
    }

    // Fallback: fixed 6-day blocks if README couldn't be parsed.
    if (ranges.length === 0) {
      for (let i = 0; i < 6; i++) {
        ranges.push({
          startDay: i * 6 + 1,
          endDay: i * 6 + 6,
          name: `Block ${i + 1}`,
        });
      }
    }
    return ranges;
  }
);

/** The full curriculum grouped into blocks, each with its lessons. */
export const getBlocks = cache(async (): Promise<Block[]> => {
  const [lessons, ranges] = await Promise.all([getLessons(), getBlockRanges()]);
  return ranges.map((r) => ({
    ...r,
    lessons: lessons.filter((l) => l.day >= r.startDay && l.day <= r.endDay),
  }));
});
