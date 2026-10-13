import { prisma } from "../lib/prisma";
import { getDirectorCampusIds, getManagedDepartmentIds, isInstitutionWide } from "./accessScope.service";
import { AppError } from "../middleware/errorHandler";
import {
  AuthenticatedUser,
} from "../types/auth";
import { getEffectiveWorkspaceRole } from "./accessScope.service";

export function getWorkspaceType(actor: AuthenticatedUser): string {
  return getEffectiveWorkspaceRole(actor);
}

export function isLeadershipActor(actor: AuthenticatedUser): boolean {
  return ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR"]
    .includes(getWorkspaceType(actor));
}

/**
 * Institution Admin workspace.
 *
 * This deliberately does NOT query:
 *
 * - fee invoices
 * - fee payments
 * - exams
 * - exam results
 * - assignments
 * - internal marks
 * - attendance sessions
 *
 * even though some older dashboard code did so.
 *
 * Every statistic below is tied to a permission that the authenticated
 * Institution Admin actually possesses.
 */
async function getInstitutionAdminWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const permissions =
    new Set(
      actor.permissions
    );

  const can = (
    permission: string
  ) =>
    permissions.has(
      permission
    );

  // Keep the admin landing workspace intentionally cheap. Detailed records
  // are loaded by their domain pages; the command center only needs the
  // eight KPI counts displayed above the fold.
  const [
    users,
    students,
    departments,
    programs,
    courses,
    offerings,
    campuses,
    notices,
  ] = await Promise.all([
    can("users.read")
      ? prisma.user.count({ where: { institutionId } })
      : Promise.resolve(0),
    can("students.read")
      ? prisma.user.count({
          where: {
            institutionId,
            isActive: true,
            userRoles: { some: { role: { name: "STUDENT" } } },
          },
        })
      : Promise.resolve(0),
    can("departments.read")
      ? prisma.department.count({ where: { institutionId, isActive: true } })
      : Promise.resolve(0),
    can("programs.read")
      ? prisma.program.count({ where: { institutionId, isActive: true } })
      : Promise.resolve(0),
    can("courses.read")
      ? prisma.course.count({ where: { institutionId, isActive: true } })
      : Promise.resolve(0),
    can("course-offerings.read")
      ? prisma.courseOffering.count({ where: { institutionId, isActive: true } })
      : Promise.resolve(0),
    can("campuses.read")
      ? prisma.campus.count({ where: { institutionId, isActive: true } })
      : Promise.resolve(0),
    can("notices.read")
      ? prisma.notice.count({ where: { institutionId } })
      : Promise.resolve(0),
  ]);

  return {
    workspaceType:
      "INSTITUTION_ADMIN",

    stats: {
      users,
      usersWithProfilePhoto: 0,
      usersMissingProfilePhoto: 0,
      students,
      faculty: 0,
      departments,
      programs,
      academicYears: 0,
      semesters: 0,
      sections: 0,
      courses,
      offerings,
      campuses,
      timetableEntries: 0,
      notices,
      documents: 0,
      notifications: 0,
      parentLinks: 0,
      admissions: 0,
      registrations: 0,
      promotions: 0,
      certificates: 0,
      auditLogs: 0,
    },

    modules: {
      users:
        can("users.read"),

      students:
        can("students.read"),

      academicStructure:
        can(
          "departments.read"
        ) ||
        can(
          "programs.read"
        ) ||
        can(
          "academic-years.read"
        ) ||
        can(
          "semesters.read"
        ) ||
        can(
          "sections.read"
        ) ||
        can(
          "courses.read"
        ) ||
        can(
          "course-offerings.read"
        ),

      campuses:
        can("campuses.read"),

      timetable:
        can("timetable.read"),

      notices:
        can("notices.read"),

      admissions:
        can("admissions.read"),

      reports:
        can("reports.read"),

      intelligence:
        can(
          "intelligence.read"
        ),

      parentLinks:
        can(
          "parent-links.read"
        ),

      notifications:
        can(
          "notifications.read"
        ),

      documents:
        can(
          "documents.read"
        ),

      calendar:
        can("calendar.read"),

      registration:
        can(
          "registration.read"
        ),

      promotions:
        can(
          "promotions.read"
        ),

      certificates:
        can(
          "certificates.read"
        ),

      audit:
        can("audit.read"),

      operations:
        can(
          "operations.read"
        ),

      maintenance:
        can(
          "maintenance.raise"
        ),
    },

    notices: [],
    notifications: [],
    documents: [],

    fees: [],
    exams: [],

    students: [],
    facultyOfferings: [],
    departments: [],
    timetable: [],
  };
}

