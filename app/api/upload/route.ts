import { processBundle } from "@/lib/chunking";
import { upsertChunks, MedicalChunk } from "@/lib/pinecone";

interface UploadedRecord {
  name: string;
  content: {
    resourceType: string;
    entry?: Array<{ resource: unknown }>;
    [key: string]: unknown;
  };
}

export async function POST(request: Request) {
  try {
    const { records } = await request.json();

    if (!records || !Array.isArray(records)) {
      return Response.json(
        { error: "Records array is required" },
        { status: 400 }
      );
    }

    const allChunks: MedicalChunk[] = [];

    for (const record of records as UploadedRecord[]) {
      try {
        const chunks = processBundle(
          record.content as Parameters<typeof processBundle>[0],
          record.name
        );
        allChunks.push(...chunks);
      } catch (err) {
        console.error(`Error processing ${record.name}:`, err);
      }
    }

    if (allChunks.length === 0) {
      return Response.json(
        { error: "No valid FHIR resources found in uploaded files" },
        { status: 400 }
      );
    }

    const upsertedCount = await upsertChunks(allChunks);

    return Response.json({
      success: true,
      recordsProcessed: records.length,
      chunksCreated: upsertedCount,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
