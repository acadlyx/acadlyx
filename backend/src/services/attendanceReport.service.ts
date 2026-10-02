import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getManagedDepartmentIds,
  INSTITUTION_WIDE_ROLES,
} from "./accessScope.service";
import { AttendanceReportQuery } from "../validators/attendanceReport.validators";

export type AttendanceReportFormat = "xlsx" | "csv";

export interface AttendanceReportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  departmentId?: string;
  programId?: string;
  courseId?: string;
  academicYearId?: string;
  semesterId?: string;
  sectionId?: string;
  courseOfferingId?: string;
  facultyId?: string;
  status?: "PRESENT" | "ABSENT" | "LATE";
}

export interface AttendanceReportOptions {
  scope: "FACULTY" | "DEPARTMENT" | "INSTITUTION";
  scopeLabel: string;

  departments: Array<{
    id: string;
    code: string;
    name: string;
  }>;

  programs: Array<{
    id: string;
    code: string;
    name: string;
    departmentId: string;
  }>;

  academicYears: Array<{
    id: string;
    name: string;
    isCurrent: boolean;
  }>;

  semesters: Array<{
    id: string;
    name: string;
    number: number;
    programId: string;
    academicYearId: string;
  }>;

  sections: Array<{
    id: string;
    name: string;
    semesterId: string;
  }>;

  courses: Array<{
    id: string;
    code: string;
    name: string;
    departmentId: string;
  }>;

  courseOfferings: Array<{
    id: string;
    courseId: string;
    semesterId: string;
    sectionId: string;
    facultyId: string | null;
    courseCode: string;
    courseName: string;
    programName: string;
    academicYearName: string;
    semesterName: string;
    sectionName: string;
    facultyName: string | null;
  }>;

  faculty: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

type AttendanceRow = Record<
  string,
  string | number | boolean | null
>;

type ScopedWhere =
  Prisma.AttendanceRecordWhereInput;

function canonicalRoles(
  actor: AuthenticatedUser,
): Set<string> {
  return new Set(
    actor.roles.map((role) =>
      role.toUpperCase(),
    ),
  );
}

function isFaculty(
  actor: AuthenticatedUser,
): boolean {
  return canonicalRoles(actor).has(
    "FACULTY",
  );
}

function isHod(
  actor: AuthenticatedUser,
): boolean {
  return canonicalRoles(actor).has(
    "HOD",
  );
}

function isInstitutionWide(
  actor: AuthenticatedUser,
): boolean {
  const roles =
    canonicalRoles(actor);

  return INSTITUTION_WIDE_ROLES.some(
    (role) => roles.has(role),
  );
}

function assertExportRole(
  actor: AuthenticatedUser,
): void {
  if (
    isFaculty(actor) ||
    isHod(actor) ||
    isInstitutionWide(actor)
  ) {
    return;
  }

  throw new AppError(
    "Attendance export is available to faculty, HODs and institution leadership within their authorised scope",
    403,
  );
}

function normalizeFilters(
  query: AttendanceReportQuery,
): AttendanceReportFilters {
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    departmentId:
      query.departmentId,
    programId:
      query.programId,
    courseId:
      query.courseId,
    academicYearId:
      query.academicYearId,
    semesterId:
      query.semesterId,
    sectionId:
      query.sectionId,
    courseOfferingId:
      query.courseOfferingId,
    facultyId:
      query.facultyId,
    status:
      query.status,
  };
}

async function resolveScope(
  institutionId: string,
  actor: AuthenticatedUser,
): Promise<{
  kind: AttendanceReportOptions["scope"];
  label: string;
  departmentIds: string[] | null;
}> {
  assertExportRole(actor);

  /*
   * Faculty scope:
   * only course offerings assigned to this faculty member.
   *
   * Department IDs are also resolved so filter metadata is not
   * unnecessarily institution-wide.
   */
  if (isFaculty(actor)) {
    const offerings =
      await prisma.courseOffering.findMany({
        where: {
          institutionId,
          facultyId: actor.id,
        },
        select: {
          course: {
            select: {
              departmentId: true,
            },
          },
        },
      });

    return {
      kind: "FACULTY",
      label: "Assigned teaching scope",
      departmentIds: Array.from(
        new Set(
          offerings.map(
            (item) =>
              item.course.departmentId,
          ),
        ),
      ),
    };
  }

  /*
   * HOD scope:
   * DepartmentAccess is authoritative.
   */
  if (
    isHod(actor) &&
    !isInstitutionWide(actor)
  ) {
    const departmentIds =
      await getManagedDepartmentIds(
        institutionId,
        actor.id,
      );

    if (
      departmentIds.length === 0
    ) {
      throw new AppError(
        "No department scope is assigned to this HOD",
        403,
      );
    }

    return {
      kind: "DEPARTMENT",
      label:
        "Managed department scope",
      departmentIds,
    };
  }

  /*
   * Dean / Director / other institution-wide
   * roles are scoped to the authenticated tenant.
   */
  return {
    kind: "INSTITUTION",
    label: "Institution scope",
    departmentIds: null,
  };
}

