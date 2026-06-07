import { z } from "zod";
import { processBundle } from "@/lib/chunking";
import { upsertChunks, MedicalChunk } from "@/lib/pinecone";

const UploadRequestSchema = z.object({
  records: z.array(
    z.object({
      name: z.string(),
      content: z
        .object({ resourceType: z.string() })
        .passthrough(),
    })
  ),
});

export async function POST(request: Request) {
  try {
    const { records } = UploadRequestSchema.parse(await request.json());

    const allChunks: MedicalChunk[] = [];

    for (const record of records) {
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
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Upload error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Upload failed",
      },
      { status: 500 }
    );
  }
}
