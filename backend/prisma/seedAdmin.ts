/**
 * Production-safe, idempotent RBAC/bootstrap repair.
 *
 * This script intentionally does NOT wrap the entire bootstrap in one
 * long-running interactive transaction.
 *
 * Why:
 * - Production databases may use pooled connections.
 * - Supabase transaction poolers can invalidate long-running interactive
 *   transactions.
 * - RBAC repair is naturally idempotent.
 * - Each permission/role operation can safely be committed independently.
 *
 * Responsibilities:
 * - installs/repairs the complete permission catalog
 * - repairs SUPER_ADMIN permissions
 * - creates/repairs all standard institution roles
 * - creates/repairs the configured institution administrator
 * - repairs known demo-account role bindings when those accounts already exist
 *
 * IMPORTANT:
 * institutions.manage is platform-only.
 * It is never granted to INSTITUTION_ADMIN or another institution role.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
} from "../src/config/rbac";

const prisma = new PrismaClient();

function required(
  name:
    | "INITIAL_ADMIN_EMAIL"
    | "INITIAL_ADMIN_PASSWORD"
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
 * Deliberately runs outside a long interactive transaction.
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
 * Synchronize a role's permissions.
 *
 * Existing permissions not belonging to the current RBAC matrix
 * are removed. Desired permissions are inserted idempotently.
 */
