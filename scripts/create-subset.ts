/**
 * Create a subset of patient data for the course
 *
 * Selects ~150 patients with diverse conditions to ensure
 * interesting queries are possible.
 *
 * Usage: npx ts-node scripts/create-subset.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const SOURCE_DIR = path.join(__dirname, '../data/coherent/fhir');
const OUTPUT_DIR = path.join(__dirname, '../data/subset');
const TARGET_COUNT = 150;

interface FHIRBundle {
  resourceType: 'Bundle';
  entry?: Array<{ resource: FHIRResource }>;
}

interface FHIRResource {
  resourceType: string;
  id?: string;
  code?: {
    coding?: Array<{ display?: string; code?: string }>;
    text?: string;
  };
}

// Conditions we want to ensure are represented
const TARGET_CONDITIONS = [
  'diabetes',
  'hypertension',
  'asthma',
  'copd',
  'heart',
  'cardiac',
  'anxiety',
  'depression',
  'arthritis',
  'obesity',
  'cancer',
  'chronic kidney',
  'stroke',
  'alzheimer',
  'dementia',
];

interface PatientInfo {
  filename: string;
  conditions: string[];
  hasDocuments: boolean;
}

function extractPatientInfo(bundle: FHIRBundle): { conditions: string[]; hasDocuments: boolean } {
  const conditions: string[] = [];
  let hasDocuments = false;

  for (const entry of bundle.entry || []) {
    const resource = entry.resource;

    if (resource.resourceType === 'Condition') {
      const display = resource.code?.coding?.[0]?.display || resource.code?.text || '';
      if (display) {
        conditions.push(display.toLowerCase());
      }
    }

    if (resource.resourceType === 'DocumentReference') {
      hasDocuments = true;
    }
  }

  return { conditions, hasDocuments };
}

function matchesTargetCondition(conditions: string[]): string | null {
  for (const target of TARGET_CONDITIONS) {
    for (const condition of conditions) {
      if (condition.includes(target)) {
        return target;
      }
    }
  }
  return null;
}

async function main() {
  console.log('Creating patient subset...\n');

  // Check source directory exists
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    console.error('Please download the Coherent dataset first.');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read all patient files
  const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));
  console.log(`Found ${files.length} patient bundles\n`);

  // Analyze each patient
  const patients: PatientInfo[] = [];
  const conditionCounts: Record<string, number> = {};

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf-8');
      const bundle = JSON.parse(content) as FHIRBundle;
      const info = extractPatientInfo(bundle);

      patients.push({
        filename: file,
        conditions: info.conditions,
        hasDocuments: info.hasDocuments,
      });

      // Count target conditions
      const match = matchesTargetCondition(info.conditions);
      if (match) {
        conditionCounts[match] = (conditionCounts[match] || 0) + 1;
      }
    } catch (e) {
      console.error(`Error parsing ${file}:`, e);
    }
  }

  console.log('Condition distribution in full dataset:');
  for (const [condition, count] of Object.entries(conditionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${condition}: ${count}`);
  }
  console.log();

  // Select subset: prioritize patients with documents and diverse conditions
  const selected: Set<string> = new Set();
  const selectedConditions: Record<string, number> = {};

  // First, ensure each target condition is represented
  for (const target of TARGET_CONDITIONS) {
    const matching = patients.filter(
      p => !selected.has(p.filename) &&
        p.hasDocuments &&
        p.conditions.some(c => c.includes(target))
    );

    // Add up to 8 patients per condition
    const toAdd = matching.slice(0, 8);
    for (const p of toAdd) {
      selected.add(p.filename);
      const match = matchesTargetCondition(p.conditions);
      if (match) {
        selectedConditions[match] = (selectedConditions[match] || 0) + 1;
      }
    }
  }

  console.log(`Selected ${selected.size} patients with target conditions`);

  // Fill remaining slots with patients that have documents
  const remaining = patients.filter(
    p => !selected.has(p.filename) && p.hasDocuments
  );

  // Shuffle for randomness
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }

  // Add until we reach target count
  for (const p of remaining) {
    if (selected.size >= TARGET_COUNT) break;
    selected.add(p.filename);
  }

  console.log(`Total selected: ${selected.size} patients\n`);

  // Copy selected files
  let copied = 0;
  for (const filename of selected) {
    const src = path.join(SOURCE_DIR, filename);
    const dst = path.join(OUTPUT_DIR, filename);
    fs.copyFileSync(src, dst);
    copied++;
  }

  console.log(`Copied ${copied} files to ${OUTPUT_DIR}`);

  // Create manifest
  const manifest = {
    created: new Date().toISOString(),
    sourceCount: files.length,
    subsetCount: selected.size,
    conditionCoverage: selectedConditions,
    files: Array.from(selected),
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('\nSubset created successfully!');
  console.log(`\nCondition coverage in subset:`);
  for (const [condition, count] of Object.entries(selectedConditions).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${condition}: ${count}`);
  }
}

main().catch(console.error);
