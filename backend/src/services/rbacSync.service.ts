import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";
import { ensureInstitutionSystemRoles } from "./institution.service";
import { provisionTenantEntitlements } from "./entitlement.service";

/**
 * Idempotently reconciles the canonical RBAC catalogue and the default
 * feature entitlements with every existing tenant.
 *
 * Without this, tenants created before a permission/feature was added would
 * silently 403 on the new module. It runs at boot (see index.ts) and can be
 * triggered manually through `npm run prisma:rbac:repair`.
 */
export async function syncAllTenantAccess(): Promise<{
  institutions: number;
  failures: number;
}> {
  const institutions = await prisma.institution.findMany({
    select: { id: true, slug: true },
  });

  let failures = 0;

  for (const institution of institutions) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await ensureInstitutionSystemRoles(tx, institution.id);
          await provisionTenantEntitlements(tx, institution.id);
        },
        { timeout: 60_000, maxWait: 20_000 }
      );
    } catch (error) {
      failures += 1;
      logger.error("RBAC sync failed for institution", {
        institutionId: institution.id,
        slug: institution.slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { institutions: institutions.length, failures };
}
