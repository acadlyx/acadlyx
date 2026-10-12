import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import {
  getManagedDepartmentIds,
  getDirectorDepartmentIds,
  getStaffDepartmentIds,
  getStudentDepartmentIds,
  isInstitutionWide,
  isDirectorScoped,
} from "./accessScope.service";

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

  const institutionWide = isInstitutionWide(actor);
  const directorWorkspace = !institutionWide && isDirectorScoped(actor);
  const departmentWorkspace = !institutionWide && !directorWorkspace &&
    (roles.includes("HOD") || roles.includes("DEAN"));
  const facultyWorkspace = !institutionWide && !directorWorkspace && !departmentWorkspace && roles.includes("FACULTY");
  const studentWorkspace = !institutionWide && !directorWorkspace && !departmentWorkspace && !facultyWorkspace && roles.includes("STUDENT");
  const parentWorkspace = !institutionWide && !directorWorkspace && !departmentWorkspace && !facultyWorkspace && !studentWorkspace && roles.includes("PARENT");

  const managedDepartments = directorWorkspace
    ? await getDirectorDepartmentIds(institutionId, actor.id)
    : departmentWorkspace
      ? await getManagedDepartmentIds(institutionId, actor.id)
      : [];
  const facultyDepartments = facultyWorkspace
    ? await getStaffDepartmentIds(institutionId, actor.id)
    : [];
  const studentDepartments = studentWorkspace
    ? await getStudentDepartmentIds(institutionId, actor.id)
    : [];
  const parentDepartmentIds = parentWorkspace
    ? await (async () => {
        const links = await prisma.parentStudentLink.findMany({
          where: { institutionId, parentId: actor.id },
          select: {
            student: {
              select: {
                studentEnrollments: {
                  where: { institutionId, status: "ACTIVE" },
                  select: { program: { select: { departmentId: true } } },
                },
              },
            },
          },
        });
        return Array.from(new Set(links.flatMap((link) =>
          link.student.studentEnrollments.map((enrollment) => enrollment.program.departmentId)
        )));
      })()
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
    } else if (studentWorkspace) {
      people = await prisma.$queryRaw(Prisma.sql`
        SELECT "id","firstName","lastName","idNumber","email" FROM "users"
        WHERE "id"=${actor.id} AND "institutionId"=${institutionId} AND "isActive"=TRUE AND "deletedAt" IS NULL
      `) as typeof people;
    } else if (directorWorkspace || departmentWorkspace) {
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
    } else if (facultyWorkspace && facultyDepartments.length) {
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

    for (const p of people) out.push({ type: "person", id: p.id, title: `${p.firstName} ${p.lastName}`.trim(), subtitle: `${p.idNumber} · ${p.email}`, href: studentWorkspace ? "/student/profile" : "/erp?tab=people" });
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
    } else if (studentWorkspace && studentDepartments.length) {
      courses = await prisma.$queryRaw(Prisma.sql`
        SELECT DISTINCT c."id",c."code",c."name" FROM "courses" c
        INNER JOIN "course_offerings" co ON co."courseId"=c."id"
        INNER JOIN "student_enrollments" se ON se."userId"=${actor.id} AND se."institutionId"=${institutionId} AND se."status"='ACTIVE'
        WHERE c."institutionId"=${institutionId} AND co."institutionId"=${institutionId} AND co."isActive"=TRUE
          AND co."programId"=se."programId"
          AND (c."code" ILIKE ${like} OR c."name" ILIKE ${like}) ORDER BY c."code" LIMIT 8
      `) as typeof courses;
    }
    for (const c of courses) out.push({ type: "course", id: c.id, title: c.code, subtitle: c.name, href: studentWorkspace ? "/student/course-registration" : "/erp?tab=academics" });
  }

  if (canNotices) {
    // Search must enforce exactly the same audience and department visibility
    // as the notice list API. Search results previously returned every
    // published notice in the tenant, ignoring both audience and departmentId.
    let audiences: string[] | undefined;
    if (studentWorkspace) audiences = ["ALL", "STUDENT", "STUDENTS"];
    else if (parentWorkspace) audiences = ["ALL", "PARENT", "PARENTS"];
    else if (facultyWorkspace) audiences = ["ALL", "FACULTY", "TEACHERS"];
    else if (roles.includes("HOD") && !institutionWide) audiences = ["ALL", "HOD", "STAFF", "FACULTY", "TEACHERS"];
    else if (roles.includes("DEAN") && !institutionWide) audiences = ["ALL", "DEAN", "STAFF", "FACULTY", "TEACHERS"];
    else if (directorWorkspace) audiences = ["ALL", "DIRECTOR", "STAFF", "FACULTY", "TEACHERS"];
    else if (!institutionWide) {
      const specialist = ["ACCOUNTS", "PLACEMENT", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "IT", "CMS", "CLUB_PRESIDENT", "STAFF"]
        .find((role) => roles.includes(role));
      if (specialist) audiences = ["ALL", specialist];
    }

    const noticeFilters: Prisma.Sql[] = [
      Prisma.sql`"institutionId"=${institutionId}`,
      Prisma.sql`("title" ILIKE ${like} OR "body" ILIKE ${like})`,
      Prisma.sql`"publishedAt" <= CURRENT_TIMESTAMP`,
      Prisma.sql`("expiresAt" IS NULL OR "expiresAt" >= CURRENT_TIMESTAMP)`,
    ];
    if (audiences) {
      noticeFilters.push(Prisma.sql`"audience" IN (${Prisma.join(audiences)})`);
    }
    if (!institutionWide) {
      const scopedDepartmentIds = directorWorkspace || departmentWorkspace
        ? managedDepartments
        : facultyWorkspace
          ? facultyDepartments
          : studentWorkspace
            ? studentDepartments
            : parentWorkspace
              ? parentDepartmentIds
              : [];
      if (scopedDepartmentIds.length) {
        noticeFilters.push(Prisma.sql`("departmentId" IS NULL OR "departmentId" IN (${Prisma.join(scopedDepartmentIds)}))`);
      } else {
        noticeFilters.push(Prisma.sql`"departmentId" IS NULL`);
      }
    }

    const notices = await prisma.$queryRaw<Array<{ id: string; title: string; body: string }>>(Prisma.sql`
      SELECT "id","title","body" FROM "notices"
      WHERE ${Prisma.join(noticeFilters, " AND ")}
      ORDER BY "createdAt" DESC LIMIT 6
    `);
    for (const n of notices) out.push({ type: "notice", id: n.id, title: n.title, subtitle: n.body.slice(0, 100), href: "/erp?tab=notices" });
  }

  return out.slice(0, 20);
}
