import { executeQuery, formatResultsForLLM } from "@/lib/query-executor";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthError } from "@/lib/auth";

const QueryRequestSchema = z.object({
  query: z.string().min(1),
  vectorTopK: z.number().int().positive().max(50).default(10),
  obscurePII: z.boolean().optional(),
  format: z.enum(["raw", "formatted"]).default("raw"),
});

/**
 * Direct query endpoint for programmatic access to the hybrid RAG system
 *
 * POST /api/query
 * Body: { query: string, vectorTopK?: number, obscurePII?: boolean, format?: 'raw' | 'formatted' }
 * Headers: X-Obscure-PII: true (optional, overrides body.obscurePII)
 *
 * Returns: QueryResult with analysis, SQL results, and vector results
 */
export async function POST(request: Request) {
  try {
    // INSTRUCTOR SOLUTION: STAFF never see PII, regardless of client input (docs/CHALLENGE-RBAC.md)
    const session = await requireAuth(request);

    const { query, vectorTopK, obscurePII, format } = QueryRequestSchema.parse(
      await request.json()
    );

    // Check header for PII obscuring (takes precedence over body)
    const headerObscure = request.headers.get('x-obscure-pii');
    const clientObscure = headerObscure === 'true' ? true :
                          headerObscure === 'false' ? false :
                          obscurePII;
    // The role wins: STAFF are always obscured; doctors may opt in
    const shouldObscure = session.role === 'STAFF' ? true : clientObscure;

    const result = await executeQuery(query, { vectorTopK, obscurePII: shouldObscure });

    // Return formatted text if requested
    if (format === 'formatted') {
      return NextResponse.json({
        ...result,
        formatted: formatResultsForLLM(result, shouldObscure),
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Query error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
