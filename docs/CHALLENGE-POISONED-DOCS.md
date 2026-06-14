# Challenge: Defending Against Poisoned Documents

## Overview

In this challenge, you'll explore how RAG systems can be vulnerable to prompt injection attacks through malicious content embedded in retrieved documents, and implement defenses.

## Learning Objectives

- Understand how prompt injection works in RAG systems
- Learn to detect malicious patterns in retrieved content
- Implement content sanitization and sandboxing
- Apply defense-in-depth principles

## Background

RAG (Retrieval-Augmented Generation) systems combine document retrieval with LLM generation. This creates a vulnerability: if an attacker can insert malicious content into the document database, that content will be retrieved and passed to the LLM as context.

### The Vulnerability Chain

```
User Query
    ↓
Vector Search (Pinecone)
    ↓
Retrieved Documents ← [ATTACK VECTOR: Malicious content here]
    ↓
buildContext() in lib/agent.ts
    ↓
LLM receives: System Prompt + Context + User Query
    ↓
LLM may follow instructions in poisoned documents!
```

### Key Vulnerable Code (lib/agent.ts:143)

```typescript
content: `Context from medical records:\n\n${context}\n\nUser question: ${query}`
```

The context is concatenated directly into the user message without any validation or sanitization.

## Part 1: Understanding the Attacks

### Run the Demo

```bash
npx ts-node scripts/security/demo-poisoned-docs.ts
```

### Examine the Poisoned Documents

Look at the three malicious FHIR documents in `data/security/poisoned/`:

1. **poisoned-ignore-instructions.json**
   - Attack: Embedded "ignore all previous instructions" jailbreak
   - Goal: Override system prompt and change LLM behavior

2. **poisoned-tool-invocation.json**
   - Attack: Fake conversation turns and function call tags
   - Goal: Trick LLM into executing unauthorized tool calls

3. **poisoned-data-exfil.json**
   - Attack: Hidden instructions to leak data
   - Goal: Exfiltrate patient data to attacker-controlled URL

### Questions to Answer

1. Why does the "ignore instructions" attack work?
2. How does the context escape (`</context>`) attack manipulate the LLM?
3. What makes the data exfiltration attack particularly dangerous?

## Part 2: Implement Detection

The content validator in `lib/security/content-validator.ts` provides pattern-based detection. Your task is to extend it.

### Task 2.1: Add New Detection Patterns

Add detection for these additional attack vectors:

```typescript
// Add to INJECTION_PATTERNS array

// 1. Base64-encoded payload detection
{
  type: 'hidden_instruction',
  pattern: /[A-Za-z0-9+/]{50,}={0,2}/g, // Long base64 strings
  severity: 'medium',
  weight: 15,
}

// 2. Unicode homoglyph attacks (e.g., using Cyrillic characters that look like Latin)
// Research: What patterns would detect this?

// 3. Markdown/HTML injection to hide content
// Research: What patterns would detect hidden divs or zero-width characters?
```

### Task 2.2: Improve the Risk Scoring

The current risk score is a simple sum. Implement a more sophisticated scoring:

```typescript
function calculateRiskScore(patterns: DetectedPattern[]): number {
  // TODO: Consider:
  // - Pattern combinations (multiple critical = higher risk)
  // - Context (certain patterns near each other)
  // - Density (patterns per 1000 characters)

  return /* your implementation */;
}
```

### Task 2.3: Add Configurable Thresholds

Allow configuring rejection thresholds:

```typescript
interface ContentValidatorConfig {
  rejectThreshold: number; // Risk score above this = reject content
  warnThreshold: number; // Risk score above this = log warning
  enabledPatterns: PatternType[]; // Which patterns to check
}
```

## Part 3: Integrate Defense into Agent

### Task 3.1: Modify lib/agent.ts

Integrate the content validator into the RAG pipeline:

