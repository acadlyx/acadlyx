import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";

export interface LibraryStudentSearchFilters { department?: string; program?: string; session?: string; semester?: string; section?: string; search?: string; }

export async function searchLibraryStudents(institutionId: string, actor: AuthenticatedUser, filters: LibraryStudentSearchFilters) {
  if (!actor.permissions.includes("library.manage")) throw new AppError("Library student lookup requires circulation permission", 403);
  const normalized = Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value?.trim() || undefined])) as LibraryStudentSearchFilters;
  const search = normalized.search;
  const programFilter: Prisma.ProgramWhereInput = {
    ...(normalized.department ? { department: { OR: [{ name: { contains: normalized.department, mode: "insensitive" } }, { code: { contains: normalized.department, mode: "insensitive" } }] } } : {}),
    ...(normalized.program ? { OR: [{ name: { contains: normalized.program, mode: "insensitive" } }, { code: { contains: normalized.program, mode: "insensitive" } }] } : {}),
  };
  const enrollment: Prisma.StudentEnrollmentWhereInput = {
    institutionId,
    status: "ACTIVE",
    ...(Object.keys(programFilter).length ? { program: programFilter } : {}),
    ...(normalized.session ? { academicYear: { name: { contains: normalized.session, mode: "insensitive" } } } : {}),
    ...(normalized.semester ? { semester: { OR: [{ name: { contains: normalized.semester, mode: "insensitive" } }, ...(Number.isFinite(Number(normalized.semester)) ? [{ number: Number(normalized.semester) }] : [])] } } : {}),
    ...(normalized.section ? { section: { name: { contains: normalized.section, mode: "insensitive" } } } : {}),
  };
  const where: Prisma.UserWhereInput = {
    institutionId,
    isActive: true,
    userRoles: { some: { role: { name: "STUDENT", institutionId } } },
    studentEnrollments: { some: enrollment },
    ...(search ? { OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { profile: { admissionNumber: { contains: search, mode: "insensitive" } } },
      { studentEnrollments: { some: { institutionId, rollNumber: { contains: search, mode: "insensitive" } } } },
    ] } : {}),
  };
  const rows = await prisma.user.findMany({
    where, take: 25, orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true, firstName: true, lastName: true,
      profile: { select: { admissionNumber: true } },
      studentEnrollments: { where: enrollment, take: 1, orderBy: [{ enrolledAt: "desc" }, { createdAt: "desc" }], select: {
        rollNumber: true,
        program: { select: { name: true, code: true, department: { select: { name: true, code: true } } } },
        academicYear: { select: { name: true } },
        semester: { select: { number: true, name: true } },
        section: { select: { name: true } },
      } },
    },
  });
  return rows.map((student) => {
    const current = student.studentEnrollments[0];
    return { id: student.id, label: `${student.firstName} ${student.lastName}`.trim(), hint: [
      student.profile?.admissionNumber ? `Enrollment ${student.profile.admissionNumber}` : null,
      current?.rollNumber ? `Roll ${current.rollNumber}` : null,
      current?.program ? `${current.program.code} · ${current.program.name}` : null,
      current?.program?.department ? `${current.program.department.code} · ${current.program.department.name}` : null,
      current?.academicYear?.name,
      current?.semester ? `Semester ${current.semester.number}` : null,
      current?.section ? `Section ${current.section.name}` : null,
    ].filter(Boolean).join(" · ") };
  });
}
