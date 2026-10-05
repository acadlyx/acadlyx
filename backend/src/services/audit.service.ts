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
 * Audit logging is failure-isolated: a logging failure is recorded locally
 * and never masks the business operation that triggered it.
 *
 * Sensitive mutations should call this after their authoritative state
 * transition so the audit record captures the completed operation.
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
    logger.error("Failed to write audit log", { action: input.action, error: err instanceof Error ? err.message : String(err) });
  }
}
