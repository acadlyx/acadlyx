import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";

import {
  getCanonicalRoleNames,
} from "../config/rbac";

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

function hasAnyRole(
  actor: AuthenticatedUser,
  roles: string[]
): boolean {
  const actorRoles =
    getCanonicalRoleNames(
      actor.roles
    );

  const allowedRoles =
    getCanonicalRoleNames(
      roles
    );

  return actorRoles.some(
    (role) =>
      allowedRoles.includes(
        role
      )
  );
}

function getWorkspaceType(
  actor: AuthenticatedUser
): string {
  const roles =
    getCanonicalRoleNames(
      actor.roles
    );

  if (
    roles.includes(
      "CHAIRMAN"
    )
  ) {
    return "CHAIRMAN";
  }

  if (
    roles.includes(
      "DIRECTOR"
    )
  ) {
    return "DIRECTOR";
  }

  if (
    roles.includes(
      "DEAN"
    )
  ) {
    return "DEAN";
  }

  if (
    roles.includes(
      "REGISTRAR"
    )
  ) {
    return "REGISTRAR";
  }

  return "INSTITUTION_ADMIN";
}

interface LeadershipStatsRow {
  users: bigint;
  students: bigint;
  faculty: bigint;
  departments: bigint;
  programs: bigint;
  sections: bigint;
  courses: bigint;
  offerings: bigint;
  attendanceSessions: bigint;
  assignments: bigint;
  internalMarks: bigint;
  exams: bigint;
  examResults: bigint;
  documents: bigint;
  notifications: bigint;
  totalInvoices: bigint;
  totalInvoiced: number | null;
  paidInvoices: bigint;
}

/*
 * Fast institution-level workspace.
 *
 * This is deliberately kept separate from the large legacy ERP workspace.
 *
 * The leadership dashboard only needs:
 *
 *   - KPI counters
 *   - recent notices
 *   - workspace identity
 *
 * It does NOT need the complete ERP data graph.
 *
 * Hosted PostgreSQL/pooler connections are particularly sensitive to
 * excessive sequential round trips, so PostgreSQL performs the aggregation.
 */