async function buildScopedWhere(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: AttendanceReportFilters,
) {
  const scope =
    await resolveScope(
      institutionId,
      actor,
    );

  /*
   * Faculty cannot request another faculty member.
   */
  if (
    filters.facultyId &&
    scope.kind === "FACULTY" &&
    filters.facultyId !== actor.id
  ) {
    throw new AppError(
      "Faculty may only export their own attendance",
      403,
    );
  }

  /*
   * HOD/department-scoped users cannot request
   * an unrelated department.
   */
  if (
    filters.departmentId &&
    scope.departmentIds &&
    !scope.departmentIds.includes(
      filters.departmentId,
    )
  ) {
    throw new AppError(
      "The selected department is outside your authorised scope",
      403,
    );
  }

  /*
   * Faculty cannot request an offering assigned
   * to someone else.
   */
  if (
    scope.kind === "FACULTY" &&
    filters.courseOfferingId
  ) {
    const offering =
      await prisma.courseOffering.findFirst(
        {
          where: {
            id:
              filters.courseOfferingId,
            institutionId,
            facultyId: actor.id,
          },
          select: {
            id: true,
          },
        },
      );

    if (!offering) {
      throw new AppError(
        "The selected course offering is outside your authorised scope",
        403,
      );
    }
  }

  const courseOfferingWhere:
    Prisma.CourseOfferingWhereInput =
    {};

  if (
    filters.courseOfferingId
  ) {
    courseOfferingWhere.id =
      filters.courseOfferingId;
  }

  if (filters.facultyId) {
    courseOfferingWhere.facultyId =
      filters.facultyId;
  }

  if (filters.sectionId) {
    courseOfferingWhere.sectionId =
      filters.sectionId;
  }

  if (filters.courseId) {
    courseOfferingWhere.courseId =
      filters.courseId;
  }

  /*
   * Faculty scope is always applied server-side.
   */
  if (
    filters.courseOfferingId ===
      undefined &&
    filters.facultyId ===
      undefined &&
    scope.kind === "FACULTY"
  ) {
    courseOfferingWhere.facultyId =
      actor.id;
  }

  const courseWhere:
    Prisma.CourseWhereInput = {};

  if (filters.departmentId) {
    courseWhere.departmentId =
      filters.departmentId;
  } else if (
    scope.departmentIds &&
    scope.departmentIds.length > 0
  ) {
    courseWhere.departmentId = {
      in: scope.departmentIds,
    };
  }

  if (
    Object.keys(courseWhere)
      .length > 0
  ) {
    courseOfferingWhere.course =
      courseWhere;
  }

  const semesterWhere:
    Prisma.SemesterWhereInput = {};

  if (filters.programId) {
    semesterWhere.programId =
      filters.programId;
  }

  if (filters.academicYearId) {
    semesterWhere.academicYearId =
      filters.academicYearId;
  }

  if (filters.semesterId) {
    semesterWhere.id =
      filters.semesterId;
  }

  if (
    Object.keys(semesterWhere)
      .length > 0
  ) {
    courseOfferingWhere.semester =
      semesterWhere;
  }

  const attendanceSessionWhere:
    Prisma.AttendanceSessionWhereInput =
    {
      institutionId,

      /*
       * Draft sessions are deliberately excluded
       * from official exports.
       */
      isSubmitted: true,

      ...(filters.dateFrom ||
      filters.dateTo
        ? {
            sessionDate: {
              ...(filters.dateFrom
                ? {
                    gte:
                      filters.dateFrom,
                  }
                : {}),
              ...(filters.dateTo
                ? {
                    lte:
                      filters.dateTo,
                  }
                : {}),
            },
          }
        : {}),

      ...(Object.keys(
        courseOfferingWhere,
      ).length > 0
        ? {
            courseOffering:
              courseOfferingWhere,
          }
        : {}),
    };

  const where: ScopedWhere = {
    attendanceSession:
      attendanceSessionWhere,

    ...(filters.status
      ? {
          status:
            filters.status,
        }
      : {}),
  };

  return {
    where,
    scope,
  };
}

