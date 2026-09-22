import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * Helpers shared by the domain services that own tables introduced after
 * the Prisma-modelled core (the convention established by
 * feeStructure.service.ts): those services access their tables through
 * parameterized Prisma SQL rather than the generated client.
 *
 * Every helper here forces "institutionId" into the predicate, so a
 * tenant-scoped read or write cannot be expressed without it.
 */

export type SqlClient = Prisma.TransactionClient | typeof prisma;

/** Quotes an identifier that the application — never a client — supplies. */
function ident(name: string): Prisma.Sql {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new AppError("Invalid identifier", 500);
  }
  return Prisma.raw(`"${name}"`);
}

/**
 * Loads a single row of a tenant-owned table by id.
 * Returns null rather than throwing so callers choose 403 vs 404 wording.
 */
export async function findTenantRow<T extends object>(
  client: SqlClient,
  table: string,
  institutionId: string,
  id: string
): Promise<T | null> {
  const rows = await client.$queryRaw<T[]>(Prisma.sql`
    SELECT * FROM ${ident(table)}
    WHERE "id" = ${id} AND "institutionId" = ${institutionId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/** Loads a row of a tenant-owned table or fails with a domain message. */
export async function requireTenantRow<T extends object>(
  client: SqlClient,
  table: string,
  institutionId: string,
  id: string,
  label: string
): Promise<T> {
  const row = await findTenantRow<T>(client, table, institutionId, id);
  if (!row) {
    throw new AppError(`${label} was not found in this institution`, 404);
  }
  return row;
}

/** Confirms a referenced id exists inside the same tenant. */
export async function assertTenantReference(
  client: SqlClient,
  table: string,
  institutionId: string,
  id: string,
  label: string
): Promise<void> {
  const rows = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id" FROM ${ident(table)}
    WHERE "id" = ${id} AND "institutionId" = ${institutionId}
    LIMIT 1
  `);
  if (rows.length === 0) {
    throw new AppError(`${label} was not found in this institution`, 404);
  }
}

/** COUNT(*) for a prepared WHERE fragment. */
export async function countRows(
  client: SqlClient,
  table: string,
  where: Prisma.Sql
): Promise<number> {
  const rows = await client.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count" FROM ${ident(table)} ${where}
  `);
  return Number(rows[0]?.count ?? 0);
}

/** Composes an AND-joined WHERE clause, omitting it entirely when empty. */
export function andWhere(conditions: Prisma.Sql[]): Prisma.Sql {
  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export { ident as sqlIdentifier };

/**
 * Builds the next document number in a per-tenant, per-year series
 * (invoices, receipts, hall tickets). Runs inside the caller's
 * transaction and takes a row lock on the tenant so two concurrent
 * issuances cannot read the same maximum.
 */
export async function nextSequenceNumber(
  tx: Prisma.TransactionClient,
  options: {
    table: string;
    column: string;
    institutionId: string;
    prefix: string;
    width?: number;
  }
): Promise<string> {
  // Serialise issuance per tenant. institutions is the natural lock row:
  // every sequence below is scoped to exactly one institution.
  await tx.$queryRaw`
    SELECT "id" FROM "institutions"
    WHERE "id" = ${options.institutionId}
    FOR UPDATE
  `;

  const like = `${options.prefix}%`;
  const rows = await tx.$queryRaw<{ last: string | null }[]>(Prisma.sql`
    SELECT MAX(${ident(options.column)}) AS "last"
    FROM ${ident(options.table)}
    WHERE "institutionId" = ${options.institutionId}
      AND ${ident(options.column)} LIKE ${like}
  `);

  const width = options.width ?? 5;
  const last = rows[0]?.last;
  const lastSeq = last
    ? parseInt(last.slice(options.prefix.length), 10) || 0
    : 0;

  return `${options.prefix}${String(lastSeq + 1).padStart(width, "0")}`;
}
