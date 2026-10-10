import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.institution.findUnique({
    where: { slug: "aimt" },
    select: { id: true },
  });
  if (existing) {
    process.stdout.write("Public site smoke institution already exists.\n");
    return;
  }
  const institution = await prisma.institution.create({
    data: { name: "ACADLYX Browser Smoke Institution", slug: "aimt" },
    select: { id: true, slug: true },
  });
  process.stdout.write(`Seeded public site fixture ${institution.slug} (${institution.id}).\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