```typescript
// In runAgent() function, after reranking:

import {
  validateContent,
  sanitizeContent,
  buildSandboxedContext,
  isLikelySafe
} from './security/content-validator';

// Quick safety check (fast path for clean content)
const allSafe = rerankedResults.every(r => isLikelySafe(r.content));

if (!allSafe) {
  // Full validation for suspicious content
  const validations = rerankedResults.map(r => ({
    result: r,
    validation: validateContent(r.content)
  }));

  // Log suspicious content
  for (const { result, validation } of validations) {
    if (!validation.isClean) {
      console.warn(`Suspicious content in ${result.metadata.resourceType}:`,
        summarizeValidation(validation));
    }
  }

  // Option A: Reject high-risk content entirely
  // Option B: Sanitize and continue
  // Option C: Use sandboxed context wrapper
}

// Build protected context
const context = buildSandboxedContext(
  rerankedResults.map(r => ({
    content: r.content,
    metadata: r.metadata
  })),
  SYSTEM_PROMPT
);
```

### Task 3.2: Add Configuration via Environment

```bash
# .env
CONTENT_VALIDATION=strict  # strict | warn | disabled
CONTENT_RISK_THRESHOLD=50
```

## Part 4: Test Your Defenses

### Run the Test Suite

```bash
npm test lib/security/content-validator.test.ts
```

### Manual Testing

1. Start the app with your defenses enabled
2. Upload the poisoned documents
3. Query the system and verify the attacks are blocked
4. Check logs for detection alerts

### Create Your Own Attack

Design a novel prompt injection that bypasses the current detection:

```json
{
  "resourceType": "Observation",
  "valueString": "YOUR NOVEL ATTACK HERE"
}
```

Then update the validator to detect it!

## Part 5: Advanced Challenges

### Challenge 5.1: Output Validation

The defenses so far focus on input validation. Implement output validation:

```typescript
function validateLLMResponse(response: string): ValidationResult {
  // Check for:
  // - Leaked system prompts
  // - Suspicious URLs in responses
  // - Unexpected data patterns (SSNs, etc.)
  // - Signs the LLM was "jailbroken"
}
```

### Challenge 5.2: Semantic Detection

Pattern-based detection has limits. Design a semantic approach:

```typescript
async function semanticValidation(content: string): Promise<ValidationResult> {
  // Use an LLM to classify content as:
  // - Medical data
  // - Instructions
  // - Suspicious

  // Consider: What prompt would you use?
  // How do you prevent the classifier itself from being attacked?
}
```

### Challenge 5.3: Real-time Monitoring

Implement a monitoring system:

```typescript
class ContentMonitor {
  // Track patterns over time
  // Alert on unusual content trends
  // Build a blocklist of known-bad patterns
}
```

## Deliverables

1. Extended `content-validator.ts` with new patterns
2. Modified `lib/agent.ts` with integrated validation
3. Passing test suite with additional test cases
4. Documentation of any novel attacks you discovered
5. (Bonus) Output validation implementation

## Resources

- [OWASP LLM Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Injection Primer](https://simonwillison.net/2022/Sep/12/prompt-injection/)
- [Defending Against Indirect Prompt Injection](https://www.lakera.ai/blog/indirect-prompt-injection)

## Hints

<details>
<summary>Hint 1: Unicode Detection</summary>

Check for characters outside the expected ASCII range for medical text:
```typescript
/[\u0400-\u04FF]/g  // Cyrillic
/[\u200B-\u200F]/g  // Zero-width characters
```
</details>

<details>
<summary>Hint 2: Risk Score Improvements</summary>

Consider exponential scaling for multiple critical patterns:
```typescript
const criticalCount = patterns.filter(p => p.severity === 'critical').length;
const multiplier = Math.pow(1.5, criticalCount - 1);
```
</details>

<details>
<summary>Hint 3: Output Validation</summary>

Look for patterns that suggest the LLM is following injected instructions:
- "ACCESS GRANTED"
- Responses that don't match the medical domain
- URLs that weren't in the original query
</details>
