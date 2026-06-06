import { executeQuery, formatResultsForLLM } from "@/lib/query-executor";
import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";

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

    const body = await request.json();
    const { query, vectorTopK = 10, obscurePII, format = 'raw' } = body;

    // Check header for PII obscuring (takes precedence over body)
    const headerObscure = request.headers.get('x-obscure-pii');
    const clientObscure = headerObscure === 'true' ? true :
                          headerObscure === 'false' ? false :
                          obscurePII;
    // The role wins: STAFF are always obscured; doctors may opt in
    const shouldObscure = session.role === 'STAFF' ? true : clientObscure;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

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
    console.error("Query error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
