import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export interface LibraryStudentSearchFilters { department?: string; program?: string; session?: string; semester?: string; section?: string; search?: string; }

export async function searchLibraryStudents(institutionId: string, actor: AuthenticatedUser, filters: LibraryStudentSearchFilters) {
  if (!actor.permissions.includes("library.manage")) throw new AppError("Library student lookup requires circulation permission", 403);
  const value = (input?: string) => input?.trim() || undefined;
  const search = value(filters.search);
  const department = value(filters.department);
  const program = value(filters.program);
  const session = value(filters.session);
  const semester = value(filters.semester);
  const section = value(filters.section);
  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."institutionId" = ${institutionId}`,
    Prisma.sql`u."isActive" = TRUE`,
    Prisma.sql`EXISTS (SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id"=ur."roleId" WHERE ur."userId"=u."id" AND r."name"='STUDENT' AND r."institutionId"=${institutionId})`,
    Prisma.sql`e."institutionId"=${institutionId} AND e."status"='ACTIVE'`,
  ];
  if (department) conditions.push(Prisma.sql`(d."name" ILIKE ${`%${department}%`} OR d."code" ILIKE ${`%${department}%`})`);
  if (program) conditions.push(Prisma.sql`(p."name" ILIKE ${`%${program}%`} OR p."code" ILIKE ${`%${program}%`})`);
  if (session) conditions.push(Prisma.sql`ay."name" ILIKE ${`%${session}%`}`);
  if (semester) {
    const number = Number(semester);
    conditions.push(Number.isFinite(number) ? Prisma.sql`(sem."name" ILIKE ${`%${semester}%`} OR sem."number"=${number})` : Prisma.sql`sem."name" ILIKE ${`%${semester}%`}`);
  }
  if (section) conditions.push(Prisma.sql`sec."name" ILIKE ${`%${section}%`}`);
  if (search) {
    const like = `%${search}%`;
    conditions.push(Prisma.sql`(u."firstName" ILIKE ${like} OR u."lastName" ILIKE ${like} OR u."email" ILIKE ${like} OR sp."admissionNumber" ILIKE ${like} OR e."rollNumber" ILIKE ${like})`);
  }

  const rows = await prisma.$queryRaw<Array<{
    id: string; firstName: string; lastName: string; admissionNumber: string | null; rollNumber: string | null;
    departmentCode: string; departmentName: string; programCode: string; programName: string; sessionName: string;
    semesterNumber: number; sectionName: string;
  }>>(Prisma.sql`
    SELECT u."id",u."firstName",u."lastName",sp."admissionNumber",e."rollNumber",
      d."code" AS "departmentCode",d."name" AS "departmentName",
      p."code" AS "programCode",p."name" AS "programName",ay."name" AS "sessionName",
      sem."number" AS "semesterNumber",sec."name" AS "sectionName"
    FROM "users" u
    JOIN "student_enrollments" e ON e."userId"=u."id"
    JOIN "programs" p ON p."id"=e."programId"
    JOIN "departments" d ON d."id"=p."departmentId"
    LEFT JOIN "academic_years" ay ON ay."id"=e."academicYearId"
    LEFT JOIN "semesters" sem ON sem."id"=e."semesterId"
    LEFT JOIN "sections" sec ON sec."id"=e."sectionId"
    LEFT JOIN "student_profiles" sp ON sp."userId"=u."id"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY u."firstName" ASC,u."lastName" ASC
    LIMIT 25
  `);

  return rows.map((row) => ({
    id: row.id,
    label: `${row.firstName} ${row.lastName}`.trim(),
    hint: [
      row.admissionNumber ? `Enrollment ${row.admissionNumber}` : null,
      row.rollNumber ? `Roll ${row.rollNumber}` : null,
      `${row.programCode} · ${row.programName}`,
      `${row.departmentCode} · ${row.departmentName}`,
      row.sessionName,
      `Semester ${row.semesterNumber}`,
      `Section ${row.sectionName}`,
    ].filter(Boolean).join(" · "),
  }));
}
