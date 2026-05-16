import { executeQuery, formatResultsForLLM } from "@/lib/query-executor";
import { NextResponse } from "next/server";

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
    const body = await request.json();
    const { query, vectorTopK = 10, obscurePII, format = 'raw' } = body;

    // Check header for PII obscuring (takes precedence over body)
    const headerObscure = request.headers.get('x-obscure-pii');
    const shouldObscure = headerObscure === 'true' ? true :
                          headerObscure === 'false' ? false :
                          obscurePII;

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
    console.error("Query error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
