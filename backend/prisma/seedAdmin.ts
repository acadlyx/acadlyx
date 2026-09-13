/**
 * Production-safe, idempotent RBAC/bootstrap repair.
 *
 * Runs safely on every production deployment.
 *
 * Responsibilities:
 * - installs/repairs the complete permission catalog
 * - repairs SUPER_ADMIN permissions
 * - creates/repairs all standard AIMT roles
 * - creates/repairs the configured institution administrator
 * - repairs known demo-account role bindings when those accounts already exist
 *
 * IMPORTANT:
 * institutions.manage is platform-only.
 * It is never granted to INSTITUTION_ADMIN or any other institution role.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  SYSTEM_ROLE_NAMES,
} from "../src/config/rbac";

const prisma = new PrismaClient();

function required(
  name: "INITIAL_ADMIN_EMAIL" | "INITIAL_ADMIN_PASSWORD"
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set.`);
  }

  return value;
}

async function ensurePermissionCatalog(
  tx: Prisma.TransactionClient
): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();

  for (const permission of PERMISSIONS) {
    const record = await tx.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        module: permission.module,
        description: permission.description,
      },
      create: {
        key: permission.key,
        module: permission.module,
        description: permission.description,
      },
    });

    permissionIds.set(record.key, record.id);
  }

  return permissionIds;
}

async function syncRolePermissions(
  tx: Prisma.TransactionClient,
  roleId: string,
  permissionIds: Map<string, string>,
  permissionKeys: string[]
): Promise<void> {
  const desiredIds = permissionKeys
    .map((key) => permissionIds.get(key))
    .filter((id): id is string => Boolean(id));

  await tx.rolePermission.deleteMany({
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

  await tx.rolePermission.createMany({
    data: desiredIds.map((permissionId) => ({
      roleId,
      permissionId,
    })),
    skipDuplicates: true,
  });
}

async function ensureRole(
  tx: Prisma.TransactionClient,
  institutionId: string | null,
  roleName: string,
  permissionIds: Map<string, string>
) {
  let role = await tx.role.findFirst({
    where: {
      institutionId,
      name: roleName,
    },
  });

  if (!role) {
    role = await tx.role.create({
      data: {
        institutionId,
        name: roleName,
        isSystem: true,
        description: `${roleName.replace(/_/g, " ")} role`,
      },
    });
  } else if (!role.isSystem) {
    role = await tx.role.update({
      where: {
        id: role.id,
      },
      data: {
        isSystem: true,
      },
    });
  }

  await syncRolePermissions(
    tx,
    role.id,
    permissionIds,
    ROLE_PERMISSIONS[roleName] ?? []
  );

  return role;
}

async function main() {
  const email = required("INITIAL_ADMIN_EMAIL").toLowerCase();
  const password = required("INITIAL_ADMIN_PASSWORD");

  const firstName =
    process.env.INITIAL_ADMIN_FIRST_NAME?.trim() ||
    "Institution";

  const lastName =
    process.env.INITIAL_ADMIN_LAST_NAME?.trim() ||
    "Administrator";

  console.log("Repairing ACADLYX RBAC and production bootstrap...");

  await prisma.$transaction(async (tx) => {
    /*
     * 1. Permission catalog
     */
    const permissionIds = await ensurePermissionCatalog(tx);

    /*
     * 2. Platform role
     */
    const superAdminRole = await ensureRole(
      tx,
      null,
      "SUPER_ADMIN",
      permissionIds
    );

    /*
     * 3. AIMT institution
     */
    const aimt = await tx.institution.upsert({
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

    /*
     * 4. All institution system roles
     */
    const roles = new Map<string, string>();

    for (const roleName of SYSTEM_ROLE_NAMES) {
      if (roleName === "SUPER_ADMIN") {
        continue;
      }

      const role = await ensureRole(
        tx,
        aimt.id,
        roleName,
        permissionIds
      );

      roles.set(roleName, role.id);
    }

    /*
     * 5. Initial Institution Admin
     */
    const adminRoleId = roles.get("INSTITUTION_ADMIN");

    if (!adminRoleId) {
      throw new Error(
        "INSTITUTION_ADMIN role could not be initialized."
      );
    }

    const existing = await tx.user.findUnique({
      where: {
        email,
      },
    });

    if (existing && existing.institutionId !== aimt.id) {
      throw new Error(
        "Initial admin email already belongs to a different institution and will not be moved automatically."
      );
    }

    const user = existing
      ? await tx.user.update({
          where: {
            id: existing.id,
          },
          data: {
            firstName,
            lastName,
            isActive: true,
          },
        })
      : await tx.user.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            firstName,
            lastName,
            institutionId: aimt.id,
            isActive: true,
          },
        });

    /*
     * The configured bootstrap account is explicitly an
     * INSTITUTION_ADMIN and nothing else.
     */
    await tx.userRole.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRoleId,
      },
    });

    /*
     * 6. Repair existing demo users.
     *
     * We do not create these accounts here. This keeps production
     * deployments free of unexpected demo accounts.
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

    for (const [demoEmail, roleName] of demoAccounts) {
      const demoUser = await tx.user.findUnique({
        where: {
          email: demoEmail,
        },
      });

      const roleId = roles.get(roleName);

      if (
        !demoUser ||
        !roleId ||
        demoUser.institutionId !== aimt.id
      ) {
        continue;
      }

      await tx.userRole.deleteMany({
        where: {
          userId: demoUser.id,
        },
      });

      await tx.userRole.create({
        data: {
          userId: demoUser.id,
          roleId,
        },
      });
    }

    /*
     * 7. Repair the existing platform demo account if it exists.
     */
    const platformDemo = await tx.user.findUnique({
      where: {
        email: "superadmin@acadlyx.com",
      },
    });

    if (
      platformDemo &&
      platformDemo.institutionId === null
    ) {
      await tx.userRole.deleteMany({
        where: {
          userId: platformDemo.id,
        },
      });

      await tx.userRole.create({
        data: {
          userId: platformDemo.id,
          roleId: superAdminRole.id,
        },
      });
    }

    console.log(
      `Permission catalog repaired: ${permissionIds.size} permissions.`
    );

    console.log(
      `Institution roles repaired: ${Array.from(
        roles.keys()
      ).join(", ")}`
    );

    console.log(
      `Initial institution admin ready: ${email}`
    );
  });
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
