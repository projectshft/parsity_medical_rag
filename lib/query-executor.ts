/**
 * Unified query executor
 * Orchestrates SQL queries (Neon) and vector search (Pinecone) based on query analysis
 */

import { analyzeQuery } from './query-analyzer';
import type { QueryAnalysis } from './query-analyzer';
import { executeStructuredQuery, getPatientIdsByConditions } from './sql-queries';
import { searchClinicalNotes } from './vector-search';
import type { QueryResult } from './types';
import { shouldObscurePII, obscureName, obscureDate, obscureLocation, obscureContent } from './pii';

export interface ExecuteQueryOptions {
  vectorTopK?: number;
  sqlLimit?: number;
  obscurePII?: boolean;
}

/**
 * Execute a user query using the hybrid RAG system
 */
export async function executeQuery(
  userQuery: string,
  options: ExecuteQueryOptions = {}
): Promise<QueryResult> {
  const { vectorTopK = 10 } = options;

  // Step 1: Analyze the query
  const analysis = await analyzeQuery(userQuery);

  const result: QueryResult = {
    analysis,
  };

  // Step 2: Execute based on requirements

  // SQL-only queries
  if (analysis.requiresSQL && !analysis.requiresVector) {
    result.sqlResults = await executeStructuredQuery(analysis);
    return result;
  }

  // Vector-only queries
  if (analysis.requiresVector && !analysis.requiresSQL) {
    result.vectorResults = await searchClinicalNotes(
      analysis.semanticQuery || userQuery,
      { topK: vectorTopK }
    );
    return result;
  }

  // Hybrid queries: SQL filter -> Vector search
  if (analysis.requiresSQL && analysis.requiresVector) {
    // First, get patient IDs matching structured criteria
    let patientIds: string[] | undefined;

    if (analysis.entities.conditions?.length) {
      patientIds = await getPatientIdsByConditions(analysis.entities.conditions);
    }

    // Then search clinical notes, filtered to those patients
    const vectorResults = await searchClinicalNotes(
      analysis.semanticQuery || userQuery,
      {
        topK: vectorTopK,
        patientIds: patientIds?.length ? patientIds : undefined,
      }
    );

    // Also get structured data for context
    const sqlResults = await executeStructuredQuery(analysis);

    result.sqlResults = sqlResults;
    result.vectorResults = vectorResults;
    result.mergedResults = {
      structuredData: sqlResults,
      clinicalNotes: vectorResults,
    };

    return result;
  }

  // General questions - try vector search as fallback
  result.vectorResults = await searchClinicalNotes(userQuery, { topK: vectorTopK });
  return result;
}

/**
 * Format query results for LLM context
 */
