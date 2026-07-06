import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";

// Server-only: reads the curriculum markdown from disk. The files are
// bundled into the serverless function via outputFileTracingIncludes in
// next.config.ts. The markdown is the single source of truth — edit a
// lesson file (or the README week index), push, and the site reflects it.
//
// Structure follows the instructor curriculum: a "Day Zero" pre-work unit
// plus five weeks (w1..w5). curriculum/README.md's "## Week index" section
// is the canonical ordering — it lists each lesson as a [title](slug.md)
// link, marks weekly video deliverables with 🎥 and homework with 📝.
// Lessons are keyed by SLUG (the filename without .md), which is stable
// across reordering, so student progress never shifts under a lesson.

export type Lesson = {
  slug: string; // filename without .md, e.g. "w1-02-setup"
  title: string; // from the file's first "# " heading (fallback: index link text)
  needs: string; // from the "**Needs: ...**" line (markdown, may contain code spans)
  body: string; // lesson markdown, after the title + needs lines
  week: number; // 0 = Day Zero, 1..5 = weeks
  order: number; // global position, for prev/next nav
  isDeliverable: boolean; // 🎥 weekly video deliverable
  isHomework: boolean; // 📝 self-paced side project
};

export type Week = {
  week: number; // 0 = Day Zero, 1..5
  name: string; // e.g. "Week 1 — The vector store" / "Day Zero — Foundations"
  lessons: Lesson[];
};

const CURRICULUM_DIR = path.join(process.cwd(), "curriculum");

// A group header inside the week index: "**Day Zero — Foundations ...**"
// or "**Week 3 — MCP + human-in-the-loop**".
const GROUP_RE = /^\*\*(Day Zero|Week\s+\d+)\s*[—–-]\s*(.+?)\*\*\s*$/;
// A lesson link on a list line: "[title](w1-02-setup.md)".
const LINK_RE = /\[([^\]]+)\]\(([A-Za-z0-9._-]+)\.md\)/;
const TITLE_RE = /^#\s+(.+?)\s*$/m;
const NEEDS_RE = /^\*\*Needs:\s*([\s\S]*?)\*\*\s*$/m;

type IndexEntry = {
  slug: string;
  linkText: string;
  isDeliverable: boolean;
  isHomework: boolean;
};
type IndexGroup = { week: number; name: string; entries: IndexEntry[] };

function weekNumber(label: string): number {
  if (/^Day Zero$/i.test(label)) return 0;
  const m = /Week\s+(\d+)/i.exec(label);
  return m ? parseInt(m[1], 10) : 99;
}

/** Parse the "## Week index" section of README.md into ordered groups. */
const parseIndex = cache(async (): Promise<IndexGroup[]> => {
  let readme = "";
  try {
    readme = await fs.readFile(path.join(CURRICULUM_DIR, "README.md"), "utf-8");
  } catch {
    return [];
  }

  // Scope to the "## Week index" section (up to the next "## " heading).
  const start = readme.search(/^##\s+Week index\s*$/m);
  if (start === -1) return [];
  const rest = readme.slice(start + 1);
  const end = rest.search(/^##\s+/m);
  const section = end === -1 ? rest : rest.slice(0, end);

  const groups: IndexGroup[] = [];
  let current: IndexGroup | null = null;

  for (const line of section.split("\n")) {
    const g = GROUP_RE.exec(line.trim());
    if (g) {
      current = { week: weekNumber(g[1]), name: `${g[1]} — ${g[2].trim()}`, entries: [] };
      groups.push(current);
      continue;
    }
    if (!current) continue;
    const link = LINK_RE.exec(line);
    if (!link) continue; // skip prose / the legend line
    const slug = link[2];
    current.entries.push({
      slug,
      linkText: link[1].trim(),
      isDeliverable: line.includes("🎥"),
      isHomework: line.includes("📝") || slug.startsWith("homework"),
    });
  }

  return groups;
});

function parseLessonFile(
  raw: string,
  entry: IndexEntry,
  week: number,
  order: number,
): Lesson {
  const title = TITLE_RE.exec(raw)?.[1]?.trim() || entry.linkText;
  const needsMatch = NEEDS_RE.exec(raw);
  const needs = needsMatch?.[1]?.trim() ?? "";

  // Body = everything after the "**Needs:**" line (or after the title if
  // there's no needs line): title + needs render in page chrome, the rest
  // is the lesson content.
  let body = raw;
  if (needsMatch) {
    body = raw.slice(needsMatch.index + needsMatch[0].length);
  } else {
    const titleMatch = TITLE_RE.exec(raw);
    if (titleMatch) body = raw.slice(titleMatch.index + titleMatch[0].length);
  }

  return {
    slug: entry.slug,
    title,
    needs,
    body: body.replace(/^\s+/, ""),
    week,
    order,
    isDeliverable: entry.isDeliverable,
    isHomework: entry.isHomework,
  };
}

/**
 * All lessons in curriculum order, deduped by slug (a homework file linked
 * in two weeks appears once here — used for nav + the admin matrix).
 */
export const getLessons = cache(async (): Promise<Lesson[]> => {
  const groups = await parseIndex();
  const bySlug = new Map<string, Lesson>();
  let order = 0;

  for (const group of groups) {
    for (const entry of group.entries) {
      if (bySlug.has(entry.slug)) continue; // first occurrence wins
      let raw: string;
      try {
        raw = await fs.readFile(path.join(CURRICULUM_DIR, `${entry.slug}.md`), "utf-8");
      } catch {
        continue; // linked file missing — skip rather than crash
      }
      bySlug.set(entry.slug, parseLessonFile(raw, entry, group.week, order++));
    }
  }

  return [...bySlug.values()];
});

/** A single lesson by slug, or null if unknown. */
export const getLesson = cache(async (slug: string): Promise<Lesson | null> => {
  const lessons = await getLessons();
  return lessons.find((l) => l.slug === slug) ?? null;
});

/**
 * The curriculum grouped for display: Day Zero + the five weeks, each with
 * its lessons in order. A homework file linked in two weeks shows in both.
 */
export const getWeeks = cache(async (): Promise<Week[]> => {
  const [groups, lessons] = await Promise.all([parseIndex(), getLessons()]);
  const bySlug = new Map(lessons.map((l) => [l.slug, l]));

  return groups.map((group) => ({
    week: group.week,
    name: group.name,
    lessons: group.entries
      .map((e) => bySlug.get(e.slug))
      .filter((l): l is Lesson => Boolean(l)),
  }));
});