async function syncRolePermissions(
  roleId: string,
  permissionIds: Map<string, string>,
  permissionKeys: string[]
): Promise<void> {
  const desiredIds = permissionKeys
    .map((key) => permissionIds.get(key))
    .filter(
      (id): id is string =>
        Boolean(id)
    );

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

  if (desiredIds.length === 0) {
    return;
  }

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
 * Create or repair a system role.
 */
async function ensureRole(
  institutionId: string | null,
  roleName: string,
  permissionIds: Map<string, string>
) {
  let role =
    await prisma.role.findFirst({
      where: {
        institutionId,
        name: roleName,
      },
    });

  if (!role) {
    role = await prisma.role.create({
      data: {
        institutionId,
        name: roleName,
        isSystem: true,
        description: `${roleName.replace(
          /_/g,
          " "
        )} role`,
      },
    });
  } else if (!role.isSystem) {
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

  await syncRolePermissions(
    role.id,
    permissionIds,
    ROLE_PERMISSIONS[
      roleName
    ] ?? []
  );

  return role;
}

/**
 * Ensure all standard institution roles exist.
 */
async function ensureInstitutionRoles(
  institutionId: string,
  permissionIds: Map<string, string>
): Promise<Map<string, string>> {
  const roles =
    new Map<string, string>();

  for (const roleName of SYSTEM_ROLE_NAMES) {
    if (roleName === "SUPER_ADMIN") {
      continue;
    }

    const role = await ensureRole(
      institutionId,
      roleName,
      permissionIds
    );

    roles.set(
      roleName,
      role.id
    );
  }

  return roles;
}

/**
 * Repair an existing user's role binding.
 *
 * This intentionally removes all previous role bindings and assigns
 * exactly the requested system role.
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
 * Repair an existing demo account only.
 *
 * Demo users are NOT created by this production bootstrap.
 */
async function repairExistingDemoUser(
  email: string,
  institutionId: string,
  roleId: string
): Promise<void> {
  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (!user) {
    return;
  }

  if (
    user.institutionId !==
    institutionId
  ) {
    return;
  }

  await setSingleRole(
    user.id,
    roleId
  );
}

/**
 * Main production bootstrap.
 */
async function main() {
  const email =
    required(
      "INITIAL_ADMIN_EMAIL"
    ).toLowerCase();

  const password =
    required(
      "INITIAL_ADMIN_PASSWORD"
    );

  const firstName =
    process.env
      .INITIAL_ADMIN_FIRST_NAME
      ?.trim() ||
    "Institution";

  const lastName =
    process.env
      .INITIAL_ADMIN_LAST_NAME
      ?.trim() ||
    "Administrator";

  console.log(
    "Repairing ACADLYX RBAC and production bootstrap..."
  );

  /*
   * 1. Permission catalog
   *
   * Each upsert is committed independently.
   */
  const permissionIds =
    await ensurePermissionCatalog();

  console.log(
    `Permission catalog repaired: ${permissionIds.size} permissions.`
  );

  /*
   * 2. Platform SUPER_ADMIN role
   */
  const superAdminRole =
    await ensureRole(
      null,
      "SUPER_ADMIN",
      permissionIds
    );

  console.log(
    "SUPER_ADMIN role repaired."
  );

  /*
   * 3. Ensure the bootstrap institution exists.
   *
   * This preserves the existing ACADLYX/AIMT bootstrap
   * behavior used by the current production deployment.
   */
  const aimt =
    await prisma.institution.upsert({
      where: {
        slug: "aimt",
      },
      update: {},
      create: {
        name: "Accurate Institute of Management & Technology",
        slug: "aimt",
        isActive: true,
      },
    });

  console.log(
    `Bootstrap institution ready: ${aimt.name}`
  );

  /*
   * 4. Repair all institution system roles.
   */
  const roles =
    await ensureInstitutionRoles(
      aimt.id,
      permissionIds
    );

  console.log(
    `Institution roles repaired: ${Array.from(
      roles.keys()
    ).join(", ")}`
  );

  /*
   * 5. Initial institution administrator.
   */
  const adminRoleId =
    roles.get(
      "INSTITUTION_ADMIN"
    );

  if (!adminRoleId) {
    throw new Error(
      "INSTITUTION_ADMIN role could not be initialized."
    );
  }

  const existing =
    await prisma.user.findUnique({
      where: {
        email,
      },
    });

  if (
    existing &&
    existing.institutionId !==
      aimt.id
  ) {
    throw new Error(
      "Initial admin email already belongs to a different institution and will not be moved automatically."
    );
  }

  let user;

  if (existing) {
    user =
      await prisma.user.update({
        where: {
          id: existing.id,
        },
        data: {
          firstName,
          lastName,
          isActive: true,
        },
      });
  } else {
    user =
      await prisma.user.create({
        data: {
          email,
          passwordHash:
            await hashPassword(
              password
            ),
          firstName,
          lastName,
          institutionId:
            aimt.id,
          isActive: true,
        },
      });
  }

  /*
   * The configured bootstrap account must be exactly
   * INSTITUTION_ADMIN.
   */
  await setSingleRole(
    user.id,
    adminRoleId
  );

  console.log(
    `Initial institution admin ready: ${email}`
  );

  /*
   * 6. Repair existing demo users.
   *
   * These accounts are NOT created here.
   */
  const demoAccounts = [
    [
      "management@aimt.acadlyx.com",
      "MANAGEMENT",
    ],
    [
      "hod@aimt.acadlyx.com",
      "HOD",
    ],
    [
      "faculty@aimt.acadlyx.com",
      "FACULTY",
    ],
    [
      "student@aimt.acadlyx.com",
      "STUDENT",
    ],
    [
      "parent@aimt.acadlyx.com",
      "PARENT",
    ],
  ] as const;

  for (const [
    demoEmail,
    roleName,
  ] of demoAccounts) {
    const roleId =
      roles.get(roleName);

    if (!roleId) {
      continue;
    }

    await repairExistingDemoUser(
      demoEmail,
      aimt.id,
      roleId
    );
  }

  /*
   * 7. Repair existing platform demo account.
   */
  const platformDemo =
    await prisma.user.findUnique({
      where: {
        email:
          "superadmin@acadlyx.com",
      },
    });

  if (
    platformDemo &&
    platformDemo.institutionId ===
      null
  ) {
    await setSingleRole(
      platformDemo.id,
      superAdminRole.id
    );

    console.log(
      "Platform demo SUPER_ADMIN role repaired."
    );
  }

  console.log(
    "ACADLYX RBAC and production bootstrap completed successfully."
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
