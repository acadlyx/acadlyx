import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

export interface AuditLogInput {
  institutionId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Foundation for audit logging of sensitive actions.
 * Intentionally fire-and-forget-safe: a logging failure must never
 * break the request that triggered it, so errors are swallowed
 * (and logged locally) rather than propagated.
 *
 * Future phases will call this from every sensitive mutation
 * (user management, RBAC changes, marks entry, fee updates, etc.),
 * not just auth events.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        institutionId: input.institutionId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (err) {
    logger.error("Failed to write audit log", { action: input.action, err });
  }
}
