/**
 * Production-safe, idempotent bootstrap for the first platform operator.
 * This intentionally creates only a SUPER_ADMIN user and its role binding;
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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.institutionId) {
    throw new Error("Initial admin email belongs to an institution-scoped user and cannot be promoted automatically.");
  }

  const role = await prisma.role.upsert({
    where: { institutionId_name: { institutionId: null, name: "SUPER_ADMIN" } },
    update: { isSystem: true },
    create: { name: "SUPER_ADMIN", institutionId: null, isSystem: true, description: "Platform administrator" },
  });

  const user = existing || await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      firstName,
      lastName,
      institutionId: null,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  console.log(existing ? "Initial SUPER_ADMIN already existed; role binding verified." : "Initial SUPER_ADMIN created.");
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
