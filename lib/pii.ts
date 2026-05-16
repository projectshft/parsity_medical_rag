/**
 * PII (Personally Identifiable Information) obscuring utilities
 *
 * STUDENT CHALLENGE: Implement the functions below to pass all tests.
 * Run tests with: npm test lib/pii.test.ts
 *
 * See docs/CHALLENGE-PII.md for detailed instructions.
 */

// You may need these imports:
// import { createHash } from 'crypto';

/**
 * Check if PII should be obscured based on environment or explicit flag
 */
export function shouldObscurePII(explicitFlag?: boolean): boolean {
  if (explicitFlag !== undefined) {
    return explicitFlag;
  }
  return process.env.OBSCURE_PII === 'true';
}

/**
 * Generate a consistent pseudonym from a name
 *
 * TODO: Implement this function
 *
 * Requirements:
 * - Same name should always produce the same pseudonym (deterministic)
 * - Different names should produce different pseudonyms
 * - The pseudonym should not reveal the original name
 * - Format: "Patient-XXXX" where XXXX is 4 uppercase alphanumeric characters
 * - Handle null/undefined/empty string by returning "Patient-XXXX"
 * - Be case-insensitive ("John Smith" and "john smith" → same result)
 *
 * Hints:
 * - Use a hash function like SHA-256 from Node's crypto module
 * - Take the first 4 characters of the hash and uppercase them
 *
 * Example:
 *   obscureName("John Smith") → "Patient-A7B3"
 *   obscureName("John Smith") → "Patient-A7B3" (same input = same output)
 *   obscureName("Jane Doe")   → "Patient-F1C9" (different input = different output)
 */
export function obscureName(name: string | null | undefined): string {
  // TODO: Implement this function
  throw new Error('Not implemented - your turn!');
}

/**
 * Obscure a date, keeping the year for age-based queries
 *
 * TODO: Implement this function
 *
 * Requirements:
 * - Keep the year (important for age calculations in medical context)
 * - Replace month and day with "XX"
 * - Handle Date objects and string dates
 * - Handle null/undefined by returning "XXXX-XX-XX"
 * - Handle invalid date strings by returning "XXXX-XX-XX"
 *
 * Example:
 *   obscureDate(new Date("1985-03-15")) → "1985-XX-XX"
 *   obscureDate("1990-06-20")            → "1990-XX-XX"
 *   obscureDate(null)                    → "XXXX-XX-XX"
 */
export function obscureDate(date: Date | string | null | undefined): string {
  // TODO: Implement this function
  throw new Error('Not implemented - your turn!');
}

/**
 * Obscure location data completely
 *
 * TODO: Implement this function
 *
 * Requirements:
 * - Return "[LOCATION REDACTED]" if any location field is present
 * - Return "Unknown" if all fields are null/undefined/empty
 *
 * Example:
 *   obscureLocation("Boston", "MA", "02101") → "[LOCATION REDACTED]"
 *   obscureLocation("Boston", null, null)    → "[LOCATION REDACTED]"
 *   obscureLocation(null, null, null)        → "Unknown"
 */
export function obscureLocation(
  city?: string | null,
  state?: string | null,
  postalCode?: string | null
): string {
  // TODO: Implement this function
  throw new Error('Not implemented - your turn!');
}

/**
 * Obscure PII patterns in clinical text content
 *
 * TODO: Implement this function
 *
 * Requirements:
 * Detect and replace these patterns:
 *
 * 1. SSN (Social Security Numbers):
 *    - Pattern: 123-45-6789
 *    - Replacement: [SSN REDACTED]
 *
 * 2. Phone Numbers:
 *    - Patterns: (555) 123-4567, 555-123-4567, 555.123.4567
 *    - Replacement: [PHONE REDACTED]
 *
 * 3. Email Addresses:
 *    - Pattern: user@domain.com
 *    - Replacement: [EMAIL REDACTED]
 *
 * 4. Names with titles:
 *    - Pattern: Mr./Mrs./Ms./Dr. followed by name(s)
 *    - Replacement: [NAME]
 *
 * Handle null/undefined by returning empty string.
 * Preserve all non-PII text.
 *
 * Hints:
 * - Use regular expressions with the String.replace() method
 * - Use the /g flag for global replacement
 * - Use the /i flag for case-insensitive matching where appropriate
 *
 * Example:
 *   obscureContent("Call Mr. John Smith at 555-123-4567")
 *   → "Call [NAME] at [PHONE REDACTED]"
 */
export function obscureContent(text: string | null | undefined): string {
  // TODO: Implement this function
  throw new Error('Not implemented - your turn!');
}

/**
 * Apply PII obscuring to a patient object
 *
 * This function is provided for you - no changes needed!
 * It uses the functions you implement above.
 */
export function obscurePatient<T extends Record<string, unknown>>(
  patient: T,
  obscure: boolean = true
): T {
  if (!obscure) return patient;

  const result = { ...patient } as Record<string, unknown>;

  // Obscure name fields
  if ('name' in result) {
    result.name = obscureName(result.name as string | null);
  }
  if ('givenName' in result) {
    result.givenName = '[REDACTED]';
  }
  if ('familyName' in result) {
    result.familyName = '[REDACTED]';
  }
  if ('patientName' in result) {
    result.patientName = obscureName(result.patientName as string | null);
  }

  // Obscure date fields
  if ('birthDate' in result) {
    result.birthDate = obscureDate(result.birthDate as Date | string | null);
  }

  // Obscure location fields
  if ('city' in result || 'state' in result || 'postalCode' in result) {
    const location = obscureLocation(
      result.city as string | null,
      result.state as string | null,
      result.postalCode as string | null
    );
    if ('city' in result) result.city = location === '[LOCATION REDACTED]' ? '[CITY]' : result.city;
    if ('state' in result) result.state = location === '[LOCATION REDACTED]' ? '[STATE]' : result.state;
    if ('postalCode' in result) result.postalCode = location === '[LOCATION REDACTED]' ? '[ZIP]' : result.postalCode;
  }

  // Obscure content fields
  if ('content' in result && typeof result.content === 'string') {
    result.content = obscureContent(result.content);
  }
  if ('contentPreview' in result && typeof result.contentPreview === 'string') {
    result.contentPreview = obscureContent(result.contentPreview);
  }
  if ('snippet' in result && typeof result.snippet === 'string') {
    result.snippet = obscureContent(result.snippet);
  }

  return result as T;
}
