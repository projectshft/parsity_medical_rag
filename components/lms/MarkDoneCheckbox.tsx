"use client";

import { useState, useTransition } from "react";
import { toggleLesson } from "@/app/learn/actions";

/**
 * Optimistic "mark as done" toggle. Updates the UI immediately, then
 * persists via the server action; reverts on failure.
 */
export function MarkDoneCheckbox({
  day,
  initialDone,
}: {
  day: number;
  initialDone: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [pending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setDone(next);
    startTransition(async () => {
      try {
        await toggleLesson(day, next);
      } catch {
        setDone(!next); // revert
      }
    });
  }

  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
        done
          ? "border-green-600/40 bg-green-600/15 text-green-300"
          : "border-copilot-border bg-copilot-input text-copilot-text hover:border-copilot-accent"
      } ${pending ? "opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        className="h-4 w-4 accent-green-500"
        checked={done}
        disabled={pending}
        onChange={(e) => onToggle(e.target.checked)}
      />
      {done ? "Completed" : "Mark as done"}
    </label>
  );
}
