import { executeQuery, formatResultsForLLM } from "@/lib/query-executor";
import { NextResponse } from "next/server";
import { z } from "zod";

const QueryRequestSchema = z.object({
  query: z.string().min(1),
  vectorTopK: z.number().int().positive().max(50).default(10),
  obscurePII: z.boolean().optional(),
  format: z.enum(["raw", "formatted"]).default("raw"),
});

/**
 * Direct query endpoint for the hybrid RAG system (the clinician channel).
 *
 * Access is channel-based, not login-based: this direct endpoint returns full
 * data by default. The front-office channel (the MCP server) is the one that
 * always obscures PII. Callers here may still opt into obscuring.
 *
 * POST /api/query
 * Body: { query: string, vectorTopK?: number, obscurePII?: boolean, format?: 'raw' | 'formatted' }
 * Headers: X-Obscure-PII: true (optional, overrides body.obscurePII)
 */
export async function POST(request: Request) {
  try {
    const { query, vectorTopK, obscurePII, format } = QueryRequestSchema.parse(
      await request.json()
    );

    // Optional PII obscuring: header takes precedence over body.
    const headerObscure = request.headers.get("x-obscure-pii");
    const shouldObscure =
      headerObscure === "true" ? true : headerObscure === "false" ? false : obscurePII;

    const result = await executeQuery(query, { vectorTopK, obscurePII: shouldObscure });

    if (format === "formatted") {
      return NextResponse.json({
        ...result,
        formatted: formatResultsForLLM(result, shouldObscure),
      });
    }

    return NextResponse.json(result);
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
