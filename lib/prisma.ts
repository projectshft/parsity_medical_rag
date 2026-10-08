import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export function createPrisma(connectionString = process.env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Singleton Prisma client (avoids exhausting connections during Next.js hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
