/**
 * PII (Personally Identifiable Information) obscuring utilities
 *
 * Query-time obscuring for patient data in the medical RAG system.
 * Enable with OBSCURE_PII=true environment variable or per-request flag.
 */

import { createHash } from 'crypto';

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
 * Same name always produces the same pseudonym for referential consistency
 *
 * Example: "John Smith" → "Patient-A7B3"
 */
export function obscureName(name: string | null | undefined): string {
  if (!name) return 'Patient-XXXX';

  // Create a hash of the name for consistency
  const hash = createHash('sha256').update(name.toLowerCase().trim()).digest('hex');

  // Take first 4 characters and make them alphanumeric
  const pseudonymId = hash.substring(0, 4).toUpperCase();

  return `Patient-${pseudonymId}`;
}

/**
 * Obscure a date, keeping the year for age-based queries
 *
 * Example: "1985-03-15" → "1985-XX-XX"
 */
export function obscureDate(date: Date | string | null | undefined): string {
  if (!date) return 'XXXX-XX-XX';

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return 'XXXX-XX-XX';
  }

  const year = dateObj.getFullYear();
  return `${year}-XX-XX`;
}

/**
 * Obscure location data completely
 *
 * Example: "Boston, MA 02101" → "[LOCATION REDACTED]"
 */
export function obscureLocation(
  city?: string | null,
  state?: string | null,
  postalCode?: string | null
): string {
  if (!city && !state && !postalCode) {
    return 'Unknown';
  }
  return '[LOCATION REDACTED]';
}

/**
 * Pattern definition for PII detection
 */
interface PIIPattern {
  pattern: RegExp;
  replacement: string | ((match: string) => string);
  contextual?: boolean;
}

/**
 * Patterns for detecting PII in clinical text
 */
const PII_PATTERNS: PIIPattern[] = [
  // Names - common patterns in clinical notes (Mr./Mrs./Dr. followed by name)
  { pattern: /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?/g, replacement: '[NAME]' },

  // Full names - capitalized words that look like names (2-3 word sequences)
  { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\b/g, replacement: '[NAME]', contextual: true },

  // Social Security Numbers
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN REDACTED]' },
  { pattern: /\bSSN:?\s*\d{3}-?\d{2}-?\d{4}\b/gi, replacement: '[SSN REDACTED]' },

  // Phone numbers
  { pattern: /\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE REDACTED]' },
  { pattern: /\b(phone|tel|telephone|cell|mobile):?\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi, replacement: '[PHONE REDACTED]' },

  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL REDACTED]' },

  // Dates (except year-only which we keep for medical context)
  // Match MM/DD/YYYY, MM-DD-YYYY, Month DD, YYYY formats
  { pattern: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{4})\b/g, replacement: (match: string) => {
    const year = match.slice(-4);
    return `[DATE ${year}]`;
  }},
  { pattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, replacement: (match: string) => {
    const yearMatch = match.match(/\d{4}/);
    return yearMatch ? `[DATE ${yearMatch[0]}]` : '[DATE REDACTED]';
  }},

  // Medical record numbers
  { pattern: /\b(MRN|Medical Record Number|Record #):?\s*[A-Z0-9-]+\b/gi, replacement: '[MRN REDACTED]' },

  // Addresses (street patterns)
  { pattern: /\b\d+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct)\b\.?/gi, replacement: '[ADDRESS REDACTED]' },

  // Zip codes
  { pattern: /\b\d{5}(-\d{4})?\b/g, replacement: '[ZIP]', contextual: true },
];

// Words that commonly appear capitalized but aren't names
const NON_NAME_WORDS = new Set([
  // Medical terms
  'Patient', 'Chief', 'Complaint', 'History', 'Present', 'Illness', 'Past', 'Medical',
  'Social', 'Family', 'Review', 'Systems', 'Physical', 'Examination', 'Assessment',
  'Plan', 'Diagnosis', 'Treatment', 'Medication', 'Allergies', 'Vital', 'Signs',
  'Blood', 'Pressure', 'Heart', 'Rate', 'Temperature', 'Respiratory', 'Weight',
  'Height', 'BMI', 'Oxygen', 'Saturation', 'Pain', 'Level', 'General', 'Appearance',
  'HEENT', 'Cardiovascular', 'Pulmonary', 'Abdominal', 'Neurological', 'Psychiatric',
  'Musculoskeletal', 'Skin', 'Extremities', 'Labs', 'Imaging', 'Results', 'Follow',
  'Return', 'Referral', 'Prescription', 'Instructions', 'Education', 'Discussion',
  // Common words that appear at sentence starts
  'The', 'This', 'That', 'These', 'Those', 'Here', 'There', 'What', 'When', 'Where',
  'Which', 'Who', 'How', 'Why', 'If', 'Then', 'And', 'But', 'Or', 'Not', 'For',
  'With', 'From', 'Into', 'During', 'Before', 'After', 'Above', 'Below', 'Between',
  // Days and months (handled separately)
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  // Units and measurements
  'Normal', 'Abnormal', 'Positive', 'Negative', 'Left', 'Right', 'Upper', 'Lower',
  'Mild', 'Moderate', 'Severe', 'Acute', 'Chronic', 'Primary', 'Secondary',
]);

/**
 * Check if a potential name match is likely a real name
 */
function isLikelyName(match: string): boolean {
  const words = match.split(/\s+/);

  // If all words are in the non-name list, it's not a name
  if (words.every(word => NON_NAME_WORDS.has(word))) {
    return false;
  }

  // If the first word is a common non-name word and there's only 2 words
  if (words.length === 2 && NON_NAME_WORDS.has(words[0])) {
    return false;
  }

  return true;
}

/**
 * Obscure PII patterns in clinical text content
 *
 * Redacts:
 * - Names (Mr./Mrs./Dr. patterns, and potential full names)
 * - SSNs
 * - Phone numbers
 * - Email addresses
 * - Specific dates (keeps year)
 * - Addresses
 * - Medical record numbers
 */
export function obscureContent(text: string | null | undefined): string {
  if (!text) return '';

  let result = text;

  for (const { pattern, replacement, contextual } of PII_PATTERNS) {
    if (contextual) {
      // For contextual patterns, we need more careful matching
      result = result.replace(pattern, (match) => {
        if (pattern.source.includes('[A-Z][a-z]+\\s+[A-Z]')) {
          // This is the name pattern - check if it's likely a real name
          if (!isLikelyName(match)) {
            return match; // Keep original if not a name
          }
        }
        if (typeof replacement === 'function') {
          return replacement(match);
        }
        return replacement;
      });
    } else {
      if (typeof replacement === 'function') {
        result = result.replace(pattern, replacement);
      } else {
        result = result.replace(pattern, replacement);
      }
    }
  }

  return result;
}

/**
 * Apply PII obscuring to a patient object
 * Returns a new object with obscured fields
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
  // New-schema name fields (prisma/schema.prisma stores first/last separately)
  if ('firstName' in result) {
    result.firstName = '[REDACTED]';
  }
  if ('lastName' in result) {
    result.lastName = '[REDACTED]';
  }
  // Death date deserves the same treatment as birth date
  if ('deathDate' in result && result.deathDate) {
    result.deathDate = obscureDate(result.deathDate as Date | string | null);
  }
  // Phone numbers are direct identifiers
  if ('phone' in result && result.phone) {
    result.phone = '[PHONE REDACTED]';
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
