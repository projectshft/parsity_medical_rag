/**
 * Prisma query builders for structured medical data
 *
 * Ported to the FHIR-id schema (prisma/schema.prisma): patients, conditions,
 * observations, medications. Patient.id IS the FHIR id.
 */

import { prisma } from './prisma';
import type { QueryAnalysis } from './query-analyzer';

// Common condition code mappings (SNOMED-CT display names)
const CONDITION_MAPPINGS: Record<string, string[]> = {
  diabetes: ['diabetes', 'diabetic', 'diabetes mellitus', 'type 2 diabetes', 'prediabetes'],
  hypertension: ['hypertension', 'high blood pressure', 'hypertensive'],
  obesity: ['obesity', 'obese', 'body mass index 30+'],
  asthma: ['asthma', 'asthmatic'],
  copd: ['copd', 'chronic obstructive pulmonary', 'emphysema'],
  depression: ['depression', 'depressive disorder', 'major depressive'],
  anxiety: ['anxiety', 'anxiety disorder', 'generalized anxiety'],
  chf: ['heart failure', 'congestive heart failure', 'cardiac failure'],
};

// Lab code mappings (LOINC codes and display names)
const LAB_MAPPINGS: Record<string, { codes: string[]; display: string[] }> = {
  a1c: {
    codes: ['4548-4', '17856-6'],
    display: ['hemoglobin a1c', 'hba1c', 'glycated hemoglobin'],
  },
  glucose: {
    codes: ['2339-0', '2345-7'],
    display: ['glucose', 'blood glucose', 'fasting glucose'],
  },
  cholesterol: {
    codes: ['2093-3'],
    display: ['cholesterol', 'total cholesterol'],
  },
  ldl: {
    codes: ['2089-1'],
    display: ['ldl', 'ldl cholesterol', 'low density lipoprotein'],
  },
  hdl: {
    codes: ['2085-9'],
    display: ['hdl', 'hdl cholesterol', 'high density lipoprotein'],
  },
  creatinine: {
    codes: ['2160-0'],
    display: ['creatinine', 'serum creatinine'],
  },
  bmi: {
    codes: ['39156-5'],
    display: ['bmi', 'body mass index'],
  },
};

/**
 * Look up a specific patient by name
 */
export async function findPatientByName(name: string) {
  const searchTerms = name.toLowerCase().split(' ');

  // Search for patients matching all terms
  const patients = await prisma.patient.findMany({
    where: {
      AND: searchTerms.map(term => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' as const } },
          { lastName: { contains: term, mode: 'insensitive' as const } },
        ],
      })),
    },
    include: {
      conditions: {
        where: { clinicalStatus: 'active' },
        orderBy: { onsetDate: 'desc' },
      },
      medications: {
        where: { status: 'active' },
        orderBy: { authoredOn: 'desc' },
      },
      observations: {
        orderBy: { effectiveDate: 'desc' },
        take: 20,
      },
    },
    take: 5,
  });

  return patients;
}

/**
 * Get full patient summary by ID (FHIR id)
 */
export async function getPatientSummary(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      conditions: {
        orderBy: { onsetDate: 'desc' },
      },
      medications: {
        orderBy: { authoredOn: 'desc' },
      },
      observations: {
        orderBy: { effectiveDate: 'desc' },
        take: 50,
      },
    },
  });

  return patient;
}

/**
 * Find patients by conditions
 */
export async function findPatientsByConditions(conditions: string[]) {
  // Expand condition terms using mappings
  const searchTerms: string[] = [];
  for (const condition of conditions) {
    const lower = condition.toLowerCase();
    const mapping = CONDITION_MAPPINGS[lower];
    if (mapping) {
      searchTerms.push(...mapping);
    } else {
      searchTerms.push(lower);
    }
  }

  const patients = await prisma.patient.findMany({
    where: {
      conditions: {
        some: {
          OR: searchTerms.map(term => ({
            display: { contains: term, mode: 'insensitive' as const },
          })),
        },
      },
    },
    include: {
      conditions: {
        where: {
          OR: searchTerms.map(term => ({
            display: { contains: term, mode: 'insensitive' as const },
          })),
        },
      },
    },
    take: 100,
  });

  return patients;
}

/**
 * Find patients by lab values with numeric filters
 */
