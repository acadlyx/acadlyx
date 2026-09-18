/**
 * Production-safe, idempotent ACADLYX platform bootstrap.
 *
 * This script is intentionally LIMITED to the platform SUPER_ADMIN.
 *
 * Responsibilities:
 * - installs/repairs the complete permission catalog
 * - repairs the platform SUPER_ADMIN role
 * - creates or repairs the configured SUPER_ADMIN account
 * - ensures the SUPER_ADMIN is platform-level (institutionId = null)
 *
 * It intentionally DOES NOT:
 * - create an institution
 * - create an INSTITUTION_ADMIN
 * - create students
 * - create faculty
 * - create management/HOD/staff/student/parent demo users
 * - create academic demo data
 *
 * Institution creation and Institution Admin creation are handled
 * through the normal SUPER_ADMIN institution-management workflow.
 *
 * Required environment variables:
 *
 *   SUPER_ADMIN_EMAIL
 *   SUPER_ADMIN_PASSWORD
 *
 * Optional:
 *
 *   SUPER_ADMIN_FIRST_NAME
 *   SUPER_ADMIN_LAST_NAME
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../src/config/rbac";

const prisma = new PrismaClient();

function required(
  name:
    | "SUPER_ADMIN_EMAIL"
    | "SUPER_ADMIN_PASSWORD"
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set.`);
  }

  return value;
}

/**
 * Repair the complete permission catalog.
 *
 * Each operation is committed independently rather than using
 * one long-running interactive transaction.
 *
 * This is intentional for compatibility with pooled production
 * database connections.
 */
async function ensurePermissionCatalog(): Promise<
  Map<string, string>
> {
  const permissionIds =
    new Map<string, string>();

  for (const permission of PERMISSIONS) {
    const record =
      await prisma.permission.upsert({
        where: {
          key: permission.key,
        },
        update: {
          module: permission.module,
          description:
            permission.description,
        },
        create: {
          key: permission.key,
          module: permission.module,
          description:
            permission.description,
        },
      });

    permissionIds.set(
      record.key,
      record.id
    );
  }

  return permissionIds;
}

/**
 * Synchronize one role's permission bindings.
 *
 * Any permissions not present in the current RBAC matrix
 * are removed.
 *
 * Desired permissions are then inserted idempotently.
 */
async function syncRolePermissions(
  roleId: string,
  permissionIds: Map<string, string>,
  permissionKeys: string[]
): Promise<void> {
  const desiredIds = permissionKeys
    .map((key) =>
      permissionIds.get(key)
    )
    .filter(
      (id): id is string =>
        Boolean(id)
    );

  /*
   * Remove stale permissions.
   */
  await prisma.rolePermission.deleteMany({
    where: {
      roleId,
      ...(desiredIds.length > 0
        ? {
            permissionId: {
              notIn: desiredIds,
            },
          }
        : {}),
    },
  });

  /*
   * Nothing more to add.
   */
  if (desiredIds.length === 0) {
    return;
  }

  /*
   * Add desired permissions.
   */
  await prisma.rolePermission.createMany({
    data: desiredIds.map(
      (permissionId) => ({
        roleId,
        permissionId,
      })
    ),
    skipDuplicates: true,
  });
}

/**
 * Create or repair the platform SUPER_ADMIN role.
 *
 * Platform roles have institutionId = null.
 */
async function ensureSuperAdminRole(
  permissionIds: Map<string, string>
) {
  let role =
    await prisma.role.findFirst({
      where: {
        institutionId: null,
        name: "SUPER_ADMIN",
      },
    });

  if (!role) {
    role = await prisma.role.create({
      data: {
        institutionId: null,
        name: "SUPER_ADMIN",
        isSystem: true,
        description:
          "Platform-level SUPER_ADMIN role",
      },
    });
  } else {
    /*
     * Repair the role if it was previously created
     * without the system flag.
     */
    if (!role.isSystem) {
      role =
        await prisma.role.update({
          where: {
            id: role.id,
          },
          data: {
            isSystem: true,
          },
        });
    }
  }

  /*
   * SUPER_ADMIN receives every permission in the
   * current RBAC permission catalog.
   */
  await syncRolePermissions(
    role.id,
    permissionIds,
    ROLE_PERMISSIONS[
      "SUPER_ADMIN"
    ] ?? []
  );

  return role;
}

