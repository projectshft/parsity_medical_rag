"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mermaid } from "./Mermaid";

// Client-side render of a lesson's markdown body. remark-gfm gives tables
// and task lists; rehype-raw renders the embedded <details> Solution
// blocks (content is instructor-authored/trusted, so raw HTML is safe).
// ```mermaid fences become rendered diagrams via the Mermaid island.

const components: Components = {
  code(props) {
    const { className, children } = props;
    if (className?.includes("language-mermaid")) {
      return <Mermaid chart={String(children).replace(/\n$/, "")} />;
    }
    return <code className={className}>{children}</code>;
  },
};

export function LessonMarkdown({ body }: { body: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-copilot-input prose-code:text-copilot-accent prose-a:text-copilot-accent">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
