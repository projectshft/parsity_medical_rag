import Link from "next/link";
import { getBlocks } from "@/lib/lms/curriculum";
import { ensureStudent, getCompletedDays } from "@/lib/lms/progress";

export default async function LearnPage() {
  const userId = await ensureStudent();
  const [blocks, completed] = await Promise.all([
    getBlocks(),
    userId ? getCompletedDays(userId) : Promise.resolve(new Set<number>()),
  ]);

  const total = blocks.reduce((n, b) => n + b.lessons.length, 0);
  const done = completed.size;
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
        {blocks.map((block) => (
          <section key={block.name}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-white">{block.name}</h2>
              <span className="text-xs text-copilot-muted">
                Days {block.startDay}&ndash;{block.endDay}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-copilot-border overflow-hidden rounded-lg border border-copilot-border">
              {block.lessons.map((lesson) => {
                const isDone = completed.has(lesson.day);
                return (
                  <li key={lesson.day}>
                    <Link
                      href={`/learn/${lesson.day}`}
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
                      <span className="text-sm text-copilot-muted">
                        Day {lesson.day}
                      </span>
                      <span className="flex-1 text-sm text-copilot-text">
                        {lesson.title}
                      </span>
                      {lesson.isDeliverable && (
                        <span
                          className="shrink-0 rounded bg-copilot-input px-2 py-0.5 text-xs"
                          title="Deliverable: video submission"
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
