import { NextResponse } from "next/server";
import { z } from "zod";
import { select } from "@/lib/agents/selector";
import { runSql } from "@/lib/agents/sql";
import { runRag } from "@/lib/agents/rag";
import { shouldObscurePII, obscureContent } from "@/lib/pii";

const QueryRequestSchema = z.object({
  query: z.string().min(1),
  obscurePII: z.boolean().optional(),
});

/**
 * Direct query endpoint for the hybrid RAG system (the clinician channel).
 *
 * Access is channel-based, not login-based: this direct endpoint returns full
 * data by default. The front-office channel (the MCP server) is the one that
 * always obscures PII. Callers here may still opt into obscuring.
 *
 * Same agents as the chat pipeline (selector → sql ‖ rag), but it does NOT
 * stream — it returns the combined text, optionally PII-scrubbed.
 *
 * POST /api/query
 * Body: { query: string, obscurePII?: boolean }
 */
export async function POST(request: Request) {
  try {
    const { query, obscurePII } = QueryRequestSchema.parse(await request.json());
    const obscure = shouldObscurePII(obscurePII);

    const plan = await select(query);
    const [sqlText, ragText] = plan.needsSearch
      ? await Promise.all([
          plan.useSql ? runSql(query) : undefined,
          plan.useRag ? runRag(plan.semanticQuery) : undefined,
        ])
      : [undefined, undefined];

    const combined = [sqlText, ragText].filter(Boolean).join("\n\n");

    // Shape-agnostic PII scrub for the obscured channel: the regex de-identifier
    // runs over the whole rendered output (Week 5 lesson — imperfect by design).
    const text = obscure ? obscureContent(combined) : combined;

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
