import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { andWhere } from "../utils/sqlScope";
import {
  getManagedDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";

/**
 * Directory lookups for searchable selectors.
 *
 * These endpoints exist so the UI never has to ask anyone to paste a
 * UUID. They are deliberately narrow:
 *
 *  - they return only the fields a picker needs (id + label + hint),
 *  - they require an explicit search term of at least two characters,
 *    so they cannot be used to enumerate a tenant,
 *  - results are capped, and
 *  - the rows are filtered by the SAME scope rules the real endpoints
 *    use. An HOD searching students sees their department; a faculty
 *    member searching offerings sees the ones they teach.
 *
 * A picker is a convenience, never an authorization decision: choosing
 * an id here does not grant access to it — the target service still
 * re-checks.
 */

const MAX_RESULTS = 20;
const MIN_SEARCH_LENGTH = 2;

export interface DirectoryOption {
  id: string;
  label: string;
  hint: string | null;
}

function requireSearch(search: string | undefined): string {
  const trimmed = (search ?? "").trim();
  if (trimmed.length < MIN_SEARCH_LENGTH) {
    throw new AppError(
      `Type at least ${MIN_SEARCH_LENGTH} characters to search`,
      400
    );
  }
  return `%${trimmed}%`;
}

/**
 * Students the caller is allowed to see.
 * Mirrors accessScope.assertCanViewStudent, expressed as a filter.
 */
export async function searchStudents(
  institutionId: string,
  actor: AuthenticatedUser,
  search: string | undefined
): Promise<DirectoryOption[]> {
  if (!actor.permissions.includes("students.read")) {
    throw new AppError("You are not authorized to look up students", 403);
  }
  const like = requireSearch(search);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."institutionId" = ${institutionId}`,
    Prisma.sql`u."isActive" = TRUE`,
    Prisma.sql`EXISTS (
      SELECT 1 FROM "user_roles" ur
      JOIN "roles" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id" AND r."name" = 'STUDENT'
    )`,
    Prisma.sql`(
      u."firstName" ILIKE ${like}
      OR u."lastName" ILIKE ${like}
      OR u."email" ILIKE ${like}
      OR EXISTS (
        SELECT 1 FROM "student_enrollments" e
        WHERE e."userId" = u."id" AND e."rollNumber" ILIKE ${like}
      )
    )`,
  ];

  if (!isInstitutionWide(actor) && !actor.roles.includes("STAFF")) {
    if (actor.roles.includes("HOD")) {
      const managed = await getManagedDepartmentIds(institutionId, actor.id);
      if (managed.length === 0) return [];
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "student_enrollments" e
        JOIN "programs" p ON p."id" = e."programId"
        WHERE e."userId" = u."id"
          AND p."departmentId" IN (${Prisma.join(managed)})
      )`);
    } else if (actor.roles.includes("FACULTY")) {
      // Only students this faculty member actually teaches.
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "course_offerings" co
        LEFT JOIN "student_enrollments" e
          ON e."sectionId" = co."sectionId"
         AND e."semesterId" = co."semesterId"
         AND e."status" = 'ACTIVE'
        LEFT JOIN "course_registrations" cr
          ON cr."courseOfferingId" = co."id" AND cr."status" = 'APPROVED'
        WHERE co."facultyId" = ${actor.id}
          AND co."institutionId" = ${institutionId}
          AND (e."userId" = u."id" OR cr."studentId" = u."id")
      )`);
    } else if (actor.roles.includes("PARENT")) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "parent_student_links" l
        WHERE l."parentId" = ${actor.id} AND l."studentId" = u."id"
          AND l."institutionId" = ${institutionId}
      )`);
    } else {
      return [];
    }
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      rollNumber: string | null;
      programName: string | null;
    }>
  >(Prisma.sql`
    SELECT u."id", u."firstName", u."lastName", u."email",
           e."rollNumber", p."name" AS "programName"
    FROM "users" u
    LEFT JOIN LATERAL (
      SELECT en."rollNumber", en."programId"
      FROM "student_enrollments" en
      WHERE en."userId" = u."id" AND en."status" = 'ACTIVE'
      ORDER BY en."enrolledAt" DESC
      LIMIT 1
    ) e ON TRUE
    LEFT JOIN "programs" p ON p."id" = e."programId"
    ${andWhere(conditions)}
    ORDER BY u."firstName" ASC, u."lastName" ASC
    LIMIT ${MAX_RESULTS}
  `);

  return rows.map((row) => ({
    id: row.id,
    label: `${row.firstName} ${row.lastName}`,
    hint: [row.rollNumber, row.programName, row.email]
      .filter(Boolean)
      .join(" · "),
  }));
}

