/**
 * SELECTOR agent — YOUR TASK. Structured output only (never streams).
 *
 * The selector just ROUTES: does this question need the SQL database (structured
 * facts, counts, filters), the clinical notes (meaning-based search), both, or
 * neither (a general question)? It does NOT extract conditions/filters/entities —
 * the SQL agent's LLM does that when it writes the query. Keep it tiny.
 */

import { z } from 'zod';
import { openai } from '../openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { Message } from '../agent';
import { Prisma } from '@prisma/client';

// useSql: boolean;
// useRag: boolean;
// reason: string;
// agentQuery: string;

const planAgentSchema = z.object({
	useSql: z.boolean().describe('Whether to use the sql database'),
	useRag: z.boolean().describe('Whether to use the vector store'),
	reason: z
		.string()
		.describe(
			'The reason for the decision to use the sql database or the vector store or NONE',
		),
	agentQuery: z
		.string()
		.describe('The optimized query to be sent to RAG agent')
		.nullable(), // if useRag is true, this is the query to be sent to the RAG agent
	clarificationQuery: z
		.string()
		.describe('If the query is not clear, ask for clarification')
		.nullable(), // if useSql is true, this is the query to be sent to the clarification agent
});

export type Plan = {
	useSql: boolean;
	useRag: boolean;
	/** false = a general question with no tie to the records — answer directly. */
	needsSearch: boolean;
	semanticQuery: string;
};

// Compact schema — enough for ROUTING decisions ("can SQL answer this?").
// The SQL agent has its own richer version with query-writing rules.
const SQL_SCHEMA = `
patients(id, firstName, lastName, gender, birthDate, deathDate, phone, maritalStatus, race, ethnicity, city, state)
conditions(id, patientId, code, display, clinicalStatus, onsetDate, abatementDate)   -- diagnoses (SNOMED names, e.g. "Hypertension")
observations(id, patientId, code, display, category, valueNumber, valueString, unit, effectiveDate)  -- labs & vitals (LOINC names)
medications(id, patientId, code, display, status, authoredOn, dosage)   -- prescriptions (RxNorm names)
notes(id, patientId, type, date, content)   -- the raw clinical note text
encounters(id, patientId, classCode, type, status, startDate, endDate, serviceProvider)

Good for: counts, filters (by condition/med/lab/age/demographics), superlatives (youngest/oldest), exact patient lookups.`;

// TODO: Write the system prompt. Describe the two stores (SQL DB of structured
// facts; vector store of clinical notes) and when each is needed. A pure general
// question (a greeting, "what's a normal A1C range?") needs NEITHER. When unsure,
// prefer searching the notes.

export async function select(
	query: string,
	history: Message[] = [],
): Promise<Plan> {
	//query -> decide what to do?

	// query vector or query sql OR BOTH
	//CONTEXT:
	// we have notes on patiens in a vector store including....
	// we have structured data on patients in a sql database including .....
	// sql schema / types

	// choose 1 or both or none

	const answer = await openai.responses.parse({
		model: 'gpt-4o-mini',
		text: { format: zodTextFormat(planAgentSchema, 'plan') },
		input: [
			{
				role: 'system',
				content: `
        From the user's query, decide if the query should be answered by the vector store or the sql database or both or none.
        Our vector store has notes about patients. Here is an example
          
          city: "Boston"
          content: "1988-06-07\n\n# Chief Complaint\n- Blurred Vision\n- Tingling in Hands and Feet\n- Thirst\n- urinary frequency\n- Fatigue\n- Frequent Urination\n\n\n# History of Present Illness\nAvery919\n is a 76 year-old non-hispanic black male. Patient has a history of laceration of foot.\n\n# Social History\nPatient is married. Patient is an active smoker and is an alcoholic.\n Patient identifies as heterosexual.\n\nPatient comes from a middle socioeconomic background.\n Patient has a high school education.\nPatient currently has Medicare.\n\n# Allergies\nNo Known Allergies.\n\n# Medications\nacetaminophen 325 mg oral tablet; hydrochlorothiazide 25 mg oral tablet; insulin human, isophane 70 unt/ml / regular insulin, human 30 unt/ml injectable suspension [humulin]; nitroglycerin 0.4 mg/actuat mucosal spray\n\n# Assessment and Plan\n\n\n## Plan\n\nThe following reports were created:\n- basic metabolic panel \n- lipid panel \nThe patient was prescribed the following medications:\n- insulin human, isophane 70 unt/ml / regular insulin, human 30 unt/ml injectable suspension [humulin]\n- hydrochlorothiazide 25 mg oral tablet\n- nitroglycerin 0.4 mg/actuat mucosal spray"
          currentMedications: [ "Unknown", "1 ML DOCEtaxel 20 MG/ML Injection", "0.25 ML Leuprolide Acetate 30 MG/ML Prefilled Syringe", "insulin human, isophane 70 UNT/ML / Regular Insulin, Human 30 UNT/ML Injectable Suspension [Humulin]", "Hydrochlorothiazide 25 MG Oral Tablet", "Simvastatin 20 MG Oral Tablet", "Amlodipine 5 MG Oral Tablet" ]
          firstName: "Avery"
          gender: "male"
          lastName: "Mueller"
          patientId: "87741719-d8a6-f2ac-104b-7885598a0a71"
          race: "Black or African American"
          source: "postgres"
          state: "MA"

          Our sql database has structured data about patients. Its schema:
          ${SQL_SCHEMA}

          If the user asks a question about irrelevant information, redirect them to ask about medical information.
        `,
			}, // information about what to do
			{ role: 'user', content: query }, // the query from the user
		],
	});

	console.log(answer.output_parsed);

	// decide from the string

	// TODO:
	// 1. Ask the LLM for { requiresSQL, requiresVector, semanticQuery } with
	//    openai.responses.parse({ model, input: [system(SYSTEM_PROMPT), ...recent
	//    history, user(query)], temperature: 0,
	//    text: { format: zodTextFormat(PlanSchema, 'plan') } }), then
	//    PlanSchema.parse(response.output_parsed).
	// 2. useSql = requiresSQL; useRag = requiresVector;
	//    needsSearch = useSql || useRag  (both false → a general question).
	// 3. Return { useSql, useRag, needsSearch, semanticQuery: semanticQuery || query }.
}
