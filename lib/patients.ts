import { prisma } from './prisma';

/**
 * Look up patients by (partial) name.
 *
 * Used by the scheduling flow to confirm a named patient actually exists before
 * offering an appointment. (The old hand-coded query builders are gone — the
 * chat SQL agent now writes its own SQL in lib/agents/sql.ts; this one small
 * lookup stays because scheduling needs an exact patient object, not free text.)
 */
export async function findPatientByName(name: string) {
  const terms = name.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];

  return prisma.patient.findMany({
    where: {
      AND: terms.map((term) => ({
        OR: [
          { firstName: { contains: term, mode: 'insensitive' as const } },
          { lastName: { contains: term, mode: 'insensitive' as const } },
        ],
      })),
    },
    take: 5,
  });
}
