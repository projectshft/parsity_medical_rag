"use client";

import { useState } from "react";

// Inline lesson quiz. Authored in the curriculum markdown as a ```quiz fence
// containing JSON:
//
//   ```quiz
//   [
//     {
//       "q": "Why does the vectorize script paginate with a cursor?",
//       "options": ["Prisma requires it", "Bounded memory at any corpus size", "It's faster than one query"],
//       "answer": 1,
//       "explain": "One findMany would work at 21k notes — the cursor keeps memory flat no matter how big the table gets."
//     }
//   ]
//   ```
//
// Behavior: pick an option → Check → right answers confirm; wrong answers
// reveal the correct one. The explanation shows either way. No grading, no
// persistence — it's a self-check, not an exam.

type QuizQuestion = {
  q: string;
  options: string[];
  answer: number;
  explain?: string;
};

function QuizItem({ item, index }: { item: QuizQuestion; index: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);

  const correct = checked && picked === item.answer;
  const wrong = checked && picked !== null && picked !== item.answer;

  return (
    <div className="not-prose rounded-lg border border-copilot-border bg-copilot-sidebar p-4">
      <p className="mb-3 font-medium text-copilot-text">
        {index + 1}. {item.q}
      </p>
      <div className="space-y-2">
        {item.options.map((opt, i) => {
          const isPick = picked === i;
          const isAnswer = i === item.answer;
          let cls =
            "border-copilot-border hover:border-copilot-accent/60 cursor-pointer";
          if (checked && isAnswer) cls = "border-green-500 bg-green-500/10";
          else if (checked && isPick && !isAnswer)
            cls = "border-red-500 bg-red-500/10";
          else if (isPick) cls = "border-copilot-accent bg-copilot-accent/10";
          return (
            <button
              key={i}
              type="button"
              disabled={checked}
              onClick={() => setPicked(i)}
              className={`block w-full rounded-md border px-3 py-2 text-left text-sm text-copilot-text transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {!checked ? (
        <button
          type="button"
          disabled={picked === null}
          onClick={() => setChecked(true)}
          className="mt-3 rounded-md bg-copilot-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Check answer
        </button>
      ) : (
        <div className="mt-3 text-sm">
          {correct ? (
            <p className="font-medium text-green-400">✓ Correct</p>
          ) : wrong ? (
            <p className="font-medium text-red-400">
              ✗ Not quite — the answer is “{item.options[item.answer]}”
            </p>
          ) : null}
          {item.explain && (
            <p className="mt-1 text-copilot-muted">{item.explain}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setPicked(null);
              setChecked(false);
            }}
            className="mt-2 text-xs text-copilot-muted underline hover:text-copilot-text"
          >
            try again
          </button>
        </div>
      )}
    </div>
  );
}

export function Quiz({ source }: { source: string }) {
  let questions: QuizQuestion[];
  try {
    const parsed = JSON.parse(source);
    questions = Array.isArray(parsed) ? parsed : parsed.questions;
    if (!Array.isArray(questions)) throw new Error("no questions array");
  } catch {
    return (
      <div className="not-prose rounded-md border border-red-500 bg-red-500/10 p-3 text-sm text-red-300">
        This quiz block has invalid JSON — check the lesson source.
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      <p className="not-prose text-xs font-semibold uppercase tracking-wide text-copilot-muted">
        ✏️ Quick check
      </p>
      {questions.map((item, i) => (
        <QuizItem key={i} item={item} index={i} />
      ))}
    </div>
  );
}
