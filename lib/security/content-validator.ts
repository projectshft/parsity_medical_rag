/**
 * Content validation — defending against poisoned documents. Week 5, in class.
 *
 * A note in the index can carry instructions ("ignore previous instructions…")
 * that land in the LLM's context as if they were trusted. Samples to attack
 * with: data/security/poisoned/*.json. Visual: visuals/content-validation.html.
 *
 * There's no perfect defense. The goal is to see the attack, then make it harder.
 */

export function validateContent(content: string): { isClean: boolean } {
	// TODO (in class): detect injected instructions in retrieved content.
	throw new Error('Not built yet — Week 5 (lib/security/content-validator.ts)');
}
