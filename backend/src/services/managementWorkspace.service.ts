import { prisma } from "../lib/prisma";
import { getDirectorCampusIds, getDirectorDepartmentIds } from "./accessScope.service";
import { AppError } from "../middleware/errorHandler";
import {
  AuthenticatedUser,
} from "../types/auth";

const LEADERSHIP_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
];

function getWorkspaceType(
  actor: AuthenticatedUser
): string {
  if (
    actor.roles.includes(
      "CHAIRMAN"
    )
  ) {
    return "CHAIRMAN";
  }

  if (
    actor.roles.includes(
      "DIRECTOR"
    )
  ) {
    return "DIRECTOR";
  }

  if (
    actor.roles.includes(
      "DEAN"
    )
  ) {
    return "DEAN";
  }

  if (
    actor.roles.includes(
      "REGISTRAR"
    )
  ) {
    return "REGISTRAR";
  }

  return "INSTITUTION_ADMIN";
}

export function isLeadershipActor(
  actor: AuthenticatedUser
): boolean {
  return actor.roles.some(
    (role) =>
      LEADERSHIP_ROLES.includes(
        role
      )
  );
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
  // This endpoint is reachable directly, so never infer admin authority from
  // getWorkspaceType()'s fallback for unrecognized roles.
  if (actor.roles.includes("INSTITUTION_ADMIN")) {
    return getInstitutionAdminWorkspace(institutionId, actor);
  }
  const allowedSummaryRoles = ["CHAIRMAN", "DIRECTOR", "DEAN"];
  if (!actor.roles.some((role) => allowedSummaryRoles.includes(role))) {
    throw new AppError("A leadership summary is not available for this workspace", 403);
  }
  const workspaceType = getWorkspaceType(actor);

  const activeUser = { institutionId, isActive: true };
  const studentRole = { userRoles: { some: { role: { name: "STUDENT" } } } };
  const facultyRole = { userRoles: { some: { role: { name: "FACULTY" } } } };

  if (workspaceType === "CHAIRMAN") {
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
    const [students, faculty, programs, courses, assignments, exams] = await Promise.all([
      prisma.user.count({ where: { ...activeUser, ...studentRole } }),
      prisma.user.count({ where: { ...activeUser, ...facultyRole } }),
      prisma.program.count({ where: { institutionId, isActive: true } }),
      prisma.course.count({ where: { institutionId, isActive: true } }),
      prisma.assignment.count({ where: { institutionId } }),
      prisma.exam.count({ where: { institutionId } }),
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
  if (
    actor.roles.includes(
      "INSTITUTION_ADMIN"
    )
  ) {
    return getInstitutionAdminWorkspace(
      institutionId,
      actor
    );
  }

  const now = new Date();
  // Resolve scope from the active leadership workspace, not merely a secondary role.
  // Users with both CHAIRMAN and DIRECTOR roles must retain institution-wide Chairman scope.
  const isDirector = getWorkspaceType(actor) === "DIRECTOR";
  const directorCampusIds = isDirector
    ? await getDirectorCampusIds(institutionId, actor.id)
    : [];
  if (isDirector && directorCampusIds.length === 0) {
    throw new AppError("No campus scope is assigned to this director", 403);
  }
  // A valid campus assignment remains valid even before departments are
  // created. In that case department-scoped KPIs should safely return zero,
  // not misreport missing authorization.
  const directorDepartmentIds = isDirector
    ? await getDirectorDepartmentIds(institutionId, actor.id)
    : [];
  const inDirectorScope = { in: directorDepartmentIds };
  const scopedStudent = {
    studentEnrollments: {
      some: {
        institutionId,
        status: "ACTIVE",
        program: { departmentId: inDirectorScope },
      },
    },
  };
  const scopedOffering = {
    course: { departmentId: inDirectorScope },
    semester: { program: { departmentId: inDirectorScope } },
  };
  const scopedUser = {
    OR: [
      scopedStudent,
      { facultyCourseOfferings: { some: { institutionId, course: { departmentId: inDirectorScope } } } },
      { employeeProfile: { departmentId: inDirectorScope } },
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
          ...(isDirector ? scopedUser : {}),
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "STUDENT" } } },
          ...(isDirector ? scopedStudent : {}),
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive: true,
          userRoles: { some: { role: { name: "FACULTY" } } },
          ...(isDirector ? { facultyCourseOfferings: { some: { institutionId, course: { departmentId: inDirectorScope } } } } : {}),
        },
      }),

      prisma.department.count({
        where: { institutionId, isActive: true, ...(isDirector ? { id: inDirectorScope } : {}) },
      }),

      prisma.program.count({
        where: { institutionId, isActive: true, ...(isDirector ? { departmentId: inDirectorScope } : {}) },
      }),

      prisma.section.count({
        where: { institutionId, isActive: true, ...(isDirector ? { semester: { program: { departmentId: inDirectorScope } } } : {}) },
      }),

      prisma.course.count({
        where: { institutionId, isActive: true, ...(isDirector ? { departmentId: inDirectorScope } : {}) },
      }),

      prisma.courseOffering.count({
        where: { institutionId, isActive: true, ...(isDirector ? scopedOffering : {}) },
      }),

      prisma.attendanceSession.count({
        where: { institutionId, ...(isDirector ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.assignment.count({
        where: { institutionId, ...(isDirector ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.internalMark.count({
        where: { institutionId, ...(isDirector ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.exam.count({
        where: { institutionId, ...(isDirector ? { courseOffering: scopedOffering } : {}) },
      }),

      prisma.examResult.count({
        where: { institutionId, ...(isDirector ? { exam: { courseOffering: scopedOffering } } : {}) },
      }),

      prisma.feeInvoice.aggregate({
        where: { institutionId, ...(isDirector ? { student: scopedStudent } : {}) },
        _count: {
          _all: true,
        },
        _sum: {
          amount:
            true,
        },
      }),

      prisma.feeInvoice.count({
        where: { institutionId, status: "PAID", ...(isDirector ? { student: scopedStudent } : {}) },
      }),

      prisma.document.count({
        where: { institutionId, ...(isDirector ? { owner: scopedUser } : {}) },
      }),

      prisma.notification.count({
        where: { institutionId, ...(isDirector ? { user: scopedUser } : {}) },
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