function dayName(
  date: Date,
): string {
  return date.toLocaleDateString(
    "en-IN",
    {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    },
  );
}

function dateValue(
  date: Date,
): string {
  return date.toLocaleDateString(
    "en-IN",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Kolkata",
    },
  );
}

async function getAttendanceRows(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: AttendanceReportFilters,
) {
  const {
    where,
    scope,
  } =
    await buildScopedWhere(
      institutionId,
      actor,
      filters,
    );

  const records =
    await prisma.attendanceRecord.findMany(
      {
        where,

        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,

              profile: {
                select: {
                  admissionNumber: true,
                },
              },

              studentEnrollments: {
                where: {
                  institutionId,
                  status: "ACTIVE",
                },

                select: {
                  rollNumber: true,
                  programId: true,
                  academicYearId: true,
                  semesterId: true,
                  sectionId: true,
                },

                orderBy: {
                  updatedAt: "desc",
                },
              },
            },
          },

          attendanceSession: {
            select: {
              id: true,
              sessionDate: true,
              isSubmitted: true,

              courseOffering: {
                select: {
                  id: true,

                  course: {
                    select: {
                      id: true,
                      code: true,
                      name: true,

                      department: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                        },
                      },
                    },
                  },

                  semester: {
                    select: {
                      id: true,
                      name: true,
                      number: true,

                      program: {
                        select: {
                          id: true,
                          code: true,
                          name: true,
                        },
                      },

                      academicYear: {
                        select: {
                          id: true,
                          name: true,
                        },
                      },
                    },
                  },

                  section: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },

                  faculty: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },

        orderBy: [
          {
            attendanceSession: {
              sessionDate:
                "desc",
            },
          },
          {
            student: {
              firstName:
                "asc",
            },
          },
          {
            student: {
              lastName:
                "asc",
            },
          },
        ],
      },
    );

  return {
    scope,
    records,
  };
}

function buildRows(
  records: Awaited<
    ReturnType<
      typeof getAttendanceRows
    >
  >["records"],
): AttendanceRow[] {
  return records.map(
    (record) => {
      const offering =
        record.attendanceSession
          .courseOffering;

      const enrollment =
        record.student
          .studentEnrollments.find(
            (item) =>
              item.programId ===
                offering.semester
                  .program.id &&
              item.academicYearId ===
                offering.semester
                  .academicYear.id &&
              item.semesterId ===
                offering.semester.id &&
              item.sectionId ===
                offering.section.id,
          ) ??
        record.student
          .studentEnrollments[0];

      return {
        date: dateValue(
          record
            .attendanceSession
            .sessionDate,
        ),

        day: dayName(
          record
            .attendanceSession
            .sessionDate,
        ),

        studentName:
          `${record.student.firstName} ${record.student.lastName}`.trim(),

        admissionNumber:
          record.student.profile
            ?.admissionNumber ??
          null,

        rollNumber:
          enrollment?.rollNumber ??
          null,

        studentEmail:
          record.student.email,

        departmentCode:
          offering.course
            .department.code,

        department:
          offering.course
            .department.name,

        programCode:
          offering.semester
            .program.code,

        program:
          offering.semester
            .program.name,

        academicYear:
          offering.semester
            .academicYear.name,

        semester:
          offering.semester.name,

        section:
          offering.section.name,

        courseCode:
          offering.course.code,

        course:
          offering.course.name,

        facultyName:
          offering.faculty
            ? `${offering.faculty.firstName} ${offering.faculty.lastName}`.trim()
            : null,

        facultyEmail:
          offering.faculty
            ?.email ?? null,

        status:
          record.status,

        submitted:
          record.attendanceSession
            .isSubmitted,

        markedAt:
          record.markedAt
            .toISOString(),
      };
    },
  );
}