export async function findPatientsByLabValues(
  labCode: string,
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte',
  value: number
) {
  // Map lab name to codes and display names
  const labInfo = LAB_MAPPINGS[labCode.toLowerCase()];

  const whereConditions: any[] = [];
  if (labInfo) {
    // Search by LOINC codes
    whereConditions.push({
      code: { in: labInfo.codes },
    });
    // Also search by display name
    for (const displayName of labInfo.display) {
      whereConditions.push({
        display: { contains: displayName, mode: 'insensitive' },
      });
    }
  } else {
    // Direct search
    whereConditions.push({
      display: { contains: labCode, mode: 'insensitive' },
    });
  }

  // Map operator to Prisma
  const numericFilter: Record<string, number> = {};
  switch (operator) {
    case 'gt': numericFilter['gt'] = value; break;
    case 'lt': numericFilter['lt'] = value; break;
    case 'gte': numericFilter['gte'] = value; break;
    case 'lte': numericFilter['lte'] = value; break;
    case 'eq': numericFilter['equals'] = value; break;
  }

  const observations = await prisma.observation.findMany({
    where: {
      AND: [
        { OR: whereConditions },
        { valueNumber: numericFilter },
      ],
    },
    include: {
      patient: true,
    },
    orderBy: { effectiveDate: 'desc' },
    take: 100,
  });

  // Group by patient
  const patientMap = new Map<string, { patient: any; observations: any[] }>();
  for (const obs of observations) {
    if (!patientMap.has(obs.patientId)) {
      patientMap.set(obs.patientId, { patient: obs.patient, observations: [] });
    }
    patientMap.get(obs.patientId)!.observations.push(obs);
  }

  return Array.from(patientMap.values());
}

/**
 * Count patients with specific conditions (population analytics)
 */
export async function countPatientsByCondition(condition: string) {
  const lower = condition.toLowerCase();
  const mapping = CONDITION_MAPPINGS[lower];
  const searchTerms = mapping || [lower];

  const count = await prisma.patient.count({
    where: {
      conditions: {
        some: {
          OR: searchTerms.map(term => ({
            display: { contains: term, mode: 'insensitive' as const },
          })),
        },
      },
    },
  });

  return count;
}

/**
 * Get patient IDs matching conditions (for hybrid queries with Pinecone)
 */
export async function getPatientIdsByConditions(conditions: string[]): Promise<string[]> {
  const patients = await findPatientsByConditions(conditions);
  return patients.map(p => p.id);
}

/**
 * Execute query based on analysis
 */
export async function executeStructuredQuery(analysis: QueryAnalysis) {
  const { intent, entities } = analysis;

  switch (intent) {
    case 'patient_lookup':
      if (entities.patientName) {
        const patients = await findPatientByName(entities.patientName);
        return { type: 'patient_lookup', patients };
      }
      if (entities.patientId) {
        const patient = await getPatientSummary(entities.patientId);
        return { type: 'patient_summary', patient };
      }
      return { type: 'error', message: 'No patient identifier provided' };

    case 'patient_summary':
      if (entities.patientId) {
        const patient = await getPatientSummary(entities.patientId);
        return { type: 'patient_summary', patient };
      }
      if (entities.patientName) {
        const patients = await findPatientByName(entities.patientName);
        if (patients.length === 1) {
          const patient = await getPatientSummary(patients[0].id);
          return { type: 'patient_summary', patient };
        }
        return { type: 'patient_lookup', patients };
      }
      return { type: 'error', message: 'No patient identifier provided' };

    case 'structured_query':
      // Handle condition filters
      if (entities.conditions?.length) {
        // Check for numeric filters on labs
        if (entities.numericFilters?.length) {
          const filter = entities.numericFilters[0];
          const labResults = await findPatientsByLabValues(
            filter.field,
            filter.operator,
            filter.value
          );
          // Filter to only patients with the conditions
          const conditionPatients = await findPatientsByConditions(entities.conditions);
          const conditionIds = new Set(conditionPatients.map(p => p.id));
          const filtered = labResults.filter(r => conditionIds.has(r.patient.id));
          return { type: 'structured_query', patients: filtered };
        }
        const patients = await findPatientsByConditions(entities.conditions);
        return { type: 'structured_query', patients };
      }
      // Handle lab value filters only
      if (entities.numericFilters?.length) {
        const filter = entities.numericFilters[0];
        const results = await findPatientsByLabValues(
          filter.field,
          filter.operator,
          filter.value
        );
        return { type: 'structured_query', patients: results };
      }
      return { type: 'error', message: 'No filter criteria provided' };

    case 'population_analytics':
      if (entities.conditions?.length) {
        const condition = entities.conditions[0];
        const count = await countPatientsByCondition(condition);
        return {
          type: 'population_analytics',
          count,
          condition,
        };
      }
      // Total patient count
      const totalCount = await prisma.patient.count();
      return { type: 'population_analytics', count: totalCount };

    case 'hybrid_query':
      // For hybrid queries, return patient IDs to filter Pinecone results
      if (entities.conditions?.length) {
        const patientIds = await getPatientIdsByConditions(entities.conditions);
        return { type: 'hybrid_filter', patientIds };
      }
      return { type: 'hybrid_filter', patientIds: [] };

    default:
      return { type: 'no_sql_needed' };
  }
}
