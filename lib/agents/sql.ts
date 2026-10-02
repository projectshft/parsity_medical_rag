/**
 * SQL agent — text-to-SQL. Feed the schema, get ONE read-only SELECT, run it.
 *
 * Week 3 · PROVIDED, walked through in class — except the guardrail TODO
 * further down, which is yours.
 */

import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { openai } from '../openai';
import { prisma } from '../prisma';
import type { Message } from '../agent';

const SqlSchema = z.object({
	sql: z
		.string()
		.describe(
			'One read-only Postgres SELECT. No semicolons. No LIMIT. NO DELETE',
		),
});

const SCHEMA = `You write PostgreSQL for a medical-records database.
Columns are camelCase and MUST be double-quoted: p."firstName". Tables are lowercase.
patients(id, "firstName", "lastName", gender, "birthDate", "deathDate", city, state)
conditions(id, "patientId", display)      -- diagnoses, SNOMED names e.g. "Hypertension"
medications(id, "patientId", display, status)  -- status: 'active' | 'stopped'
observations(id, "patientId", display, "valueNumber", unit, "effectiveDate")
notes(id, "patientId", date, content)
Every table joins to patients via "patientId" -> patients.id.
Rules: SELECT only. Use ILIKE '%term%' on display. Always add a LIMIT.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  DOCTOR
  STAFF
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now())

  @@map("users")
}

model Patient {
  id            String    @id
  firstName     String?
  lastName      String?
  gender        String?
  birthDate     DateTime? @db.Date
  deathDate     DateTime? // null = alive (823/1280 Coherent patients have a death date)
  phone         String?
  maritalStatus String?
  race          String?
  ethnicity     String?
  city          String?
  state         String?

  conditions   Condition[]
  observations Observation[]
  medications  Medication[]
  encounters   Encounter[]
  notes        Note[]

  @@index([lastName, firstName])
  @@map("patients")
}

model Condition {
  id             String    @id
  patientId      String
  code           String? // SNOMED code
  display        String // e.g. "Type 2 Diabetes Mellitus"
  clinicalStatus String? // active | resolved | inactive
  onsetDate      DateTime?
  abatementDate  DateTime?

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([display])
  @@map("conditions")
}

model Observation {
  id            String    @id
  patientId     String
  code          String? // LOINC code
  display       String // e.g. "Hemoglobin A1c"
  category      String? // laboratory | vital-signs | survey | ...
  valueNumber   Float?
  valueString   String?
  unit          String?
  effectiveDate DateTime?

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([code])
  @@index([display])
  @@map("observations")
}

model Medication {
  id         String    @id
  patientId  String
  code       String? // RxNorm code
  display    String // e.g. "Simvastatin 10 MG Oral Tablet"
  status     String? // active | stopped | completed
  authoredOn DateTime?
  dosage     String?

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([display])
  @@map("medications")
}

// Clinical notes live here too: Postgres is the system of record for ALL data.
// Pinecone is a DERIVED index (note text + metadata) kept in sync from this table.
model Note {
  id        String    @id // DocumentReference id — also the vector id in Pinecone
  patientId String
  type      String? // e.g. "History and physical note"
  date      DateTime?
  content   String // the full note text (~450 chars avg); the source of truth

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@map("notes")
}

model Encounter {
  id              String    @id
  patientId       String
  classCode       String? // HL7 v3 ActCode: AMB (ambulatory) | EMER (emergency) | IMP (inpatient)
  type            String? // e.g. "Encounter for problem", "General examination of patient"
  status          String? // finished | in-progress | planned | cancelled
  startDate       DateTime?
  endDate         DateTime?
  serviceProvider String? // organization display, if present

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([patientId])
  @@index([classCode])
  @@map("encounters")
}

`;

