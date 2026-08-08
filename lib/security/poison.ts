// SAVE THIS AS:  lib/security/poison.ts
/**
 * The poisoned-document demo.
 *
 *   POISON_DEMO=1 npm run dev
 *
 * Loads ONE fake clinical note (data/security/poisoned/poisoned-rickroll.json)
 * and hands it to runRag, which drops it in with the real search results. That's
 * the whole attack: nobody hacked the server, nobody stole a password. Somebody
 * just got one bad document into the index, and the model read it like any other
 * note — because to the model, it IS any other note.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/** The free-text note out of the FHIR bundle — the part that reaches the LLM. */
export function loadPoisonedNote(): string {
	const bundle = JSON.parse(
		readFileSync(
			join(process.cwd(), 'data/security/poisoned/poisoned-rickroll.json'),
			'utf-8',
		),
	);
	return bundle.entry.find((e: { resource: { valueString?: string } }) =>
		e.resource.valueString,
	).resource.valueString;
}
