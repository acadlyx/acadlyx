/**
 * Production-safe, idempotent bootstrap for the first institution operator.
 * This intentionally creates only an INSTITUTION_ADMIN user and its role binding;
 * it does not create demo institutions, students, or academic records.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

function required(name: "INITIAL_ADMIN_EMAIL" | "INITIAL_ADMIN_PASSWORD"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

async function main() {
  const email = required("INITIAL_ADMIN_EMAIL").toLowerCase();
  const password = required("INITIAL_ADMIN_PASSWORD");
  const firstName = process.env.INITIAL_ADMIN_FIRST_NAME?.trim() || "Platform";
  const lastName = process.env.INITIAL_ADMIN_LAST_NAME?.trim() || "Administrator";

  // Follow the same AIMT tenant pattern used by the main seed. The production
  // database requires role institution IDs, so this bootstrap deliberately
  // creates an institution-scoped administrator rather than a platform role.
  const aimt = await prisma.institution.upsert({
    where: { slug: "aimt" },
    update: {},
    create: {
      name: "Accurate Institute of Management & Technology",
      slug: "aimt",
      isActive: true,
    },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.institutionId !== aimt.id) {
    throw new Error("Initial admin email already belongs to a different tenant and will not be changed automatically.");
  }

  let role = await prisma.role.findFirst({
    where: { institutionId: aimt.id, name: "INSTITUTION_ADMIN" },
  });
  if (!role) {
    role = await prisma.role.create({
      data: { name: "INSTITUTION_ADMIN", institutionId: aimt.id, isSystem: true, description: "Institution administrator" },
    });
  }

  const user = existing || await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      institutionId: aimt.id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  // The permission catalog is normally installed before operator creation.
  // Bind every existing catalog permission without creating or modifying any
  // permission definitions here.
  const permissions = await prisma.permission.findMany({ select: { id: true } });
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }

  console.log(existing ? "Initial INSTITUTION_ADMIN already existed; role and permission bindings verified." : "Initial INSTITUTION_ADMIN created.");
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