export function formatResultsForLLM(result: QueryResult, obscurePII?: boolean): string {
  const obscure = shouldObscurePII(obscurePII);
  const parts: string[] = [];

  // Add SQL results
  if (result.sqlResults) {
    switch (result.sqlResults.type) {
      case 'patient_lookup':
        if (result.sqlResults.patients?.length) {
          parts.push('## Matching Patients\n');
          for (const patient of result.sqlResults.patients) {
            parts.push(formatPatientSummary(patient, obscure));
          }
        } else {
          parts.push('No matching patients found.\n');
        }
        break;

      case 'patient_summary':
        if (result.sqlResults.patient) {
          parts.push('## Patient Summary\n');
          parts.push(formatPatientSummary(result.sqlResults.patient, obscure));
        }
        break;

      case 'structured_query':
        if (result.sqlResults.patients?.length) {
          const sortNote = result.sqlResults.ageSort
            ? ` — sorted ${result.sqlResults.ageSort} first; the FIRST listed is the ${result.sqlResults.ageSort}`
            : '';
          parts.push(`## Matching Patients (${result.sqlResults.patients.length}${sortNote})\n`);
          for (const patient of result.sqlResults.patients.slice(0, 10)) {
            // Handle both direct patients and {patient, observations} objects
            const p = patient.patient || patient;
            const rawName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
            const name = obscure ? obscureName(rawName) : rawName;
            const dob = obscure
              ? obscureDate(p.birthDate)
              : (p.birthDate?.toISOString().split('T')[0] || 'unknown');
            parts.push(`- **${name}** (${p.gender}, born ${dob})`);
            if (patient.observations?.length) {
              const obs = patient.observations[0];
              parts.push(`  - ${obs.display}: ${obs.valueNumber} ${obs.unit || ''}`);
            }
            if (patient.conditions?.length) {
              parts.push(`  - Conditions: ${patient.conditions.map((c: any) => c.display).join(', ')}`);
            }
          }
          parts.push('');
        } else {
          // Be explicit so the assistant says "there are none" rather than
          // "I don't have that information" on a genuinely empty result set.
          parts.push('## Matching Patients (0)\n');
          parts.push('No patients in the records match this filter.\n');
        }
        break;

      case 'population_analytics': {
        parts.push(`## Population Statistics\n`);
        const label = [result.sqlResults.condition, result.sqlResults.ageFilter
          ? `${result.sqlResults.ageFilter.operator === 'lt' || result.sqlResults.ageFilter.operator === 'lte' ? 'under' : 'over'} ${result.sqlResults.ageFilter.value}`
          : null].filter(Boolean).join(', ');
        parts.push(`- Patients${label ? ` (${label})` : ''}: **${result.sqlResults.count}**\n`);
        // Surface a sample of the actual patients (youngest first, with age) so
        // follow-ups like "who is the youngest?" or "name a few" can be answered.
        if (result.sqlResults.patients?.length) {
          const sample = result.sqlResults.patients.slice(0, 25);
          parts.push(`Sample of matching patients (youngest first, ${sample.length} of ${result.sqlResults.count}):`);
          for (const p of sample) {
            const rawName = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
            const name = obscure ? obscureName(rawName) : rawName;
            const dob = obscure
              ? obscureDate(p.birthDate)
              : (p.birthDate?.toISOString().split('T')[0] || 'unknown');
            const age = p.birthDate
              ? Math.floor((Date.now() - p.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000))
              : null;
            parts.push(`- **${name}** (${p.gender}, born ${dob}${age !== null ? `, age ~${age}` : ''})`);
          }
          parts.push('');
        }
        break;
      }
    }
  }

  // Add vector search results
  if (result.vectorResults?.length) {
    parts.push('## Relevant Clinical Notes\n');
    for (const note of result.vectorResults.slice(0, 5)) {
      const patientName = obscure ? obscureName(note.patientName) : (note.patientName || 'Patient');
      const contentPreview = obscure ? obscureContent(note.contentPreview) : note.contentPreview;
      parts.push(`### ${patientName} - ${note.documentType} (${note.date || 'undated'})`);
      parts.push(`Score: ${note.score.toFixed(3)}`);
      parts.push('```');
      parts.push(contentPreview);
      parts.push('```\n');
    }
  }

  return parts.join('\n');
}

/**
 * Format a patient object for display
 */
function formatPatientSummary(patient: any, obscure: boolean = false): string {
  const lines: string[] = [];

  const rawName = [patient.firstName, patient.lastName].filter(Boolean).join(' ') || 'Unknown';
  const name = obscure ? obscureName(rawName) : rawName;
  const dob = obscure
    ? obscureDate(patient.birthDate)
    : (patient.birthDate?.toISOString().split('T')[0] || 'Unknown');
  const location = obscure
    ? obscureLocation(patient.city, patient.state)
    : [patient.city, patient.state].filter(Boolean).join(', ');

  lines.push(`### ${name}`);
  lines.push(`- **ID**: ${patient.id}`);
  lines.push(`- **Gender**: ${patient.gender || 'Unknown'}`);
  lines.push(`- **Birth Date**: ${dob}`);
  if (patient.city) {
    lines.push(`- **Location**: ${location}`);
  }

  // Active conditions
  if (patient.conditions?.length) {
    lines.push('\n**Active Conditions:**');
    for (const condition of patient.conditions.slice(0, 10)) {
      const onset = condition.onsetDate?.toISOString().split('T')[0] || '';
      lines.push(`- ${condition.display}${onset ? ` (since ${onset})` : ''}`);
    }
  }

  // Current medications
  if (patient.medications?.length) {
    lines.push('\n**Current Medications:**');
    for (const med of patient.medications.slice(0, 10)) {
      lines.push(`- ${med.display}${med.dosage ? ` - ${med.dosage}` : ''}`);
    }
  }

  // Recent observations
  if (patient.observations?.length) {
    lines.push('\n**Recent Observations:**');
    for (const obs of patient.observations.slice(0, 10)) {
      const date = obs.effectiveDate?.toISOString().split('T')[0] || '';
      const value = obs.valueNumber !== null
        ? `${obs.valueNumber} ${obs.unit || ''}`
        : obs.valueString || 'N/A';
      lines.push(`- ${obs.display}: ${value}${date ? ` (${date})` : ''}`);
    }
  }

  // Allergies
  if (patient.allergies?.length) {
    lines.push('\n**Allergies:**');
    for (const allergy of patient.allergies) {
      lines.push(`- ${allergy.display} (${allergy.criticality || 'unknown criticality'})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}