/**
 * Make a user have exactly one role.
 *
 * For the bootstrap account this guarantees that the
 * configured account is actually SUPER_ADMIN and does
 * not retain accidental institution-level role bindings.
 */
async function setSingleRole(
  userId: string,
  roleId: string
): Promise<void> {
  await prisma.userRole.deleteMany({
    where: {
      userId,
    },
  });

  await prisma.userRole.create({
    data: {
      userId,
      roleId,
    },
  });
}

/**
 * Create or repair the configured platform SUPER_ADMIN.
 *
 * IMPORTANT:
 * - The account must remain platform-level.
 * - An existing institution user with the same email
 *   is never automatically moved to the platform.
 * - Password is synchronized from SUPER_ADMIN_PASSWORD
 *   so rotating the Render secret also rotates the
 *   bootstrap password on the next deployment.
 */
async function ensureSuperAdmin(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  roleId: string
): Promise<void> {
  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (
    existing &&
    existing.institutionId !== null
  ) {
    throw new Error(
      `SUPER_ADMIN_EMAIL "${email}" already belongs to an institution user. ` +
        "The production bootstrap will not move an institution user into the platform. " +
        "Use a dedicated platform Super Admin email."
    );
  }

  const passwordHash =
    await hashPassword(password);

  let user;

  if (existing) {
    /*
     * Existing platform account:
     * - repair name
     * - ensure active
     * - synchronize password
     * - preserve platform institutionId = null
     */
    user =
      await prisma.user.update({
        where: {
          id: existing.id,
        },
        data: {
          institutionId: null,
          passwordHash,
          firstName,
          lastName,
          isActive: true,
        },
      });
  } else {
    /*
     * First-time platform Super Admin.
     */
    user =
      await prisma.user.create({
        data: {
          institutionId: null,
          email,
          passwordHash,
          firstName,
          lastName,
          isActive: true,
        },
      });
  }

  /*
   * The bootstrap account must have exactly
   * the platform SUPER_ADMIN role.
   */
  await setSingleRole(
    user.id,
    roleId
  );

  console.log(
    `Platform SUPER_ADMIN ready: ${email}`
  );
}

/**
 * Main production bootstrap.
 */
async function main() {
  const email =
    required(
      "SUPER_ADMIN_EMAIL"
    ).toLowerCase();

  const password =
    required(
      "SUPER_ADMIN_PASSWORD"
    );

  const firstName =
    process.env
      .SUPER_ADMIN_FIRST_NAME
      ?.trim() ||
    "Platform";

  const lastName =
    process.env
      .SUPER_ADMIN_LAST_NAME
      ?.trim() ||
    "Administrator";

  console.log(
    "Starting ACADLYX production SUPER_ADMIN bootstrap..."
  );

  /*
   * 1. Repair permission catalog.
   */
  const permissionIds =
    await ensurePermissionCatalog();

  console.log(
    `Permission catalog repaired: ${permissionIds.size} permissions.`
  );

  /*
   * 2. Repair platform SUPER_ADMIN role.
   */
  const superAdminRole =
    await ensureSuperAdminRole(
      permissionIds
    );

  console.log(
    "Platform SUPER_ADMIN role repaired."
  );

  /*
   * 3. Create or repair the configured
   *    platform SUPER_ADMIN account.
   */
  await ensureSuperAdmin(
    email,
    password,
    firstName,
    lastName,
    superAdminRole.id
  );

  /*
   * 4. Explicitly confirm that no institution bootstrap
   *    is performed by this script.
   *
   * Institutions and their administrators are created
   * through the platform administration workflow.
   */
  console.log(
    "No institution or INSTITUTION_ADMIN was created by this bootstrap."
  );

  console.log(
    "ACADLYX production SUPER_ADMIN bootstrap completed successfully."
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error
        ? error.stack ||
            error.message
        : error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