/**
 * Lightweight KPI payload for the Chairman, Director and Dean landing
 * dashboards. Detailed records remain on their dedicated module endpoints.
 * Keeps dashboard first paint from waiting on every operational count and
 * the notices query included in the full workspace payload.
 */
export async function getManagementWorkspaceSummary(
  institutionId: string,
  actor: AuthenticatedUser,
) {
  // Resolve the effective workspace before granting an institution-wide
  // admin branch. A legacy secondary INSTITUTION_ADMIN binding must not
  // override a Director's campus scope or a Dean's department scope.
  const workspaceType = getWorkspaceType(actor);
  const roles = new Set(actor.roles);
  if (workspaceType === "INSTITUTION_ADMIN" && roles.has("INSTITUTION_ADMIN") && isInstitutionWide(actor)) {
    return getInstitutionAdminWorkspace(institutionId, actor);
  }
  if (!["CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR"].includes(workspaceType)) {
    throw new AppError("A leadership summary is not available for this workspace", 403);
  }

  const activeUser = { institutionId, isActive: true };
  const studentRole = { userRoles: { some: { role: { name: "STUDENT" } } } };
  const facultyRole = { userRoles: { some: { role: { name: "FACULTY" } } } };

  if (workspaceType === "CHAIRMAN" || workspaceType === "MANAGEMENT" || workspaceType === "REGISTRAR") {
    const [
      students,
      faculty,
      departments,
      examResults,
      invoiceAggregate,
      paidInvoices,
    ] = await Promise.all([
      prisma.user.count({ where: { ...activeUser, ...studentRole } }),
      prisma.user.count({ where: { ...activeUser, ...facultyRole } }),
      prisma.department.count({ where: { institutionId, isActive: true } }),
      prisma.examResult.count({ where: { institutionId } }),
      prisma.feeInvoice.aggregate({
        where: { institutionId },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.feeInvoice.count({ where: { institutionId, status: "PAID" } }),
    ]);

    return {
      workspaceType,
      stats: {
        students,
        faculty,
        departments,
        examResults,
        totalInvoiced: Number(invoiceAggregate._sum.amount ?? 0),
        paidInvoices,
      },
    };
  }

  if (workspaceType === "DIRECTOR") {
    // Resolve the same canonical campus assignments used by the full
    // workspace. Department scope is derived only from assigned active
    // campuses, never from a caller-provided department identifier.
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (campusIds.length === 0) {
      throw new AppError("No campus scope is assigned to this director", 403);
    }

    const departmentRows = await prisma.department.findMany({
      where: { institutionId, campusId: { in: campusIds }, isActive: true },
      select: { id: true },
    });
    const departmentIds = departmentRows.map((row) => row.id);
    const departmentScope = { in: departmentIds };
    const scopedStudent = {
      studentEnrollments: {
        some: {
          institutionId,
          status: "ACTIVE",
          program: { departmentId: departmentScope },
        },
      },
    };
    const scopedOffering = {
      course: { departmentId: departmentScope },
      semester: { program: { departmentId: departmentScope } },
    };

    const [
      students,
      faculty,
      departments,
      courses,
      exams,
      examResults,
    ] = await Promise.all([
      prisma.user.count({
        where: { ...activeUser, ...studentRole, ...scopedStudent },
      }),
      prisma.user.count({
        where: {
          ...activeUser,
          ...facultyRole,
          facultyCourseOfferings: {
            some: {
              institutionId,
              course: { departmentId: departmentScope },
            },
          },
        },
      }),
      prisma.department.count({
        where: { institutionId, isActive: true, id: departmentScope },
      }),
      prisma.course.count({
        where: { institutionId, isActive: true, departmentId: departmentScope },
      }),
      prisma.exam.count({
        where: { institutionId, courseOffering: scopedOffering },
      }),
      prisma.examResult.count({
        where: { institutionId, exam: { courseOffering: scopedOffering } },
      }),
    ]);

    return {
      workspaceType,
      stats: { students, faculty, departments, courses, exams, examResults },
    };
  }

  if (workspaceType === "DEAN") {
    const departmentIds = await getManagedDepartmentIds(institutionId, actor.id);
    if (departmentIds.length === 0) {
      throw new AppError("No department scope is assigned to this Dean", 403);
    }
    const departmentScope = { in: departmentIds };
    const scopedStudent = {
      studentEnrollments: {
        some: {
          institutionId,
          status: "ACTIVE",
          program: { departmentId: departmentScope },
        },
      },
    };
    const scopedOffering = {
      course: { departmentId: departmentScope },
      semester: { program: { departmentId: departmentScope } },
    };
    const [students, faculty, programs, courses, assignments, exams] = await Promise.all([
      prisma.user.count({
        where: { ...activeUser, ...studentRole, ...scopedStudent },
      }),
      prisma.user.count({
        where: {
          ...activeUser,
          ...facultyRole,
          OR: [
            { facultyCourseOfferings: { some: { institutionId, course: { departmentId: departmentScope } } } },
            { employeeProfile: { departmentId: departmentScope } },
          ],
        },
      }),
      prisma.program.count({ where: { institutionId, isActive: true, departmentId: departmentScope } }),
      prisma.course.count({ where: { institutionId, isActive: true, departmentId: departmentScope } }),
      prisma.assignment.count({ where: { institutionId, courseOffering: scopedOffering } }),
      prisma.exam.count({ where: { institutionId, courseOffering: scopedOffering } }),
    ]);

    return {
      workspaceType,
      stats: { students, faculty, programs, courses, assignments, exams },
    };
  }

  throw new AppError("A leadership summary is not available for this workspace", 403);
}

export async function getManagementWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const workspaceType = getWorkspaceType(actor);
  const roles = new Set(actor.roles);
  if (workspaceType === "INSTITUTION_ADMIN" && roles.has("INSTITUTION_ADMIN") && isInstitutionWide(actor)) {
    return getInstitutionAdminWorkspace(institutionId, actor);
  }
  if (!["CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR"].includes(workspaceType)) {
    throw new AppError("A leadership workspace is not available for this effective role", 403);
  }

  const now = new Date();
  // Scope selection follows the effective workspace: Chairman has institution
  // scope, Director has explicitly assigned campuses, and Dean has assigned
  // departments. A secondary admin role never widens a scoped workspace.
  const isDirector = workspaceType === "DIRECTOR";
  const isDean = workspaceType === "DEAN";
  const isDepartmentScoped = isDirector || isDean;
  const directorCampusIds = isDirector
    ? await getDirectorCampusIds(institutionId, actor.id)
    : [];
  if (isDirector && directorCampusIds.length === 0) {
    throw new AppError("No campus scope is assigned to this director", 403);
  }
  const scopedDepartmentIds = isDirector
    ? (await prisma.department.findMany({
        where: { institutionId, isActive: true, campusId: { in: directorCampusIds } },
        select: { id: true },
      })).map((row) => row.id)
    : isDean
      ? await getManagedDepartmentIds(institutionId, actor.id)
      : [];
  if (isDean && scopedDepartmentIds.length === 0) {
    throw new AppError("No department scope is assigned to this Dean", 403);
  }
  // An assigned campus can exist before any departments are created, in which
  // case its scoped KPI counts safely resolve to zero.
  const inScopedDepartments = { in: scopedDepartmentIds };
  const scopedStudent = {
    studentEnrollments: {
      some: {
        institutionId,
        status: "ACTIVE",
        program: { departmentId: inScopedDepartments },
      },
    },
  };
  const scopedOffering = {
    course: { departmentId: inScopedDepartments },
    semester: { program: { departmentId: inScopedDepartments } },
  };
  const scopedUser = {
    OR: [
      scopedStudent,
      { facultyCourseOfferings: { some: { institutionId, course: { departmentId: inScopedDepartments } } } },
      { employeeProfile: { departmentId: inScopedDepartments } },
    ],
  };

  const [
    users,
    students,
    faculty,
    departments,
    programs,
    sections,
    courses,
    offerings,
    attendanceSessions,
    assignments,
    internalMarks,
    exams,
    examResults,
    invoiceAggregate,
    paidInvoices,
    documents,
    notifications,
    notices,
  ] =
    await Promise.all([
      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          ...(isDepartmentScoped ? scopedUser : {}),
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "STUDENT" } } },
          ...(isDepartmentScoped ? scopedStudent : {}),
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "FACULTY" } } },
          ...(isDepartmentScoped ? { facultyCourseOfferings: { some: { institutionId, course: { departmentId: inScopedDepartments } } } } : {}),
        },
      }),

      prisma.department.count({
        where: { institutionId, isActive: true, ...(isDepartmentScoped ? { id: inScopedDepartments } : {}) },
      }),

      prisma.program.count({
        where: { institutionId, isActive: true, ...(isDepartmentScoped ? { departmentId: inScopedDepartments } : {}) },
      }),

      prisma.section.count({
        where: { institutionId, isActive: true, ...(isDepartmentScoped ? { semester: { program: { departmentId: inScopedDepartments } } } : {}) },
      }),

      prisma.course.count({
        where: { institutionId, isActive: true, ...(isDepartmentScoped ? { departmentId: inScopedDepartments } : {}) },
      }),

      prisma.courseOffering.count({
        where: { institutionId, isActive: true, ...(isDepartmentScoped ? scopedOffering : {}) },
      }),

      prisma.attendanceSession.count({
        where: { institutionId, ...(isDepartmentScoped ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.assignment.count({
        where: { institutionId, ...(isDepartmentScoped ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.internalMark.count({
        where: { institutionId, ...(isDepartmentScoped ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.exam.count({
        where: { institutionId, ...(isDepartmentScoped ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.examResult.count({
        where: { institutionId, ...(isDepartmentScoped ? { exam: { courseOffering: scopedOffering } } : {}) },
      }),

      prisma.feeInvoice.aggregate({
        where: { institutionId, ...(isDepartmentScoped ? { student: scopedStudent } : {}) },
        _count: {
          _all: true,
        },
        _sum: {
          amount:
            true,
        },
      }),

      prisma.feeInvoice.count({
        where: { institutionId, status: "PAID", ...(isDepartmentScoped ? { student: scopedStudent } : {}) },
      }),

      prisma.document.count({
        where: { institutionId, ...(isDepartmentScoped ? { owner: scopedUser } : {}) },
      }),

      prisma.notification.count({
        where: { institutionId, ...(isDepartmentScoped ? { user: scopedUser } : {}) },
      }),

      prisma.notice.findMany({
        where: {
          institutionId,
          publishedAt: {
            lte:
              now,
          },
          OR: [
            {
              expiresAt:
                null,
            },
            {
              expiresAt: {
                gt:
                  now,
              },
            },
          ],
          audience: {
            in: [
              "ALL",
              ...actor.roles,
            ],
          },
          ...(isDepartmentScoped
            ? {
                AND: [
                  {
                    OR: [
                      { departmentId: null },
                      { departmentId: inScopedDepartments },
                    ],
                  },
                ],
              }
            : {}),
        },

        orderBy: {
          publishedAt:
            "desc",
        },

        take: 10,
      }),
    ]);

  return {
    workspaceType:
      getWorkspaceType(
        actor
      ),

    stats: {
      users,
      students,
      faculty,
      departments,
      programs,
      sections,
      courses,
      offerings,
      attendanceSessions,
      assignments,
      internalMarks,
      exams,
      examResults,
      documents,
      notifications,

      totalInvoices:
        invoiceAggregate
          ._count
          ._all,

      totalInvoiced:
        Number(
          invoiceAggregate
            ._sum
            .amount ??
            0
        ),

      paidInvoices,
    },

    timetable: [],
    notices,
    notifications: [],
    documents: [],
    fees: [],
    exams: [],
    students: [],
    facultyOfferings: [],
    departments: [],
  };
}
