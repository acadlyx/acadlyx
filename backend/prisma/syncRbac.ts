/**
 * Reconciles the canonical RBAC catalogue and default feature entitlements
 * with EVERY existing tenant. Idempotent and safe to run on each deploy.
 *
 *   npm run prisma:rbac:repair
 */
import { prisma } from "../src/lib/prisma";
import { syncAllTenantAccess } from "../src/services/rbacSync.service";

syncAllTenantAccess()
  .then(async (result) => {
    // eslint-disable-next-line no-console
    console.log("RBAC sync complete", result);
    await prisma.$disconnect();
    process.exit(result.failures > 0 ? 1 : 0);
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
