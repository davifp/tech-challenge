import { Prisma } from '../../generated/prisma/client';

const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';
const UNIQUE_CONSTRAINT_KIND = 'UniqueConstraintViolation';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function includesField(value: unknown, field: string): boolean {
  if (typeof value === 'string') return value.includes(field);
  return Array.isArray(value) && value.some((item) => item === field);
}

function driverConstraintIncludes(meta: UnknownRecord, field: string): boolean {
  const driverError = asRecord(meta.driverAdapterError);
  const cause = asRecord(driverError?.cause);
  if (cause?.kind !== UNIQUE_CONSTRAINT_KIND) return false;
  const constraint = asRecord(cause.constraint);
  return includesField(constraint?.fields, field) || includesField(constraint?.index, field);
}

export function isPrismaUniqueConflictOn(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== PRISMA_UNIQUE_CONSTRAINT_CODE) return false;
  const meta = asRecord(error.meta);
  if (!meta) return false;
  return includesField(meta.target, field) || driverConstraintIncludes(meta, field);
}