/**
 * Any institution member — used for library borrowers, asset assignees
 * and invigilator pickers. `roles` narrows the result set.
 */
export async function searchUsers(
  institutionId: string,
  actor: AuthenticatedUser,
  search: string | undefined,
  roles?: string[]
): Promise<DirectoryOption[]> {
  if (!actor.permissions.includes("users.read")) {
    throw new AppError("You are not authorized to look up users", 403);
  }
  const like = requireSearch(search);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."institutionId" = ${institutionId}`,
    Prisma.sql`u."isActive" = TRUE`,
    Prisma.sql`(u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like}
      OR u."email" ILIKE ${like})`,
  ];

  if (roles && roles.length > 0) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "user_roles" ur
      JOIN "roles" r ON r."id" = ur."roleId"
      WHERE ur."userId" = u."id" AND r."name" IN (${Prisma.join(roles)})
    )`);
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      roleNames: string | null;
    }>
  >(Prisma.sql`
    SELECT u."id", u."firstName", u."lastName", u."email",
           (SELECT STRING_AGG(r."name", ', ')
              FROM "user_roles" ur
              JOIN "roles" r ON r."id" = ur."roleId"
             WHERE ur."userId" = u."id") AS "roleNames"
    FROM "users" u
    ${andWhere(conditions)}
    ORDER BY u."firstName" ASC, u."lastName" ASC
    LIMIT ${MAX_RESULTS}
  `);

  return rows.map((row) => ({
    id: row.id,
    label: `${row.firstName} ${row.lastName}`,
    hint: [row.email, row.roleNames].filter(Boolean).join(" · "),
  }));
}

/** Course offerings within the caller's teaching or administrative scope. */
export async function searchCourseOfferings(
  institutionId: string,
  actor: AuthenticatedUser,
  search: string | undefined
): Promise<DirectoryOption[]> {
  if (!actor.permissions.includes("course-offerings.read")) {
    throw new AppError(
      "You are not authorized to look up course offerings",
      403
    );
  }
  const like = requireSearch(search);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`co."institutionId" = ${institutionId}`,
    Prisma.sql`co."isActive" = TRUE`,
    Prisma.sql`(c."code" ILIKE ${like} OR c."name" ILIKE ${like}
      OR s."name" ILIKE ${like})`,
  ];

  if (!isInstitutionWide(actor) && !actor.roles.includes("STAFF")) {
    if (actor.roles.includes("HOD")) {
      const managed = await getManagedDepartmentIds(institutionId, actor.id);
      if (managed.length === 0) return [];
      conditions.push(
        Prisma.sql`c."departmentId" IN (${Prisma.join(managed)})`
      );
    } else if (actor.roles.includes("FACULTY")) {
      conditions.push(Prisma.sql`co."facultyId" = ${actor.id}`);
    } else {
      return [];
    }
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      code: string;
      name: string;
      sectionName: string;
      semesterName: string;
    }>
  >(Prisma.sql`
    SELECT co."id", c."code", c."name", s."name" AS "sectionName",
           sem."name" AS "semesterName"
    FROM "course_offerings" co
    JOIN "courses" c ON c."id" = co."courseId"
    JOIN "sections" s ON s."id" = co."sectionId"
    JOIN "semesters" sem ON sem."id" = co."semesterId"
    ${andWhere(conditions)}
    ORDER BY c."code" ASC
    LIMIT ${MAX_RESULTS}
  `);

  return rows.map((row) => ({
    id: row.id,
    label: `${row.code} — ${row.name}`,
    hint: `${row.sectionName} · ${row.semesterName}`,
  }));
}