function buildSummaryRows(
  rows: AttendanceRow[],
): AttendanceRow[] {
  const byStudent =
    new Map<
      string,
      AttendanceRow
    >();

  for (const row of rows) {
    const key = String(
      row.studentEmail ??
        row.studentName ??
        "",
    );

    const existing =
      byStudent.get(key);

    if (!existing) {
      byStudent.set(
        key,
        {
          studentName:
            row.studentName,

          admissionNumber:
            row.admissionNumber,

          rollNumber:
            row.rollNumber,

          studentEmail:
            row.studentEmail,

          department:
            row.department,

          program:
            row.program,

          academicYear:
            row.academicYear,

          semester:
            row.semester,

          section:
            row.section,

          totalClasses: 1,

          present:
            row.status ===
            "PRESENT"
              ? 1
              : 0,

          absent:
            row.status ===
            "ABSENT"
              ? 1
              : 0,

          late:
            row.status ===
            "LATE"
              ? 1
              : 0,
        },
      );

      continue;
    }

    existing.totalClasses =
      Number(
        existing.totalClasses ??
          0,
      ) + 1;

    existing.present =
      Number(
        existing.present ??
          0,
      ) +
      (row.status ===
      "PRESENT"
        ? 1
        : 0);

    existing.absent =
      Number(
        existing.absent ??
          0,
      ) +
      (row.status ===
      "ABSENT"
        ? 1
        : 0);

    existing.late =
      Number(
        existing.late ??
          0,
      ) +
      (row.status ===
      "LATE"
        ? 1
        : 0);
  }

  return Array.from(
    byStudent.values(),
  ).map((row) => ({
    ...row,

    attendancePercentage:
      Number(
        row.totalClasses,
      ) > 0
        ? Number(
            (
              (Number(
                row.present,
              ) /
                Number(
                  row.totalClasses,
                )) *
              100
            ).toFixed(2),
          )
        : 0,
  }));
}

function makeWorkbook(
  rows: AttendanceRow[],
  format: AttendanceReportFormat,
) {
  if (format === "csv") {
    const sheet =
      XLSX.utils.json_to_sheet(
        rows.length
          ? rows
          : [{}],
      );

    const csv =
      XLSX.utils.sheet_to_csv(
        sheet,
      );

    return {
      buffer:
        Buffer.from(
          csv,
          "utf8",
        ),

      contentType:
        "text/csv; charset=utf-8",

      extension:
        "csv",
    };
  }

  const workbook =
    XLSX.utils.book_new();

  const attendanceSheet =
    XLSX.utils.json_to_sheet(
      rows.length
        ? rows
        : [{}],
    );

  const summaryRows =
    buildSummaryRows(
      rows,
    );

  const summarySheet =
    XLSX.utils.json_to_sheet(
      summaryRows.length
        ? summaryRows
        : [{}],
    );

  XLSX.utils.book_append_sheet(
    workbook,
    attendanceSheet,
    "Attendance Records",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    "Student Summary",
  );

  const buffer =
    XLSX.write(
      workbook,
      {
        type: "buffer",
        bookType: "xlsx",
      },
    );

  return {
    buffer:
      Buffer.from(buffer),

    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    extension:
      "xlsx",
  };
}

