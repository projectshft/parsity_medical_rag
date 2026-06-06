import * as fs from "fs";
import * as path from "path";
import { processBundle } from "../lib/chunking";
import { upsertChunks, MedicalChunk, deleteAllChunks } from "../lib/pinecone";

const BATCH_SIZE = 50;

async function loadFhirFiles(dir: string): Promise<Array<{ name: string; content: object }>> {
  const files: Array<{ name: string; content: object }> = [];
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && entry.endsWith(".json")) {
      try {
        const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        files.push({ name: entry, content });
      } catch (err) {
        console.error(`Failed to parse ${entry}:`, err);
      }
    }
  }

  return files;
}

async function main() {
  const fhirDir = process.argv[2] || path.join(process.cwd(), "fhir");

  if (!fs.existsSync(fhirDir)) {
    console.error(`FHIR directory not found: ${fhirDir}`);
    console.log("Run 'npm run generate-fhir' first to create sample data");
    process.exit(1);
  }

  console.log(`Loading FHIR files from ${fhirDir}...`);
  const files = await loadFhirFiles(fhirDir);
  console.log(`Found ${files.length} FHIR files`);

  if (files.length === 0) {
    console.log("No FHIR files found");
    process.exit(0);
  }

  // Clear existing data
  console.log("Clearing existing vectors...");
  try {
    await deleteAllChunks();
  } catch (err) {
    console.log("Note: Could not clear existing vectors (index may be empty)");
  }

  // Process files in batches
  const allChunks: MedicalChunk[] = [];

  for (const file of files) {
    try {
      const chunks = processBundle(
        file.content as Parameters<typeof processBundle>[0],
        file.name
      );
      allChunks.push(...chunks);
    } catch (err) {
      console.error(`Error processing ${file.name}:`, err);
    }
  }

  console.log(`Created ${allChunks.length} chunks from ${files.length} files`);

  // Upload in batches
  console.log("Uploading to Pinecone...");
  let totalUploaded = 0;

  for (let i = 0; i < allChunks.length; i += BATCH_SIZE * 100) {
    const batch = allChunks.slice(i, i + BATCH_SIZE * 100);
    const uploaded = await upsertChunks(batch);
    totalUploaded += uploaded;
    console.log(`Uploaded ${totalUploaded}/${allChunks.length} chunks`);
  }

  console.log(`\nDone! Uploaded ${totalUploaded} chunks to Pinecone`);
}

main().catch(console.error);
