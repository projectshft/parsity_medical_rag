import Link from "next/link";
import { getLessons, getWeeks } from "@/lib/lms/curriculum";
import { ensureStudent, getCompletedSlugs } from "@/lib/lms/progress";

export default async function LearnPage() {
  const userId = await ensureStudent();
  const [weeks, lessons, completed] = await Promise.all([
    getWeeks(),
    getLessons(),
    userId ? getCompletedSlugs(userId) : Promise.resolve(new Set<string>()),
  ]);

  // Total counts deduped lessons (a homework linked in two weeks counts once).
  const total = lessons.length;
  const done = lessons.filter((l) => completed.has(l.slug)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Your course</h1>

      <div className="mt-4 rounded-lg border border-copilot-border bg-copilot-sidebar p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-copilot-text">
            {done} / {total} lessons complete
          </span>
          <span className="text-copilot-muted">{pct}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-copilot-input">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-8 space-y-8">
        {weeks.map((week) => (
          <section key={week.name}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white">{week.name}</h2>
              <span className="text-xs text-copilot-muted">
                {week.lessons.length} {week.lessons.length === 1 ? "lesson" : "lessons"}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-copilot-border overflow-hidden rounded-lg border border-copilot-border">
              {week.lessons.map((lesson) => {
                const isDone = completed.has(lesson.slug);
                return (
                  <li key={`${week.week}-${lesson.slug}`}>
                    <Link
                      href={`/learn/${lesson.slug}`}
                      className="flex items-center gap-3 bg-copilot-sidebar px-4 py-3 transition-colors hover:bg-copilot-input"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                          isDone
                            ? "border-green-500 bg-green-500 text-black"
                            : "border-copilot-border text-transparent"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="flex-1 text-sm text-copilot-text">
                        {lesson.title}
                      </span>
                      {lesson.isHomework && (
                        <span
                          className="shrink-0 rounded bg-copilot-input px-2 py-0.5 text-xs"
                          title="Homework: self-paced side project"
                        >
                          📝
                        </span>
                      )}
                      {lesson.isDeliverable && (
                        <span
                          className="shrink-0 rounded bg-copilot-input px-2 py-0.5 text-xs"
                          title="Deliverable: weekly video submission"
                        >
                          🎥
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
