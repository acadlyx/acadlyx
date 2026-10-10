import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (process.env.ACADLYX_PERF_CONFIRM_DISPOSABLE !== "YES") {
  throw new Error("Refusing to run unless ACADLYX_PERF_CONFIRM_DISPOSABLE=YES");
}
const host = new URL(databaseUrl).hostname;
if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(host)) {
  throw new Error(`Refusing to seed a non-local database host: ${host}`);
}

const STUDENT_COUNT = Number(process.env.ACADLYX_PERF_STUDENTS ?? 10_000);
const CONCURRENCY = Number(process.env.ACADLYX_PERF_CONCURRENCY ?? 20);
const ITERATIONS_PER_WORKER = Number(process.env.ACADLYX_PERF_ITERATIONS_PER_WORKER ?? 50);
const OUTPUT_PATH = process.env.ACADLYX_PERF_OUTPUT ?? "performance-results.json";
const prisma = new PrismaClient();

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function main(): Promise<void> {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: "ACADLYX Disposable Performance Test", slug: `perf-${suffix}` },
  });
  const studentIds: string[] = [];
  const seedStarted = performance.now();
  try {
    for (let offset = 0; offset < STUDENT_COUNT; offset += 500) {
      const batchSize = Math.min(500, STUDENT_COUNT - offset);
      const rows = Array.from({ length: batchSize }, (_, index) => {
        const id = randomUUID();
        studentIds.push(id);
        const unique = `${suffix}-${offset + index}`;
        return {
          id,
          institutionId: institution.id,
          email: `perf-${unique}@integration.invalid`,
          idNumber: `PERF-${unique}`,
          passwordHash: "performance-fixture-not-a-login",
          firstName: "Load",
          lastName: `Student ${offset + index}`,
        };
      });
      await prisma.user.createMany({ data: rows });
    }

    for (let offset = 0; offset < STUDENT_COUNT; offset += 500) {
      const rows = studentIds.slice(offset, offset + 500).map((studentId, index) => ({
        id: randomUUID(),
        institutionId: institution.id,
        studentId,
        title: "Performance fixture invoice",
        amount: 120_000,
        paidAmount: (offset + index) % 4 === 0 ? 30_000 : 0,
        refundedAmount: 0,
        discountAmount: 0,
        status: (offset + index) % 4 === 0 ? "PARTIALLY_PAID" : "PENDING",
      }));
      await prisma.feeInvoice.createMany({ data: rows });
    }
    const [actualStudents, actualInvoices] = await Promise.all([
      prisma.user.count({ where: { institutionId: institution.id } }),
      prisma.feeInvoice.count({ where: { institutionId: institution.id } }),
    ]);
    if (actualStudents !== STUDENT_COUNT || actualInvoices !== STUDENT_COUNT) {
      throw new Error(`Seed verification failed: students=${actualStudents}, invoices=${actualInvoices}`);
    }
    const seedMs = Number((performance.now() - seedStarted).toFixed(2));

    const latencies: number[] = [];
    let failures = 0;
    const runStarted = performance.now();
    await Promise.all(Array.from({ length: CONCURRENCY }, async (_, worker) => {
      for (let iteration = 0; iteration < ITERATIONS_PER_WORKER; iteration += 1) {
        const started = performance.now();
        try {
          const kind = (worker + iteration) % 5;
          if (kind === 0) {
            await prisma.feeInvoice.aggregate({
              where: { institutionId: institution.id },
              _sum: { amount: true, paidAmount: true, refundedAmount: true },
              _count: { _all: true },
            });
          } else if (kind === 1) {
            await prisma.feeInvoice.count({ where: { institutionId: institution.id } });
          } else if (kind === 2) {
            await prisma.user.findMany({
              where: { institutionId: institution.id, isActive: true },
              select: { id: true, firstName: true, lastName: true },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 50,
            });
          } else {
            await prisma.feeInvoice.findMany({
              where: { institutionId: institution.id },
              select: { id: true, studentId: true, amount: true, paidAmount: true, refundedAmount: true, status: true },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 25,
            });
          }
        } catch (error) {
          failures += 1;
          process.stderr.write(`Load query failed: ${error instanceof Error ? error.message : String(error)}\n`);
        } finally {
          latencies.push(performance.now() - started);
        }
      }
    }));
    const elapsedMs = performance.now() - runStarted;
    const requestCount = CONCURRENCY * ITERATIONS_PER_WORKER;
    const errorRate = failures / requestCount;
    const report = {
      environment: "isolated-local-postgresql",
      dataset: { students: actualStudents, invoices: actualInvoices },
      workload: { concurrency: CONCURRENCY, iterationsPerWorker: ITERATIONS_PER_WORKER, requests: requestCount },
      seedDurationMs: seedMs,
      durationMs: Number(elapsedMs.toFixed(2)),
      throughputRequestsPerSecond: Number((requestCount / (elapsedMs / 1000)).toFixed(2)),
      latencyMs: {
        p50: percentile(latencies, 50),
        p95: percentile(latencies, 95),
        p99: percentile(latencies, 99),
        max: Number(Math.max(...latencies).toFixed(2)),
      },
      errors: failures,
      errorRate,
      acceptanceTargets: { p95MsAtMost: 1000, p99MsAtMost: 2000, errorRate: 0 },
      passed: failures === 0 && percentile(latencies, 95) <= 1000 && percentile(latencies, 99) <= 2000,
      note: "Database-only read workload; does not establish HTTP, browser, CPU, network, or production capacity.",
    };
    await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.passed) throw new Error("Finance database load acceptance targets were not met");
  } finally {
    await prisma.feeInvoice.deleteMany({ where: { institutionId: institution.id } });
    await prisma.user.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