// Demo queries — all verified end-to-end against the data:
//   "how many patients have had a stroke?"                  -> ILIKE '%Stroke%'                     -> 113
//   "which patients have both hypertension and hyperlipidemia?" -> two EXISTS subqueries           -> 19 names
//   "who is the oldest patient with hypertension?"          -> ORDER BY "birthDate" ASC LIMIT 1     -> Avery Mueller (1911)
//   "how many patients had a heart attack?"                 -> ILIKE '%Myocardial Infarction%'      -> 25  (lay term -> SNOMED, from grounding)
//   "count patients on a statin"                            -> ILIKE '%statin%' AND status='active' -> 93  (lay term -> drug, + active filter)
// Skip lab-threshold queries (e.g. "glucose over 150") — the data is almost all normal readings, so they return ~1 row.
/**
 * Accept exactly one read-only SELECT, or throw.
 *
 * Comments are stripped first — otherwise `-- ` and block comments hide the
 * payload from the keyword scan. The write-keyword check runs BEFORE the
 * "starts with SELECT" check so the error names the real problem ("contains
 * DELETE") rather than the symptom, and so a writing CTE —
 * `WITH x AS (DELETE ... RETURNING *) SELECT * FROM x` — can't open innocently.
 */
export function assertReadOnly(sql: string): string {
	const trimmed = sql.trim().replace(/;\s*$/, '');
	if (!trimmed) throw new Error('Refused model SQL: the query was empty');

	const bare = trimmed
		.replace(/--[^\n]*/g, ' ')
		.replace(/\/\*[\s\S]*?\*\//g, ' ');

	// A stray `;` is how one SELECT becomes a SELECT and a DROP.
	if (bare.includes(';')) {
		throw new Error('Refused model SQL: more than one statement');
	}

	const write =
		/\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|vacuum|call|do|merge|set|reindex|refresh|comment|listen|notify|lock)\b/i.exec(
			bare,
		);
	if (write) {
		throw new Error(
			`Refused model SQL: contains the write keyword "${write[0].toUpperCase()}"`,
		);
	}

	if (!/^\s*(select|with)\b/i.test(bare)) {
		throw new Error('Refused model SQL: does not start with SELECT');
	}

	return trimmed;
}

export async function runSql(
	query: string,
	history: Message[] = [],
): Promise<string> {
	// Ground the prompt with REAL values from the data. The schema says what
	// columns exist — this says what's IN them ("Myocardial Infarction", not
	// "heart attack"). Without it, lay terms return a confident 0 rows.
	const conditions = await prisma.$queryRawUnsafe<{ display: string }[]>(
		`SELECT DISTINCT display FROM conditions`,
	);
	const meds = await prisma.$queryRawUnsafe<{ display: string }[]>(
		`SELECT DISTINCT display FROM medications`,
	);
	const vocab = `Real condition names (match the user's words to these, use ILIKE):\n${conditions
		.map((c) => c.display)
		.join(
			'; ',
		)}\n\nReal medication names:\n${meds.map((m) => m.display).join('; ')}`;

	const response = await openai.responses.parse({
		model: 'gpt-4o-mini',
		input: [
			{ role: 'system', content: ` ${SCHEMA}\n\n${vocab}` },
			{
				role: 'user',
				content: `User Query: ${query} \n\n Convo history: ${
					history.length > 0
						? history
								.slice(-5)
								.map((h) => `${h.role}: ${h.content}`)
								.join('\n')
						: ''
				}`,
			},
		],
		temperature: 0,
		text: { format: zodTextFormat(SqlSchema, 'sqlQuery') },
	});

	const { sql } = SqlSchema.parse(response.output_parsed);
	console.log(`[sql agent] ${sql}`);

	// INSTRUCTOR SOLUTION to the week-3 guardrail TODO.
	//
	// The line below executes a string an LLM wrote, via $queryRawUnsafe. The
	// prompt says "SELECT only" — but a prompt is a request, not a constraint.
	//
	// Teach the ordering, because it's the actual lesson: DATABASE_URL points at
	// `student_ro`, a role with SELECT and nothing else, so even a perfect bypass
	// of this function hits a permission error. The DATABASE enforces; this
	// validator explains. A validator alone would be security theatre.
	const safeSql = assertReadOnly(sql);

	const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(safeSql);
	if (rows.length === 0) return 'SQL result: 0 rows — nothing matches.';

	return (
		`SQL result (${rows.length} rows):\n` +
		rows
			.slice(0, 20)
			.map(
				(r) =>
					'- ' +
					Object.entries(r)
						.map(([k, v]) => `${k}: ${v}`)
						.join(', '),
			)
			.join('\n')
	);
}
