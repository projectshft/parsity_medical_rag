/**
 * The golden set — your few-shot examples, turned into test cases. Week 4.
 *
 * Paste in the examples from your week-3 homework. Each one says which tools a
 * good answer NEEDS, so the eval can check routing without a judge, and
 * optionally what the answer must mention.
 *
 * The seeds below cover each category once. Replace them with your own, and
 * keep the bad ones too: a question your app got wrong is the most useful case
 * in this file.
 */

export type GoldenCase = {
	query: string;
	category: 'sql' | 'notes' | 'sql+notes' | 'scheduling' | 'off-topic';
	/** Tools a good answer must call. [] = should answer without any tool. */
	expectTools: string[];
	/** Words the answer must contain (case-insensitive), when there's a known fact. */
	mustMention?: string[];
};

export const GOLDEN_SET: GoldenCase[] = [
	{
		query: 'How many patients have hypertension?',
		category: 'sql',
		expectTools: ['query_patient_records'],
	},
	{
		query: 'What do the clinical notes say about shortness of breath?',
		category: 'notes',
		expectTools: ['search_clinical_notes'],
	},
	{
		query: 'Which smokers have notes mentioning a cough?',
		category: 'sql+notes',
		expectTools: ['query_patient_records', 'search_clinical_notes'],
	},
	{
		query: 'Book Avery Mueller for next Tuesday at 2pm',
		category: 'scheduling',
		expectTools: ['propose_appointment'],
	},
	{
		query: 'What is the capital of Germany?',
		category: 'off-topic',
		expectTools: [],
	},
];
