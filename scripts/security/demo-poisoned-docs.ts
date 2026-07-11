#!/usr/bin/env npx ts-node

/**
 * Demo: Poisoned Documents Attack (step-by-step)
 *
 * Walks — ONE step at a time — through how a RAG system can be attacked by
 * prompt injection hidden in retrieved documents, and how content validation
 * defends against it. Press Enter to advance through each step.
 *
 * Run: npm run security:poisoned
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import {
  validateContent,
  sanitizeContent,
  buildSandboxedContext,
} from '../../lib/security/content-validator';

const c = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
};
const paint = (s: string, color: keyof typeof c) => `${c[color]}${s}${c.reset}`;

/** Pause until the user presses Enter (works without raw mode). */
function pause(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(paint('\n  ↵  Enter to continue…\n', 'dim'), () => {
      rl.close();
      resolve();
    }),
  );
}

/** Print one titled step (concise body), then wait. */
async function step(title: string, body: () => void): Promise<void> {
  console.log('\n' + paint('▸ ' + title, 'bold'));
  console.log(paint('─'.repeat(60), 'dim'));
  body();
  await pause();
}

function header(title: string): void {
  console.log('\n' + paint('═'.repeat(60), 'cyan'));
  console.log(paint('  ' + title, 'bold'));
  console.log(paint('═'.repeat(60), 'cyan'));
}

/** Keep console output small — the point is one idea per step, not a wall. */
function preview(text: string, max = 260): string {
  const t = text.replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim();
  return t.length > max ? t.slice(0, max) + paint(' …', 'dim') : t;
}

function loadPoisonedDoc(filename: string): { content: string; patientName: string } {
  const raw = readFileSync(join(__dirname, '../../data/security/poisoned', filename), 'utf-8');
  const bundle = JSON.parse(raw);
  let content = '';
  let patientName = 'Unknown';
  for (const { resource } of bundle.entry) {
    if (resource.resourceType === 'Patient') {
      const n = resource.name?.[0];
      patientName = `${n?.given?.join(' ') ?? ''} ${n?.family ?? ''}`.trim();
    } else if (resource.valueString) {
      content = resource.valueString;
    } else if (resource.description) {
      content = resource.description;
    }
  }
  return { content, patientName };
}

const ATTACKS = [
  {
    file: 'poisoned-ignore-instructions.json',
    title: 'Attack 1 — "Ignore your instructions"',
    goal: 'Override the system prompt so the model follows the document, not you.',
  },
  {
    file: 'poisoned-tool-invocation.json',
    title: 'Attack 2 — Fake tool / conversation injection',
    goal: 'Escape the context block and fake tool calls to pull data in bulk.',
  },
  {
    file: 'poisoned-data-exfil.json',
    title: 'Attack 3 — Data exfiltration',
    goal: 'Hide instructions that append attacker URLs to leak patient data.',
  },
];

async function runAttack(attack: (typeof ATTACKS)[number]): Promise<void> {
  header(attack.title);
  const doc = loadPoisonedDoc(attack.file);

  await step('The poisoned document that got retrieved', () => {
    console.log(paint(`  patient: ${doc.patientName}`, 'dim'));
    console.log('\n' + preview(doc.content));
    console.log('\n' + paint(`  Goal: ${attack.goal}`, 'yellow'));
  });

  const validation = validateContent(doc.content);

  await step('Detection — validateContent()', () => {
    const scoreColor = validation.riskScore >= 70 ? 'red' : validation.riskScore >= 30 ? 'yellow' : 'green';
    console.log('  risk score: ' + paint(`${validation.riskScore}/100`, scoreColor) +
      `   clean: ${validation.isClean ? paint('yes', 'green') : paint('NO', 'red')}`);
    console.log('  patterns detected:');
    for (const p of validation.detectedPatterns.slice(0, 5)) {
      console.log(`    ${paint('[' + p.severity.toUpperCase() + ']', p.severity === 'critical' ? 'red' : 'yellow')} ` +
        `${p.type} — ${paint('"' + preview(p.match, 60).replace(/\n/g, ' ') + '"', 'dim')}`);
    }
  });

  await step('Defense — sanitizeContent()', () => {
    console.log(paint('  the same document, neutralized:', 'green'));
    console.log('\n' + preview(sanitizeContent(doc.content)));
  });

  await step('Defense — buildSandboxedContext()', () => {
    console.log(paint('  wrapped so the model treats it as DATA, not commands:', 'green'));
    console.log('\n' + preview(buildSandboxedContext([{ content: doc.content, metadata: { patientName: doc.patientName } }]), 320));
  });
}

async function main(): Promise<void> {
  header('RAG Security: Poisoned Documents');
  console.log(paint(
    '\n  A retrieved note can carry an attack. We step through three of them —\n' +
    '  one at a time — and watch content validation catch and defuse each.',
    'cyan',
  ));
  await pause();

  for (const attack of ATTACKS) {
    await runAttack(attack);
  }

  header('The defense, in layers');
  console.log([
    `  1. ${paint('Validate', 'bold')}   — score retrieved content; flag injection patterns.`,
    `  2. ${paint('Sanitize', 'bold')}   — strip fake role/context tags + hidden instruction blocks.`,
    `  3. ${paint('Sandbox', 'bold')}    — wrap it so the model reads it as data, not commands.`,
    '',
    paint('  Wire these into the retrieval path before the aggregator sees the notes.', 'cyan'),
    paint('  Hands-on: docs/CHALLENGE-POISONED-DOCS.md', 'dim'),
  ].join('\n'));
  console.log();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
