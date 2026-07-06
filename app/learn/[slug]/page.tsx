import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getLessons } from "@/lib/lms/curriculum";
import { ensureStudent, getCompletedSlugs } from "@/lib/lms/progress";
import { LessonMarkdown } from "@/components/lms/LessonMarkdown";
import { MarkDoneCheckbox } from "@/components/lms/MarkDoneCheckbox";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [lesson, lessons] = await Promise.all([getLesson(slug), getLessons()]);
  if (!lesson) notFound();

  const userId = await ensureStudent();
  const completed = userId ? await getCompletedSlugs(userId) : new Set<string>();
  const isDone = completed.has(slug);

  // Prev/next by global curriculum order.
  const idx = lessons.findIndex((l) => l.slug === slug);
  const prev = idx > 0 ? lessons[idx - 1] : null;
  const next = idx >= 0 && idx < lessons.length - 1 ? lessons[idx + 1] : null;
  const needs = lesson.needs.replace(/[`*]/g, "").trim();

  return (
    <article>
      <Link
        href="/learn"
        className="text-sm text-copilot-muted hover:text-copilot-text"
      >
        ← All lessons
      </Link>

      <header className="mt-3 border-b border-copilot-border pb-5">
        <div className="flex items-center gap-2 text-sm text-copilot-muted">
          <span>{lesson.week === 0 ? "Day Zero" : `Week ${lesson.week}`}</span>
          {lesson.isHomework && (
            <span className="rounded bg-copilot-input px-2 py-0.5 text-xs">
              📝 Homework
            </span>
          )}
          {lesson.isDeliverable && (
            <span className="rounded bg-copilot-input px-2 py-0.5 text-xs">
              🎥 Deliverable
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">{lesson.title}</h1>
        {needs && (
          <p className="mt-2 text-sm text-copilot-muted">
            <span className="font-medium text-copilot-text">Needs:</span> {needs}
          </p>
        )}
        <div className="mt-4">
          <MarkDoneCheckbox slug={slug} initialDone={isDone} />
        </div>
      </header>

      <LessonMarkdown body={lesson.body} />

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-copilot-border pt-5 text-sm">
        {prev ? (
          <Link
            href={`/learn/${prev.slug}`}
            className="text-copilot-accent hover:underline"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/learn/${next.slug}`}
            className="text-right text-copilot-accent hover:underline"
          >
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
