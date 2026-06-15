import Link from "next/link";
import { notFound } from "next/navigation";
import { getLesson, getLessons } from "@/lib/lms/curriculum";
import { ensureStudent, getCompletedDays } from "@/lib/lms/progress";
import { LessonMarkdown } from "@/components/lms/LessonMarkdown";
import { MarkDoneCheckbox } from "@/components/lms/MarkDoneCheckbox";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayStr } = await params;
  const day = Number(dayStr);
  if (!Number.isInteger(day)) notFound();

  const [lesson, lessons] = await Promise.all([getLesson(day), getLessons()]);
  if (!lesson) notFound();

  const userId = await ensureStudent();
  const completed = userId ? await getCompletedDays(userId) : new Set<number>();
  const isDone = completed.has(day);

  const maxDay = lessons.length ? lessons[lessons.length - 1].day : 36;
  const prev = day > 1 ? day - 1 : null;
  const next = day < maxDay ? day + 1 : null;
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
          <span>Day {lesson.day}</span>
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
          <MarkDoneCheckbox day={day} initialDone={isDone} />
        </div>
      </header>

      <LessonMarkdown body={lesson.body} />

      <nav className="mt-10 flex items-center justify-between border-t border-copilot-border pt-5 text-sm">
        {prev ? (
          <Link href={`/learn/${prev}`} className="text-copilot-accent hover:underline">
            ← Day {prev}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/learn/${next}`} className="text-copilot-accent hover:underline">
            Day {next} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
