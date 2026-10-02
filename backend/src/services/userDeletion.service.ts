import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

/**
 * Permanent account deletion is intentionally stricter than normal
 * deactivation.
 *
 * Higher number = higher institutional authority.
 *
 * SUPER_ADMIN is platform authority and can execute permanent deletion
 * directly. Every other role creates an approval request that must be
 * approved by a strictly higher authority than both the requester and
 * the target account.
 */
const AUTHORITY_RANK: Record<string, number> = {
  SUPER_ADMIN: 1000,

  CHAIRMAN: 900,
  DIRECTOR: 800,
  DEAN: 700,
  REGISTRAR: 600,

  INSTITUTION_ADMIN: 550,
  HOD: 500,

  ACCOUNTS: 350,
  HR: 350,
  ADMISSIONS: 350,
  EXAMINATION: 350,
  LIBRARIAN: 350,
  PLACEMENT: 350,
  IT: 350,

  CMS: 300,

  FACULTY: 200,
  CLUB_PRESIDENT: 100,
  STUDENT: 50,
  PARENT: 10,
};

type DeletionRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export interface UserDeletionRequest {
  id: string;
  institutionId: string | null;
  targetUserId: string | null;

  targetUser: {
    id: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };

  requester: {
    id: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };

  approver: {
    id: string | null;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;

  status: DeletionRequestStatus;
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  canApprove: boolean;
}

function highestAuthorityRole(
  roles: string[],
): string {
  return [...roles].sort(
    (a, b) =>
      (AUTHORITY_RANK[b] ?? 0) -
      (AUTHORITY_RANK[a] ?? 0),
  )[0] ?? "";
}

function authorityRank(
  role: string,
): number {
  return AUTHORITY_RANK[role] ?? 0;
}

function isSuperAdmin(
  actor: AuthenticatedUser,
): boolean {
  return actor.roles.includes("SUPER_ADMIN");
}

async function requireActorRecord(
  actor: AuthenticatedUser,
) {
  const user =
    await prisma.user.findUnique({
      where: {
        id: actor.id,
      },

      select: {
        id: true,
        institutionId: true,
        isActive: true,
        firstName: true,
        lastName: true,
        email: true,

        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  if (!user) {
    throw new AppError(
      "Authenticated user was not found",
      401,
    );
  }

  if (!user.isActive) {
    throw new AppError(
      "Your account is inactive",
      403,
    );
  }

  return user;
}

async function getTarget(
  id: string,
  actor: AuthenticatedUser,
) {
  const target =
    await prisma.user.findFirst({
      where: {
        id,

        ...(isSuperAdmin(actor)
          ? {}
          : {
              institutionId:
                actor.institutionId,
            }),
      },

      select: {
        id: true,
        institutionId: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,

        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  if (!target) {
    throw new AppError(
      "User not found",
      404,
    );
  }

  return target;
}

function targetRole(
  roles: Array<{
    role: {
      name: string;
    };
  }>,
): string {
  return highestAuthorityRole(
    roles.map(
      (binding) =>
        binding.role.name,
    ),
  );
}

function assertTargetCanBePermanentlyDeleted(
  actor: AuthenticatedUser,
  target: {
    id: string;
    institutionId: string | null;
    userRoles: Array<{
      role: {
        name: string;
      };
    }>;
  },
) {
  if (target.id === actor.id) {
    throw new AppError(
      "You cannot permanently delete your own account",
      400,
    );
  }

  const role =
    targetRole(
      target.userRoles,
    );

  if (
    role === "SUPER_ADMIN" &&
    !isSuperAdmin(actor)
  ) {
    throw new AppError(
      "Only SUPER_ADMIN can permanently delete a SUPER_ADMIN account",
      403,
    );
  }
}

async function deleteUserPermanently(
  targetId: string,
  actor: AuthenticatedUser,
  auditAction: string,
) {
  const target =
    await getTarget(
      targetId,
      actor,
    );

  assertTargetCanBePermanentlyDeleted(
    actor,
    target,
  );

  const targetRoleName =
    targetRole(
      target.userRoles,
    );

  /*
   * Never allow the last active SUPER_ADMIN to disappear.
   */
  if (
    targetRoleName ===
      "SUPER_ADMIN" &&
    isSuperAdmin(actor)
  ) {
    const otherSuperAdmins =
      await prisma.user.count({
        where: {
          id: {
            not: target.id,
          },

          isActive: true,

          userRoles: {
            some: {
              role: {
                name:
                  "SUPER_ADMIN",
              },
            },
          },
        },
      });

    if (
      otherSuperAdmins === 0
    ) {
      throw new AppError(
        "The last active SUPER_ADMIN account cannot be permanently deleted",
        400,
      );
    }
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        /*
         * The deletion-request table keeps a snapshot of the account.
         *
         * target_user_id is ON DELETE SET NULL, so approval history
         * survives after the actual account is removed.
         */
        await tx.user.delete({
          where: {
            id: target.id,
          },
        });
      },
    );
  } catch (error) {
    /*
     * Some historical/academic records intentionally use ON DELETE
     * RESTRICT. We must not silently destroy institutional history.
     */
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new AppError(
        "This account has protected institutional records and cannot be permanently deleted. Deactivate the account instead.",
        409,
      );
    }

    throw error;
  }

  await recordAuditLog({
    institutionId:
      target.institutionId,

    userId:
      actor.id,

    action:
      auditAction,

    entityType:
      "User",

    entityId:
      target.id,

    metadata: {
      email:
        target.email,

      firstName:
        target.firstName,

      lastName:
        target.lastName,

      role:
        targetRole(
          target.userRoles,
        ),
    },
  });

  return {
    userId:
      target.id,

    permanentlyDeleted:
      true,
  };
}

async function hasHigherApprover(
  institutionId: string | null,
  requesterRank: number,
  targetRank: number,
): Promise<boolean> {
  /*
   * SUPER_ADMIN can approve platform-wide.
   */
  const superAdmin =
    await prisma.user.findFirst({
      where: {
        isActive: true,

        userRoles: {
          some: {
            role: {
              name:
                "SUPER_ADMIN",
            },
          },
        },
      },

      select: {
        id: true,
      },
    });

  if (superAdmin) {
    return true;
  }

  if (!institutionId) {
    return false;
  }

  const minimumRank =
    Math.max(
      requesterRank,
      targetRank,
    );

  const candidates =
    await prisma.user.findMany({
      where: {
        institutionId,

        isActive: true,

        userRoles: {
          some: {},
        },
      },

      select: {
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  return candidates.some(
    (candidate) =>
      candidate.userRoles.some(
        (binding) =>
          authorityRank(
            binding.role.name,
          ) >
          minimumRank,
      ),
  );
}

export async function requestPermanentDeletion(
  targetId: string,
  actor: AuthenticatedUser,
  reason?: string,
) {
  const actorRecord =
    await requireActorRecord(
      actor,
    );

  const target =
    await getTarget(
      targetId,
      actor,
    );

  assertTargetCanBePermanentlyDeleted(
    actor,
    target,
  );

  /*
   * SUPER_ADMIN is the platform authority.
   * No second approval is required.
   */
  if (
    isSuperAdmin(actor)
  ) {
    return deleteUserPermanently(
      target.id,
      actor,
      "user.permanent_delete",
    );
  }

  if (
    !actorRecord.institutionId ||
    target.institutionId !==
      actorRecord.institutionId
  ) {
    throw new AppError(
      "Permanent deletion is restricted to your institution",
      403,
    );
  }

  const requesterRole =
    highestAuthorityRole(
      actorRecord.userRoles.map(
        (binding) =>
          binding.role.name,
      ),
    );

  const targetRoleName =
    targetRole(
      target.userRoles,
    );

  const requesterRank =
    authorityRank(
      requesterRole,
    );

  const targetRank =
    authorityRank(
      targetRoleName,
    );

  /*
   * There must actually be someone capable of approving the request.
   */
  if (
    !(await hasHigherApprover(
      actorRecord.institutionId,
      requesterRank,
      targetRank,
    ))
  ) {
    throw new AppError(
      "No higher authority is currently available to approve permanent deletion. Deactivate the account instead.",
      409,
    );
  }

  const duplicate =
    await prisma.$queryRaw<
      Array<{
        id: string;
      }>
    >(
      Prisma.sql`
        SELECT id
        FROM user_deletion_requests
        WHERE target_user_id =
          ${target.id}::uuid
          AND status = 'PENDING'
        LIMIT 1
      `,
    );

  if (
    duplicate.length
  ) {
    throw new AppError(
      "A permanent-deletion request for this account is already pending",
      409,
    );
  }

  const id =
    randomUUID();

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO user_deletion_requests (
        id,
        institution_id,
        target_user_id,
        target_first_name,
        target_last_name,
        target_email,
        target_role,
        requester_user_id,
        requester_first_name,
        requester_last_name,
        requester_email,
        requester_role,
        requester_rank,
        target_rank,
        reason,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${id}::uuid,
        ${target.institutionId}::uuid,
        ${target.id}::uuid,
        ${target.firstName},
        ${target.lastName},
        ${target.email},
        ${targetRoleName},
        ${actorRecord.id}::uuid,
        ${actorRecord.firstName},
        ${actorRecord.lastName},
        ${actorRecord.email},
        ${requesterRole},
        ${requesterRank},
        ${targetRank},
        ${reason?.trim() || null},
        'PENDING',
        NOW(),
        NOW()
      )
    `,
  );

  await recordAuditLog({
    institutionId:
      target.institutionId,

    userId:
      actor.id,

    action:
      "user.permanent_delete.requested",

    entityType:
      "User",

    entityId:
      target.id,

    metadata: {
      requestId:
        id,

      targetEmail:
        target.email,

      targetRole:
        targetRoleName,

      requesterRole,

      reason:
        reason?.trim() ||
        null,
    },
  });

  return {
    id,

    status:
      "PENDING" as const,

    targetUserId:
      target.id,

    targetEmail:
      target.email,

    targetRole:
      targetRoleName,

    message:
      "Permanent deletion request submitted for higher-authority approval.",
  };
}

function mapRequest(
  row: {
    id: string;
    institution_id: string | null;
    target_user_id: string | null;

    target_first_name: string;
    target_last_name: string;
    target_email: string;
    target_role: string;

    requester_user_id: string | null;
    requester_first_name: string;
    requester_last_name: string;
    requester_email: string;
    requester_role: string;

    approver_user_id: string | null;
    approver_first_name: string | null;
    approver_last_name: string | null;
    approver_email: string | null;
    approver_role: string | null;

    status:
      DeletionRequestStatus;

    reason: string | null;

    created_at: Date;
    reviewed_at: Date | null;

    can_approve: boolean;
  },
): UserDeletionRequest {
  return {
    id:
      row.id,

    institutionId:
      row.institution_id,

    targetUserId:
      row.target_user_id,

    targetUser: {
      id:
        row.target_user_id,

      firstName:
        row.target_first_name,

      lastName:
        row.target_last_name,

      email:
        row.target_email,

      role:
        row.target_role,
    },

    requester: {
      id:
        row.requester_user_id,

      firstName:
        row.requester_first_name,

      lastName:
        row.requester_last_name,

      email:
        row.requester_email,

      role:
        row.requester_role,
    },

    approver:
      row.approver_user_id
        ? {
            id:
              row.approver_user_id,

            firstName:
              row.approver_first_name ??
              "",

            lastName:
              row.approver_last_name ??
              "",

            email:
              row.approver_email ??
              "",

            role:
              row.approver_role ??
              "",
          }
        : null,

    status:
      row.status,

    reason:
      row.reason,

    createdAt:
      row.created_at.toISOString(),

    reviewedAt:
      row.reviewed_at?.toISOString() ??
      null,

    canApprove:
      Boolean(
        row.can_approve,
      ),
  };
}

export async function listPermanentDeletionRequests(
  actor: AuthenticatedUser,
): Promise<UserDeletionRequest[]> {
  const actorRecord =
    await requireActorRecord(
      actor,
    );

  const actorRole =
    highestAuthorityRole(
      actorRecord.userRoles.map(
        (binding) =>
          binding.role.name,
      ),
    );

  const actorRank =
    authorityRank(
      actorRole,
    );

  const institutionFilter =
    isSuperAdmin(actor)
      ? Prisma.sql`TRUE`
      : Prisma.sql`
          institution_id =
          ${actorRecord.institutionId}::uuid
        `;

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;
        institution_id:
          string | null;

        target_user_id:
          string | null;

        target_first_name:
          string;

        target_last_name:
          string;

        target_email:
          string;

        target_role:
          string;

        requester_user_id:
          string | null;

        requester_first_name:
          string;

        requester_last_name:
          string;

        requester_email:
          string;

        requester_role:
          string;

        approver_user_id:
          string | null;

        approver_first_name:
          string | null;

        approver_last_name:
          string | null;

        approver_email:
          string | null;

        approver_role:
          string | null;

        status:
          DeletionRequestStatus;

        reason:
          string | null;

        created_at:
          Date;

        reviewed_at:
          Date | null;

        can_approve:
          boolean;
      }>
    >(
      Prisma.sql`
        SELECT
          r.id,
          r.institution_id,
          r.target_user_id,
          r.target_first_name,
          r.target_last_name,
          r.target_email,
          r.target_role,
          r.requester_user_id,
          r.requester_first_name,
          r.requester_last_name,
          r.requester_email,
          r.requester_role,
          r.approver_user_id,
          r.approver_first_name,
          r.approver_last_name,
          r.approver_email,
          r.approver_role,
          r.status,
          r.reason,
          r.created_at,
          r.reviewed_at,

          (
            r.status = 'PENDING'
            AND ${actorRank} >
              r.requester_rank
            AND ${actorRank} >
              r.target_rank
            AND r.requester_user_id
              IS DISTINCT FROM
              ${actor.id}::uuid
          ) AS can_approve

        FROM user_deletion_requests r

        WHERE ${institutionFilter}

          AND (
            r.requester_user_id =
              ${actor.id}::uuid

            OR (
              r.status = 'PENDING'

              AND (
                ${isSuperAdmin(actor)}

                OR (
                  ${actorRank} >
                    r.requester_rank

                  AND ${actorRank} >
                    r.target_rank
                )
              )
            )
          )

        ORDER BY
          r.created_at DESC
      `,
    );

  return rows.map(
    mapRequest,
  );
}

export async function approvePermanentDeletion(
  requestId: string,
  actor: AuthenticatedUser,
) {
  const actorRecord =
    await requireActorRecord(
      actor,
    );

  const actorRole =
    highestAuthorityRole(
      actorRecord.userRoles.map(
        (binding) =>
          binding.role.name,
      ),
    );

  const actorRank =
    authorityRank(
      actorRole,
    );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const rows =
          await tx.$queryRaw<
            Array<{
              id: string;

              institution_id:
                string | null;

              target_user_id:
                string | null;

              target_first_name:
                string;

              target_last_name:
                string;

              target_email:
                string;

              target_role:
                string;

              requester_user_id:
                string | null;

              requester_rank:
                number;

              target_rank:
                number;

              status:
                DeletionRequestStatus;
            }>
          >(
            Prisma.sql`
              SELECT
                id,
                institution_id,
                target_user_id,
                target_first_name,
                target_last_name,
                target_email,
                target_role,
                requester_user_id,
                requester_rank,
                target_rank,
                status
              FROM user_deletion_requests
              WHERE id =
                ${requestId}::uuid
              FOR UPDATE
            `,
          );

        const request =
          rows[0];

        if (!request) {
          throw new AppError(
            "Permanent-deletion request not found",
            404,
          );
        }

        if (
          request.status !==
          "PENDING"
        ) {
          throw new AppError(
            "This permanent-deletion request has already been reviewed",
            409,
          );
        }

        if (
          request.requester_user_id ===
          actor.id
        ) {
          throw new AppError(
            "The requester cannot approve their own permanent-deletion request",
            403,
          );
        }

        if (
          !isSuperAdmin(actor) &&
          request.institution_id !==
            actorRecord.institutionId
        ) {
          throw new AppError(
            "You cannot approve a request outside your institution",
            403,
          );
        }

        if (
          !isSuperAdmin(actor) &&
          !(
            actorRank >
              request.requester_rank &&
            actorRank >
              request.target_rank
          )
        ) {
          throw new AppError(
            "Permanent deletion requires approval from a higher authority than both the requester and the target account",
            403,
          );
        }

        if (
          !request.target_user_id
        ) {
          throw new AppError(
            "The target account no longer exists",
            409,
          );
        }

        const target =
          await tx.user.findUnique({
            where: {
              id:
                request.target_user_id,
            },

            select: {
              id: true,
              institutionId: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,

              userRoles: {
                select: {
                  role: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          });

        if (!target) {
          throw new AppError(
            "The target account no longer exists",
            409,
          );
        }

        try {
          await tx.user.delete({
            where: {
              id:
                target.id,
            },
          });
        } catch (error) {
          if (
            error instanceof
              Prisma.PrismaClientKnownRequestError &&
            error.code === "P2003"
          ) {
            throw new AppError(
              "This account has protected institutional records and cannot be permanently deleted. Deactivate the account instead.",
              409,
            );
          }

          throw error;
        }

        await tx.$executeRaw(
          Prisma.sql`
            UPDATE user_deletion_requests
            SET
              status = 'APPROVED',

              approver_user_id =
                ${actor.id}::uuid,

              approver_first_name =
                ${actorRecord.firstName},

              approver_last_name =
                ${actorRecord.lastName},

              approver_email =
                ${actorRecord.email},

              approver_role =
                ${actorRole},

              reviewed_at =
                NOW(),

              updated_at =
                NOW(),

              target_user_id =
                NULL

            WHERE id =
              ${request.id}::uuid

              AND status =
                'PENDING'
          `,
        );

        return {
          requestId:
            request.id,

          targetUserId:
            target.id,

          targetEmail:
            target.email,
        };
      },
    );

  await recordAuditLog({
    institutionId:
      actorRecord.institutionId,

    userId:
      actor.id,

    action:
      "user.permanent_delete.approved",

    entityType:
      "UserDeletionRequest",

    entityId:
      result.requestId,

    metadata: {
      targetUserId:
        result.targetUserId,

      targetEmail:
        result.targetEmail,
    },
  });

  return {
    ...result,

    permanentlyDeleted:
      true,
  };
}

export async function rejectPermanentDeletion(
  requestId: string,
  actor: AuthenticatedUser,
) {
  const actorRecord =
    await requireActorRecord(
      actor,
    );

  const actorRole =
    highestAuthorityRole(
      actorRecord.userRoles.map(
        (binding) =>
          binding.role.name,
      ),
    );

  const actorRank =
    authorityRank(
      actorRole,
    );

  const rows =
    await prisma.$queryRaw<
      Array<{
        id: string;

        institution_id:
          string | null;

        requester_user_id:
          string | null;

        requester_rank:
          number;

        target_rank:
          number;

        status:
          DeletionRequestStatus;
      }>
    >(
      Prisma.sql`
        SELECT
          id,
          institution_id,
          requester_user_id,
          requester_rank,
          target_rank,
          status
        FROM user_deletion_requests
        WHERE id =
          ${requestId}::uuid
        LIMIT 1
      `,
    );

  const request =
    rows[0];

  if (!request) {
    throw new AppError(
      "Permanent-deletion request not found",
      404,
    );
  }

  if (
    request.status !==
    "PENDING"
  ) {
    throw new AppError(
      "This permanent-deletion request has already been reviewed",
      409,
    );
  }

  if (
    request.requester_user_id ===
    actor.id
  ) {
    throw new AppError(
      "The requester cannot reject their own permanent-deletion request",
      403,
    );
  }

  if (
    !isSuperAdmin(actor) &&
    request.institution_id !==
      actorRecord.institutionId
  ) {
    throw new AppError(
      "You cannot reject a request outside your institution",
      403,
    );
  }

  if (
    !isSuperAdmin(actor) &&
    !(
      actorRank >
        request.requester_rank &&
      actorRank >
        request.target_rank
    )
  ) {
    throw new AppError(
      "Only a higher authority can reject this permanent-deletion request",
      403,
    );
  }

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE user_deletion_requests
      SET
        status = 'REJECTED',

        approver_user_id =
          ${actor.id}::uuid,

        approver_first_name =
          ${actorRecord.firstName},

        approver_last_name =
          ${actorRecord.lastName},

        approver_email =
          ${actorRecord.email},

        approver_role =
          ${actorRole},

        reviewed_at =
          NOW(),

        updated_at =
          NOW()

      WHERE id =
        ${request.id}::uuid

        AND status =
          'PENDING'
    `,
  );

  await recordAuditLog({
    institutionId:
      actorRecord.institutionId,

    userId:
      actor.id,

    action:
      "user.permanent_delete.rejected",

    entityType:
      "UserDeletionRequest",

    entityId:
      request.id,

    metadata: {},
  });

  return {
    requestId:
      request.id,

    status:
      "REJECTED" as const,
  };
}
