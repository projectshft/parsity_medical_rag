"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Mermaid } from "./Mermaid";
import { Quiz } from "./Quiz";
import { VisualEmbed } from "./VisualEmbed";

// Client-side render of a lesson's markdown body. remark-gfm gives tables
// and task lists; rehype-raw renders the embedded <details> Solution
// blocks (content is instructor-authored/trusted, so raw HTML is safe).
// Special code fences become interactive islands:
//   ```mermaid → rendered diagram
//   ```quiz    → inline self-check quiz (JSON body; see Quiz.tsx)
//   ```visual  → embedded interactive explainer (name of public/visuals/*.html)

const components: Components = {
  code(props) {
    const { className, children } = props;
    const source = String(children).replace(/\n$/, "");
    if (className?.includes("language-mermaid")) {
      return <Mermaid chart={source} />;
    }
    if (className?.includes("language-quiz")) {
      return <Quiz source={source} />;
    }
    if (className?.includes("language-visual")) {
      return <VisualEmbed source={source} />;
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
