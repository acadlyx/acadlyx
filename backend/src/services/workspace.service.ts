import { prisma } from "../lib/prisma";
import { getCanonicalRoleNames } from "../config/rbac";
import { AuthenticatedUser } from "../types/auth";
import * as erp from "./erp.service";

const FAST_LEADERSHIP_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "REGISTRAR",
];

function hasAnyRole(
  actor: AuthenticatedUser,
  roles: string[]
): boolean {
  const actorRoles = getCanonicalRoleNames(actor.roles);
  const allowedRoles = getCanonicalRoleNames(roles);

  return actorRoles.some((role) =>
    allowedRoles.includes(role)
  );
}

function workspaceType(
  actor: AuthenticatedUser
): string {
  const roles = getCanonicalRoleNames(
    actor.roles
  );

  if (roles.includes("CHAIRMAN")) {
    return "CHAIRMAN";
  }

  if (roles.includes("DIRECTOR")) {
    return "DIRECTOR";
  }

  if (roles.includes("DEAN")) {
    return "DEAN";
  }

  if (roles.includes("REGISTRAR")) {
    return "REGISTRAR";
  }

  return "INSTITUTION_ADMIN";
}

async function getFastLeadershipWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const now = new Date();

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
  ] = await Promise.all([
    prisma.user.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.user.count({
      where: {
        institutionId,
        isActive: true,
        userRoles: {
          some: {
            role: {
              name: "STUDENT",
            },
          },
        },
      },
    }),

    prisma.user.count({
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
      },
    }),

    prisma.department.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.program.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.section.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.course.count({
      where: {
        institutionId,
        isActive: true,
      },
    }),

    prisma.courseOffering.count({
      where: {
        institutionId,
        isActive: true,
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

    /*
     * IMPORTANT PERFORMANCE FIX
     *
     * The old workspace loaded every fee invoice:
     *
     * feeInvoice.findMany(...)
     *
     * and then used JavaScript reduce/filter to
     * calculate dashboard totals.
     *
     * That becomes increasingly expensive as the
     * institution grows.
     *
     * PostgreSQL now performs the count and SUM.
     * Only the final aggregate values cross the
     * database connection.
     */
    prisma.feeInvoice.aggregate({
      where: {
        institutionId,
      },
      _count: {
        _all: true,
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.feeInvoice.count({
      where: {
        institutionId,
        status: "PAID",
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

    /*
     * Notices are loaded at the same time as the
     * dashboard statistics instead of waiting for
     * the entire KPI query group to finish first.
     */
    prisma.notice.findMany({
      where: {
        institutionId,
        publishedAt: {
          lte: now,
        },
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
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
        publishedAt: "desc",
      },
      take: 10,
    }),
  ]);

  return {
    workspaceType:
      workspaceType(actor),

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
        invoiceAggregate._count._all,

      totalInvoiced:
        Number(
          invoiceAggregate._sum.amount ??
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

export async function getWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  /*
   * Leadership accounts use the optimized
   * institutional dashboard query.
   *
   * Every other stakeholder continues through
   * the existing ERP workspace implementation so
   * HOD/faculty/student/parent scoping is left
   * completely untouched.
   */
  if (
    hasAnyRole(
      actor,
      FAST_LEADERSHIP_ROLES
    )
  ) {
    return getFastLeadershipWorkspace(
      institutionId,
      actor
    );
  }

  return erp.getMyWorkspace(
    institutionId,
    actor
  );
}
