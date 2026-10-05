import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
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
 * Returns the number of users in an institution that
 * currently have a profile photo.
 *
 * Kept as a separate async function so the Prisma
 * $queryRaw result is correctly typed as a Promise and
 * can safely be consumed by Promise.all().
 */
async function getUsersWithProfilePhotoCount(
  institutionId: string
): Promise<number> {
  const rows =
    await prisma.$queryRaw<
      Array<{
        count: bigint;
      }>
    >(
      Prisma.sql`
        SELECT
          COUNT(*)::bigint AS count
        FROM
          "user_profile_photos" p
        INNER JOIN
          "users" u
          ON u."id" = p."userId"
        WHERE
          u."institutionId" =
          ${institutionId}
      `
    );

  return Number(
    rows[0]?.count ?? 0
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

  const now =
    new Date();

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
          isActive:
            true,
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive:
            true,
          userRoles: {
            some: {
              role: {
                name:
                  "STUDENT",
              },
            },
          },
        },
      }),

      prisma.user.count({
        where: {
          institutionId,
          isActive:
            true,
          userRoles: {
            some: {
              role: {
                name:
                  "FACULTY",
              },
            },
          },
        },
      }),

      prisma.department.count({
        where: {
          institutionId,
          isActive:
            true,
        },
      }),

      prisma.program.count({
        where: {
          institutionId,
          isActive:
            true,
        },
      }),

      prisma.section.count({
        where: {
          institutionId,
          isActive:
            true,
        },
      }),

      prisma.course.count({
        where: {
          institutionId,
          isActive:
            true,
        },
      }),

      prisma.courseOffering.count({
        where: {
          institutionId,
          isActive:
            true,
        },
      }),

      prisma.attendanceSession.count({
        where: {
          institutionId,
        },
      }),

      prisma.assignment.count({
        where: {
          institutionId,
        },
      }),

      prisma.internalMark.count({
        where: {
          institutionId,
        },
      }),

      prisma.exam.count({
        where: {
          institutionId,
        },
      }),

      prisma.examResult.count({
        where: {
          institutionId,
        },
      }),

      prisma.feeInvoice.aggregate({
        where: {
          institutionId,
        },
        _count: {
          _all: true,
        },
        _sum: {
          amount:
            true,
        },
      }),

      prisma.feeInvoice.count({
        where: {
          institutionId,
          status:
            "PAID",
        },
      }),

      prisma.document.count({
        where: {
          institutionId,
        },
      }),

      prisma.notification.count({
        where: {
          institutionId,
        },
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
