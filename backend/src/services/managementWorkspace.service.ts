import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";

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
  if (actor.roles.includes("CHAIRMAN")) {
    return "CHAIRMAN";
  }

  if (actor.roles.includes("DIRECTOR")) {
    return "DIRECTOR";
  }

  if (actor.roles.includes("DEAN")) {
    return "DEAN";
  }

  if (actor.roles.includes("REGISTRAR")) {
    return "REGISTRAR";
  }

  return "INSTITUTION_ADMIN";
}

export function isLeadershipActor(
  actor: AuthenticatedUser
): boolean {
  return actor.roles.some((role) =>
    LEADERSHIP_ROLES.includes(role)
  );
}

/**
 * Optimized institution-level ERP workspace.
 *
 * IMPORTANT:
 * This service intentionally performs aggregation in PostgreSQL.
 *
 * The previous implementation fetched every fee invoice and then
 * calculated totals with JavaScript reduce/filter operations.
 *
 * That becomes increasingly expensive as an institution grows.
 *
 * We now ask PostgreSQL for:
 *
 * - invoice count
 * - total invoice amount
 * - paid invoice count
 *
 * Only the final numbers are returned to Node.
 */
export async function getManagementWorkspace(
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
      getWorkspaceType(actor),

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
          invoiceAggregate._sum.amount ?? 0
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
