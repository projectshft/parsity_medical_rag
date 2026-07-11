/**
 * PII (Personally Identifiable Information) obscuring utilities — YOUR TASK
 *
 * Query-time de-identification for the medical RAG system. The *channels* decide
 * WHEN to obscure (the MCP front-office server always does; /api/query opts in) —
 * your job is the HOW. Implement the functions below so `lib/pii.test.ts` goes
 * green, then wrap the response text in `obscureContent` where data leaves the
 * system (see app/api/query/route.ts and the MCP server).
 *
 * `shouldObscurePII` is provided — it just reads the flag. Everything else is
 * yours. The JSDoc + the test are the contract; make the test pass.
 */

/**
 * Check if PII should be obscured, from an explicit flag or the OBSCURE_PII env.
 * (Provided — this is the plumbing the query path calls on every request.)
 */
export function shouldObscurePII(explicitFlag?: boolean): boolean {
  if (explicitFlag !== undefined) {
    return explicitFlag;
  }
  return process.env.OBSCURE_PII === 'true';
}

/**
 * Generate a consistent pseudonym from a name — the SAME name must always
 * produce the SAME pseudonym (referential consistency). Format: `Patient-XXXX`
 * where XXXX is 4 uppercase alphanumerics. null/undefined/empty → `Patient-XXXX`.
 *
 * Example: "John Smith" → "Patient-A7B3"
 * Hint: hash the normalized name (e.g. sha256 of name.toLowerCase().trim()) and
 * take the first 4 hex chars, uppercased.
 */
export function obscureName(name: string | null | undefined): string {
  throw new Error('Not implemented — your turn! (lib/pii.ts → obscureName)');
}

/**
 * Obscure a date, KEEPING the year (age-based queries still work).
 * null/undefined/invalid → "XXXX-XX-XX".
 *
 * Example: "1985-03-15" → "1985-XX-XX"
 */
export function obscureDate(date: Date | string | null | undefined): string {
  throw new Error('Not implemented — your turn! (lib/pii.ts → obscureDate)');
}

/**
 * Redact location entirely. Any field present → "[LOCATION REDACTED]".
 * All fields empty/absent → "Unknown".
 */
export function obscureLocation(
  city?: string | null,
  state?: string | null,
  postalCode?: string | null
): string {
  throw new Error('Not implemented — your turn! (lib/pii.ts → obscureLocation)');
}

/**
 * Obscure PII patterns in free clinical text — this is the core one, and the
 * shape-agnostic de-identifier the query path relies on. null/undefined → "".
 *
 * Redact at least: names (Mr./Mrs./Dr. + capitalized full names), SSNs, phone
 * numbers, emails, specific dates (keep the year, e.g. "[DATE 1985]"), street
 * addresses, and medical record numbers. The hard part is NOT redacting real
 * clinical words that happen to be capitalized ("Blood Pressure", "Assessment").
 * The test pins down the exact expectations — build to it.
 */
export function obscureContent(text: string | null | undefined): string {
  throw new Error('Not implemented — your turn! (lib/pii.ts → obscureContent)');
}

/**
 * Apply PII obscuring field-by-field to a patient-shaped object, returning a new
 * object (obscure=false → return as-is). Names → obscureName / "[REDACTED]",
 * birth/death dates → obscureDate, phone → "[PHONE REDACTED]", city/state/zip →
 * redacted, and any content/contentPreview/snippet → obscureContent.
 *
 * Note: the text-to-SQL query path uses obscureContent over the whole rendered
 * output instead of this (columns are arbitrary), but the test still checks it.
 */
export function obscurePatient<T extends Record<string, unknown>>(
  patient: T,
  obscure: boolean = true
): T {
  throw new Error('Not implemented — your turn! (lib/pii.ts → obscurePatient)');
}