export async function getAttendanceReportOptions(
  institutionId: string,
  actor: AuthenticatedUser,
): Promise<AttendanceReportOptions> {
  const scope =
    await resolveScope(
      institutionId,
      actor,
    );

  const departmentWhere:
    Prisma.DepartmentWhereInput =
    {
      institutionId,

      ...(scope.departmentIds
        ? {
            id: {
              in:
                scope.departmentIds,
            },
          }
        : {}),
    };

  const offeringWhere:
    Prisma.CourseOfferingWhereInput =
    {
      institutionId,
      isActive: true,

      ...(scope.kind ===
      "FACULTY"
        ? {
            facultyId:
              actor.id,
          }
        : {}),

      ...(scope.departmentIds
        ? {
            course: {
              departmentId: {
                in:
                  scope.departmentIds,
              },
            },
          }
        : {}),
    };

  const [
    departments,
    programs,
    academicYears,
    semesters,
    sections,
    courses,
    offerings,
    faculty,
  ] =
    await Promise.all([
      prisma.department.findMany(
        {
          where:
            departmentWhere,

          select: {
            id: true,
            code: true,
            name: true,
          },

          orderBy: {
            name: "asc",
          },
        },
      ),

      prisma.program.findMany(
        {
          where: {
            institutionId,

            ...(scope.departmentIds
              ? {
                  departmentId: {
                    in:
                      scope.departmentIds,
                  },
                }
              : {}),
          },

          select: {
            id: true,
            code: true,
            name: true,
            departmentId:
              true,
          },

          orderBy: {
            name: "asc",
          },
        },
      ),

      prisma.academicYear.findMany(
        {
          where: {
            institutionId,
          },

          select: {
            id: true,
            name: true,
            isCurrent: true,
          },

          orderBy: {
            startDate: "desc",
          },
        },
      ),

      prisma.semester.findMany(
        {
          where: {
            institutionId,

            ...(scope.departmentIds
              ? {
                  program: {
                    departmentId: {
                      in:
                        scope.departmentIds,
                    },
                  },
                }
              : {}),
          },

          select: {
            id: true,
            name: true,
            number: true,
            programId: true,
            academicYearId:
              true,
          },

          orderBy: [
            {
              number:
                "asc",
            },
            {
              name:
                "asc",
            },
          ],
        },
      ),

      prisma.section.findMany(
        {
          where: {
            institutionId,

            ...(scope.departmentIds
              ? {
                  semester: {
                    program: {
                      departmentId: {
                        in:
                          scope.departmentIds,
                      },
                    },
                  },
                }
              : {}),
          },

          select: {
            id: true,
            name: true,
            semesterId:
              true,
          },

          orderBy: {
            name: "asc",
          },
        },
      ),

      prisma.course.findMany(
        {
          where: {
            institutionId,

            ...(scope.departmentIds
              ? {
                  departmentId: {
                    in:
                      scope.departmentIds,
                  },
                }
              : {}),
          },

          select: {
            id: true,
            code: true,
            name: true,
            departmentId:
              true,
          },

          orderBy: {
            code: "asc",
          },
        },
      ),

      prisma.courseOffering.findMany(
        {
          where:
            offeringWhere,

          select: {
            id: true,
            courseId: true,
            semesterId:
              true,
            sectionId:
              true,
            facultyId:
              true,

            course: {
              select: {
                code: true,
                name: true,
              },
            },

            semester: {
              select: {
                name: true,

                program: {
                  select: {
                    name: true,
                  },
                },

                academicYear: {
                  select: {
                    name: true,
                  },
                },
              },
            },

            section: {
              select: {
                name: true,
              },
            },

            faculty: {
              select: {
                firstName:
                  true,
                lastName:
                  true,
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        },
      ),

      prisma.user.findMany(
        {
          where: {
            institutionId,
            isActive: true,

            userRoles: {
              some: {
                role: {
                  name: "FACULTY",
                },
              },
            },

            ...(scope.departmentIds
              ? {
                  facultyCourseOfferings:
                    {
                      some: {
                        course: {
                          departmentId:
                            {
                              in:
                                scope.departmentIds,
                            },
                        },
                      },
                    },
                }
              : scope.kind ===
                "FACULTY"
                ? {
                    id:
                      actor.id,
                  }
                : {}),
          },

          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },

          orderBy: [
            {
              firstName:
                "asc",
            },
            {
              lastName:
                "asc",
            },
          ],
        },
      ),
    ]);

  return {
    scope:
      scope.kind,

    scopeLabel:
      scope.label,

    departments,

    programs,

    academicYears,

    semesters,

    sections,

    courses,

    courseOfferings:
      offerings.map(
        (offering) => ({
          id:
            offering.id,

          courseId:
            offering.courseId,

          semesterId:
            offering.semesterId,

          sectionId:
            offering.sectionId,

          facultyId:
            offering.facultyId,

          courseCode:
            offering.course.code,

          courseName:
            offering.course.name,

          programName:
            offering.semester
              .program.name,

          academicYearName:
            offering.semester
              .academicYear.name,

          semesterName:
            offering.semester
              .name,

          sectionName:
            offering.section
              .name,

          facultyName:
            offering.faculty
              ? `${offering.faculty.firstName} ${offering.faculty.lastName}`.trim()
              : null,
        }),
      ),

    faculty,
  };
}

export async function exportAttendance(
  institutionId: string,
  actor: AuthenticatedUser,
  query: AttendanceReportQuery,
) {
  const format =
    query.format as AttendanceReportFormat;

  const filters =
    normalizeFilters(query);

  const {
    records,
    scope,
  } =
    await getAttendanceRows(
      institutionId,
      actor,
      filters,
    );

  const rows =
    buildRows(records);

  const file =
    makeWorkbook(
      rows,
      format,
    );

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const scopeName =
    scope.kind.toLowerCase();

  return {
    ...file,

    filename:
      `acadlyx-attendance-${scopeName}-${today}.${file.extension}`,

    rowCount:
      rows.length,
  };
}
