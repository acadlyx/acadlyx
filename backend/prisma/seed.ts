/**
 * ACADLYX demo seed data.
 *
 * Idempotent — safe to run multiple times.
 *
 * This seed uses the central RBAC configuration so the
 * database permission catalogue cannot silently drift away
 * from backend authorization.
 *
 * Run with:
 *   npm run prisma:seed
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../src/config/rbac";

const prisma = new PrismaClient();

function requireDemoPassword(): string {
  const password =
    process.env.SEED_DEMO_PASSWORD;

  if (!password) {
    throw new Error(
      "SEED_DEMO_PASSWORD must be set before running the demo seed."
    );
  }

  return password;
}

const DEMO_USERS: Array<{
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  scopedToInstitution: boolean;
}> = [
  {
    email: "superadmin@acadlyx.com",
    firstName: "Platform",
    lastName: "Admin",
    role: "SUPER_ADMIN",
    scopedToInstitution: false,
  },
  {
    email: "management@aimt.acadlyx.com",
    firstName: "Meera",
    lastName: "Kapoor",
    role: "MANAGEMENT",
    scopedToInstitution: true,
  },
  {
    email: "hod@aimt.acadlyx.com",
    firstName: "Rajesh",
    lastName: "Sharma",
    role: "HOD",
    scopedToInstitution: true,
  },
  {
    email: "faculty@aimt.acadlyx.com",
    firstName: "Anita",
    lastName: "Verma",
    role: "FACULTY",
    scopedToInstitution: true,
  },
  {
    email: "student@aimt.acadlyx.com",
    firstName: "Rohan",
    lastName: "Gupta",
    role: "STUDENT",
    scopedToInstitution: true,
  },
  {
    email: "parent@aimt.acadlyx.com",
    firstName: "Suresh",
    lastName: "Gupta",
    role: "PARENT",
    scopedToInstitution: true,
  },
];

async function main() {
  console.log(
    "Seeding ACADLYX demo data..."
  );

  /*
   * ---------------------------------------------------------
   * Institution
   * ---------------------------------------------------------
   */

  const aimt =
    await prisma.institution.upsert({
      where: {
        slug: "aimt",
      },
      update: {
        logoUrl:
          "/branding/aimt-logo.png",
      },
      create: {
        name:
          "Accurate Institute of Management & Technology",
        slug: "aimt",
        logoUrl:
          "/branding/aimt-logo.png",
        primaryColor:
          "#0f172a",
        secondaryColor:
          "#64748b",
        isActive: true,
      },
    });

  console.log(
    `Institution ready: ${aimt.name} (${aimt.id})`
  );

  /*
   * ---------------------------------------------------------
   * Permissions
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   * This comes from src/config/rbac.ts.
   *
   * That means exams.manage is now automatically installed
   * and future permission additions remain synchronized.
   */

  const permissionRecords =
    new Map<string, string>();

  for (const permission of PERMISSIONS) {
    const record =
      await prisma.permission.upsert({
        where: {
          key: permission.key,
        },
        update: {
          module:
            permission.module,
          description:
            permission.description,
        },
        create: {
          key: permission.key,
          module:
            permission.module,
          description:
            permission.description,
        },
      });

    permissionRecords.set(
      record.key,
      record.id
    );
  }

  console.log(
    `Permissions ready: ${permissionRecords.size}`
  );

  /*
   * ---------------------------------------------------------
   * Roles + permissions
   * ---------------------------------------------------------
   */

  const roleRecords =
    new Map<string, string>();

  for (const [
    roleName,
    permissionKeys,
  ] of Object.entries(
    ROLE_PERMISSIONS
  )) {
    const isPlatformRole =
      roleName ===
      "SUPER_ADMIN";

    const institutionId =
      isPlatformRole
        ? null
        : aimt.id;

    let role =
      await prisma.role.findFirst({
        where: {
          name: roleName,
          institutionId,
        },
      });

    if (!role) {
      role =
        await prisma.role.create({
          data: {
            name: roleName,
            institutionId,
            isSystem: true,
            description:
              `${roleName.replace(
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

    roleRecords.set(
      roleName,
      role.id
    );

    /*
     * Synchronize permissions exactly.
     */

    const desiredPermissionIds =
      permissionKeys
        .map((key) =>
          permissionRecords.get(
            key
          )
        )
        .filter(
          (
            id
          ): id is string =>
            Boolean(id)
        );

    await prisma.rolePermission.deleteMany(
      {
        where: {
          roleId: role.id,
          ...(desiredPermissionIds.length >
          0
            ? {
                permissionId: {
                  notIn:
                    desiredPermissionIds,
                },
              }
            : {}),
        },
      }
    );

    if (
      desiredPermissionIds.length >
      0
    ) {
      await prisma.rolePermission.createMany(
        {
          data:
            desiredPermissionIds.map(
              (
                permissionId
              ) => ({
                roleId:
                  role.id,
                permissionId,
              })
            ),
          skipDuplicates:
            true,
        }
      );
    }
  }

  console.log(
    `Roles synchronized: ${roleRecords.size}`
  );

  /*
   * ---------------------------------------------------------
   * Demo users
   * ---------------------------------------------------------
   */

  const password =
    requireDemoPassword();

  const passwordHash =
    await hashPassword(
      password
    );

  for (const demoUser of DEMO_USERS) {
    const institutionId =
      demoUser.scopedToInstitution
        ? aimt.id
        : null;

    const roleId =
      roleRecords.get(
        demoUser.role
      );

    if (!roleId) {
      throw new Error(
        `Missing role record for ${demoUser.role}`
      );
    }

    const existing =
      await prisma.user.findUnique(
        {
          where: {
            email:
              demoUser.email,
          },
        }
      );

    let user;

    if (existing) {
      user =
        await prisma.user.update({
          where: {
            id: existing.id,
          },
          data: {
            institutionId,
            firstName:
              demoUser.firstName,
            lastName:
              demoUser.lastName,
            passwordHash,
            isActive: true,
          },
        });
    } else {
      user =
        await prisma.user.create({
          data: {
            institutionId,
            email:
              demoUser.email,
            firstName:
              demoUser.firstName,
            lastName:
              demoUser.lastName,
            passwordHash,
            isActive: true,
          },
        });
    }

    /*
     * Ensure this demo account has exactly the
     * expected role.
     */

    await prisma.userRole.deleteMany(
      {
        where: {
          userId: user.id,
        },
      }
    );

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId,
      },
    });

    console.log(
      `Demo user ready: ${demoUser.email} → ${demoUser.role}`
    );
  }

  console.log(
    "ACADLYX demo seed completed successfully."
  );
}

main()
  .catch((error) => {
    console.error(
      "Seed failed:",
      error
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
