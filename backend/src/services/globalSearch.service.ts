import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import { getManagedDepartmentIds, getStaffDepartmentIds, getStudentDepartmentIds, isInstitutionWide } from "./accessScope.service";

export type GlobalSearchResult = { type: "person" | "course" | "notice"; id: string; title: string; subtitle: string; href: string };

/** Global search is scope-first: the database only receives predicates for
 * records the actor is allowed to discover. Unauthorized rows never reach
 * the browser, autocomplete, cache, or response serializer. */
export async function globalSearch(
  institutionId: string,
  actor: AuthenticatedUser,
  query: string
): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const out: GlobalSearchResult[] = [];
  const roles = getCanonicalRoleNames(actor.roles);
  const canPeople = actor.permissions.includes("users.read") || actor.permissions.includes("students.read") || actor.permissions.includes("faculty.read");
  const canCourses = actor.permissions.includes("courses.read") || roles.includes("STUDENT");
  const canNotices = actor.permissions.includes("notices.read") || roles.includes("STUDENT");

  const managedDepartments = !isInstitutionWide(actor) && (roles.includes("HOD") || roles.includes("DEAN") || roles.includes("DIRECTOR"))
    ? await getManagedDepartmentIds(institutionId, actor.id)
    : [];
  const facultyDepartments = roles.includes("FACULTY")
    ? await getStaffDepartmentIds(institutionId, actor.id)
    : [];
  const studentDepartments = roles.includes("STUDENT")
    ? await getStudentDepartmentIds(institutionId, actor.id)
    : [];

  if (canPeople) {
    let people: Array<{ id: string; firstName: string; lastName: string; idNumber: string; email: string }> = [];

    if (isInstitutionWide(actor)) {
      people = await prisma.$queryRaw(Prisma.sql`
        SELECT "id","firstName","lastName","idNumber","email" FROM "users"
        WHERE "institutionId"=${institutionId} AND "isActive"=TRUE AND "deletedAt" IS NULL
          AND ("firstName" ILIKE ${like} OR "lastName" ILIKE ${like} OR "idNumber" ILIKE ${like} OR "email" ILIKE ${like})
        ORDER BY "firstName","lastName" LIMIT 8
      `) as typeof people;
    } else if (roles.includes("STUDENT")) {
      people = await prisma.$queryRaw(Prisma.sql`
        SELECT "id","firstName","lastName","idNumber","email" FROM "users"
        WHERE "id"=${actor.id} AND "institutionId"=${institutionId} AND "isActive"=TRUE AND "deletedAt" IS NULL
      `) as typeof people;
    } else if (roles.includes("HOD") || roles.includes("DEAN") || roles.includes("DIRECTOR")) {
      if (managedDepartments.length) {
        people = await prisma.$queryRaw(Prisma.sql`
          SELECT DISTINCT u."id",u."firstName",u."lastName",u."idNumber",u."email" FROM "users" u
          LEFT JOIN "student_enrollments" se ON se."userId"=u."id" AND se."institutionId"=${institutionId}
          LEFT JOIN "programs" sp ON sp."id"=se."programId"
          LEFT JOIN "employee_profiles" ep ON ep."userId"=u."id" AND ep."institutionId"=${institutionId}
          WHERE u."institutionId"=${institutionId} AND u."isActive"=TRUE AND u."deletedAt" IS NULL
            AND (sp."departmentId" IN (${Prisma.join(managedDepartments)}) OR ep."departmentId" IN (${Prisma.join(managedDepartments)}))
            AND (u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like} OR u."idNumber" ILIKE ${like} OR u."email" ILIKE ${like})
          ORDER BY u."firstName",u."lastName" LIMIT 8
        `) as typeof people;
      }
    } else if (roles.includes("FACULTY") && facultyDepartments.length) {
      people = await prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT u."id",u."firstName",u."lastName",u."idNumber",u."email" FROM "users" u
        LEFT JOIN "student_enrollments" se ON se."userId"=u."id" AND se."institutionId"=${institutionId}
        LEFT JOIN "programs" sp ON sp."id"=se."programId"
        WHERE u."institutionId"=${institutionId} AND u."isActive"=TRUE AND u."deletedAt" IS NULL
          AND sp."departmentId" IN (${Prisma.join(facultyDepartments)})
          AND (u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like} OR u."idNumber" ILIKE ${like} OR u."email" ILIKE ${like})
        ORDER BY u."firstName",u."lastName" LIMIT 8
      `) as typeof people;
    }

    for (const p of people) out.push({ type: "person", id: p.id, title: `${p.firstName} ${p.lastName}`.trim(), subtitle: `${p.idNumber} · ${p.email}`, href: "/erp?tab=people" });
  }

  if (canCourses) {
    let courses: Array<{ id: string; code: string; name: string }> = [];
    if (isInstitutionWide(actor)) {
      courses = await prisma.$queryRaw(Prisma.sql`
        SELECT "id","code","name" FROM "courses" WHERE "institutionId"=${institutionId}
          AND ("code" ILIKE ${like} OR "name" ILIKE ${like}) ORDER BY "code" LIMIT 8
      `) as typeof courses;
    } else if (roles.includes("HOD") || roles.includes("DEAN") || roles.includes("DIRECTOR")) {
      if (managedDepartments.length) {
        courses = await prisma.$queryRaw(Prisma.sql`
          SELECT "id","code","name" FROM "courses" WHERE "institutionId"=${institutionId}
            AND "departmentId" IN (${Prisma.join(managedDepartments)})
            AND ("code" ILIKE ${like} OR "name" ILIKE ${like}) ORDER BY "code" LIMIT 8
        `) as typeof courses;
      }
    } else if (roles.includes("FACULTY")) {
      courses = await prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT c."id",c."code",c."name" FROM "courses" c
        INNER JOIN "course_offerings" co ON co."courseId"=c."id"
        WHERE c."institutionId"=${institutionId} AND co."institutionId"=${institutionId} AND co."facultyId"=${actor.id} AND co."isActive"=TRUE
          AND (c."code" ILIKE ${like} OR c."name" ILIKE ${like}) ORDER BY c."code" LIMIT 8
      `) as typeof courses;
    } else if (roles.includes("STUDENT") && studentDepartments.length) {
      courses = await prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT c."id",c."code",c."name" FROM "courses" c
        INNER JOIN "course_offerings" co ON co."courseId"=c."id"
        INNER JOIN "student_enrollments" se ON se."userId"=${actor.id} AND se."institutionId"=${institutionId} AND se."status"='ACTIVE'
        WHERE c."institutionId"=${institutionId} AND co."institutionId"=${institutionId} AND co."isActive"=TRUE
          AND co."programId"=se."programId"
          AND (c."code" ILIKE ${like} OR c."name" ILIKE ${like}) ORDER BY c."code" LIMIT 8
      `) as typeof courses;
    }
    for (const c of courses) out.push({ type: "course", id: c.id, title: c.code, subtitle: c.name, href: "/erp?tab=academics" });
  }

  if (canNotices) {
    const notices = await prisma.$queryRaw<Array<{ id: string; title: string; body: string }>>(Prisma.sql`
      SELECT "id","title","body" FROM "notices" WHERE "institutionId"=${institutionId}
        AND ("title" ILIKE ${like} OR "body" ILIKE ${like}) AND "publishedAt" <= CURRENT_TIMESTAMP
        AND ("expiresAt" IS NULL OR "expiresAt" >= CURRENT_TIMESTAMP) ORDER BY "createdAt" DESC LIMIT 6
    `);
    for (const n of notices) out.push({ type: "notice", id: n.id, title: n.title, subtitle: n.body.slice(0, 100), href: "/erp?tab=notices" });
  }

  return out.slice(0, 20);
}