async function getFastLeadershipWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const rows =
    await prisma.$queryRaw<
      LeadershipStatsRow[]
    >(
      Prisma.sql`
        SELECT
          (
            SELECT COUNT(*)
            FROM "users" u
            WHERE
              u."institutionId" = ${institutionId}
              AND u."isActive" = true
          ) AS "users",

          (
            SELECT COUNT(DISTINCT u."id")
            FROM "users" u
            INNER JOIN "user_roles" ur
              ON ur."userId" = u."id"
            INNER JOIN "roles" r
              ON r."id" = ur."roleId"
            WHERE
              u."institutionId" = ${institutionId}
              AND u."isActive" = true
              AND r."name" = 'STUDENT'
          ) AS "students",

          (
            SELECT COUNT(DISTINCT u."id")
            FROM "users" u
            INNER JOIN "user_roles" ur
              ON ur."userId" = u."id"
            INNER JOIN "roles" r
              ON r."id" = ur."roleId"
            WHERE
              u."institutionId" = ${institutionId}
              AND u."isActive" = true
              AND r."name" = 'FACULTY'
          ) AS "faculty",

          (
            SELECT COUNT(*)
            FROM "departments" d
            WHERE
              d."institutionId" = ${institutionId}
              AND d."isActive" = true
          ) AS "departments",

          (
            SELECT COUNT(*)
            FROM "programs" p
            WHERE
              p."institutionId" = ${institutionId}
              AND p."isActive" = true
          ) AS "programs",

          (
            SELECT COUNT(*)
            FROM "sections" s
            WHERE
              s."institutionId" = ${institutionId}
              AND s."isActive" = true
          ) AS "sections",

          (
            SELECT COUNT(*)
            FROM "courses" c
            WHERE
              c."institutionId" = ${institutionId}
              AND c."isActive" = true
          ) AS "courses",

          (
            SELECT COUNT(*)
            FROM "course_offerings" co
            WHERE
              co."institutionId" = ${institutionId}
              AND co."isActive" = true
          ) AS "offerings",

          (
            SELECT COUNT(*)
            FROM "attendance_sessions" a
            WHERE
              a."institutionId" = ${institutionId}
          ) AS "attendanceSessions",

          (
            SELECT COUNT(*)
            FROM "assignments" a
            WHERE
              a."institutionId" = ${institutionId}
          ) AS "assignments",

          (
            SELECT COUNT(*)
            FROM "internal_marks" m
            WHERE
              m."institutionId" = ${institutionId}
          ) AS "internalMarks",

          (
            SELECT COUNT(*)
            FROM "exams" e
            WHERE
              e."institutionId" = ${institutionId}
          ) AS "exams",

          (
            SELECT COUNT(*)
            FROM "exam_results" er
            WHERE
              er."institutionId" = ${institutionId}
          ) AS "examResults",

          (
            SELECT COUNT(*)
            FROM "documents" d
            WHERE
              d."institutionId" = ${institutionId}
          ) AS "documents",

          (
            SELECT COUNT(*)
            FROM "notifications" n
            WHERE
              n."institutionId" = ${institutionId}
          ) AS "notifications",

          (
            SELECT COUNT(*)
            FROM "fee_invoices" fi
            WHERE
              fi."institutionId" = ${institutionId}
          ) AS "totalInvoices",

          (
            SELECT COALESCE(
              SUM(fi."amount"),
              0
            )
            FROM "fee_invoices" fi
            WHERE
              fi."institutionId" = ${institutionId}
          ) AS "totalInvoiced",

          (
            SELECT COUNT(*)
            FROM "fee_invoices" fi
            WHERE
              fi."institutionId" = ${institutionId}
              AND fi."status" = 'PAID'
          ) AS "paidInvoices"
      `
    );

  const stats =
    rows[0];

  if (!stats) {
    throw new Error(
      "Unable to build institutional workspace statistics"
    );
  }

  const now =
    new Date();

  /*
   * Keep the notice payload deliberately small.
   *
   * The full notices endpoint remains responsible for the complete
   * institution notice dataset.
   */
  const notices =
    await prisma.notice.findMany({
      where: {
        institutionId,

        publishedAt: {
          lte: now,
        },

        OR: [
          {
            expiresAt:
              null,
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
        publishedAt:
          "desc",
      },

      take: 10,

      select: {
        id: true,
        title: true,
        body: true,
        audience: true,
        departmentId: true,
        expiresAt: true,
        publishedAt: true,
      },
    });

  return {
    workspaceType:
      getWorkspaceType(
        actor
      ),

    stats: {
      users:
        Number(
          stats.users
        ),

      students:
        Number(
          stats.students
        ),

      faculty:
        Number(
          stats.faculty
        ),

      departments:
        Number(
          stats.departments
        ),

      programs:
        Number(
          stats.programs
        ),

      sections:
        Number(
          stats.sections
        ),

      courses:
        Number(
          stats.courses
        ),

      offerings:
        Number(
          stats.offerings
        ),

      attendanceSessions:
        Number(
          stats.attendanceSessions
        ),

      assignments:
        Number(
          stats.assignments
        ),

      internalMarks:
        Number(
          stats.internalMarks
        ),

      exams:
        Number(
          stats.exams
        ),

      examResults:
        Number(
          stats.examResults
        ),

      documents:
        Number(
          stats.documents
        ),

      notifications:
        Number(
          stats.notifications
        ),

      totalInvoices:
        Number(
          stats.totalInvoices
        ),

      totalInvoiced:
        Number(
          stats.totalInvoiced ??
            0
        ),

      paidInvoices:
        Number(
          stats.paidInvoices
        ),
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

export function isLeadershipActor(
  actor: AuthenticatedUser
): boolean {
  return hasAnyRole(
    actor,
    LEADERSHIP_ROLES
  );
}

export async function getWorkspace(
  institutionId: string,
  actor: AuthenticatedUser
) {
  /*
   * Leadership dashboards use the fast aggregate path.
   */
  if (
    isLeadershipActor(
      actor
    )
  ) {
    return getFastLeadershipWorkspace(
      institutionId,
      actor
    );
  }

  return erpWorkspaceFallback(
    institutionId,
    actor
  );
}

/*
 * ---------------------------------------------------------------------------
 * LEGACY ERP FALLBACK
 * ---------------------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * Do not load erp.service while a leadership dashboard is being initialized.
 *
 * The previous dynamic import was rejected by the TypeScript Node16 resolver
 * in the Render build even though the service file exists.
 *
 * This lazy CommonJS load keeps the large service completely off the
 * leadership critical path and also avoids the Node16 dynamic-import
 * resolution problem.
 */

async function erpWorkspaceFallback(
  institutionId: string,
  actor: AuthenticatedUser
) {
  const loadErpService =
    require("./erp.service") as {
      getMyWorkspace: (
        institutionId: string,
        actor: AuthenticatedUser
      ) => Promise<unknown>;
    };

  return loadErpService.getMyWorkspace(
    institutionId,
    actor
  );
}
