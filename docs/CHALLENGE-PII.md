# Challenge: PII Obscuring

Implement PII (Personally Identifiable Information) obscuring utilities for the medical RAG system.

## Learning Objectives

- Understand privacy requirements in healthcare applications
- Practice hash-based pseudonymization techniques
- Implement regex pattern matching for PII detection
- Write clean, testable utility functions

## Background

Healthcare applications must protect patient privacy. Even in development and testing, exposing real patient names, dates, and other identifying information is problematic. Your task is to implement a set of functions that obscure PII while preserving the utility of the data.

## Your Task

Complete the implementation of `lib/pii.ts`. The file contains function signatures with TODO comments explaining what each function should do.

### Functions to Implement

#### 1. `obscureName(name: string): string`
Convert a name to a consistent pseudonym.

**Requirements:**
- Same name should always produce the same pseudonym
- Different names should produce different pseudonyms
- The pseudonym should not reveal the original name
- Format: `"Patient-XXXX"` where XXXX is 4 alphanumeric characters

**Example:**
```typescript
obscureName("John Smith")  // → "Patient-A7B3"
obscureName("John Smith")  // → "Patient-A7B3" (same input = same output)
obscureName("Jane Doe")    // → "Patient-F1C9" (different input = different output)
```

**Hint:** Use a hash function like SHA-256 and take the first 4 hex characters.

#### 2. `obscureDate(date: Date | null): string`
Obscure a date while keeping the year (for age-based queries).

**Requirements:**
- Keep the year for medical context (age calculations)
- Hide the month and day
- Handle null/undefined inputs gracefully

**Example:**
```typescript
obscureDate(new Date("1985-03-15"))  // → "1985-XX-XX"
obscureDate(null)                     // → "XXXX-XX-XX"
```

#### 3. `obscureContent(text: string): string`
Detect and redact PII patterns in clinical text.

**Requirements:**
Detect and replace these patterns:
- SSN: `123-45-6789` → `[SSN REDACTED]`
- Phone: `(555) 123-4567` or `555-123-4567` → `[PHONE REDACTED]`
- Email: `patient@email.com` → `[EMAIL REDACTED]`
- Names with titles: `Mr. John Smith` → `[NAME]`

**Example:**
```typescript
obscureContent("Call Mr. John Smith at 555-123-4567")
// → "Call [NAME] at [PHONE REDACTED]"
```

**Hint:** Use regular expressions with the `replace()` method.

## Getting Started

1. Check out the challenge branch:
   ```bash
   git checkout challenge/pii-obscuring
   ```

2. Open `lib/pii.ts` and read the TODO comments

3. Run the tests to see what's expected:
   ```bash
   npm test lib/pii.test.ts
   ```

4. Implement each function until all tests pass

## Test Cases

Your implementation will be tested against these scenarios:

### Name Obscuring
- ✅ Returns consistent pseudonym for same name
- ✅ Returns different pseudonyms for different names
- ✅ Handles empty/null names gracefully
- ✅ Format matches `Patient-XXXX` pattern

### Date Obscuring
- ✅ Keeps year, hides month/day
- ✅ Handles null dates
- ✅ Handles invalid date strings

### Content Obscuring
- ✅ Detects and redacts SSNs
- ✅ Detects and redacts phone numbers (multiple formats)
- ✅ Detects and redacts email addresses
- ✅ Detects and redacts names with titles
- ✅ Preserves non-PII text

## Bonus Challenges

1. **Address Detection**: Add regex pattern for street addresses
2. **Medical Record Numbers**: Detect MRN patterns like `MRN: 12345`
3. **Date Patterns in Text**: Detect and redact dates like "March 15, 2023"
4. **Contextual Name Detection**: Detect names without titles (harder!)

## Submission

When all tests pass, your implementation is complete. Compare your solution with the reference implementation on the `main` branch.

## Resources

- [Node.js crypto module](https://nodejs.org/api/crypto.html)
- [JavaScript Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions)
- [HIPAA Identifiers](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html)
