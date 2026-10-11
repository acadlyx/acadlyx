import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { getDirectorDepartmentIds } from "../services/accessScope.service";
import { listFeeStructures } from "../services/feeStructure.service";
import { exportData } from "../services/export.service";
import { getInstitutionInsights } from "../services/intelligence.service";

test("Director CampusAccess resolves only departments inside assigned campuses", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Scope integration ${suffix}`, slug: `scope-${suffix}` },
  });

  try {
    const [campusA, campusB] = await Promise.all([
      prisma.campus.create({
        data: { institutionId: institution.id, name: "Assigned campus", code: `A-${suffix.slice(0, 8)}` },
      }),
      prisma.campus.create({
        data: { institutionId: institution.id, name: "Unassigned campus", code: `B-${suffix.slice(0, 8)}` },
      }),
    ]);
    const [departmentA, departmentB] = await Promise.all([
      prisma.department.create({
        data: { institutionId: institution.id, campusId: campusA.id, name: "Assigned department", code: `DA-${suffix.slice(0, 8)}` },
      }),
      prisma.department.create({
        data: { institutionId: institution.id, campusId: campusB.id, name: "Unassigned department", code: `DB-${suffix.slice(0, 8)}` },
      }),
    ]);
    const director = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `director-${suffix}@scope-test.invalid`,
        idNumber: `DIR-${suffix}`,
        passwordHash: "integration-test-not-a-real-password",
        firstName: "Scope",
        lastName: "Director",
      },
    });
    await prisma.campusAccess.create({
      data: { userId: director.id, campusId: campusA.id, scope: "DIRECTOR" },
    });
    const [programA, programB] = await Promise.all([
      prisma.program.create({
        data: { institutionId: institution.id, departmentId: departmentA.id, name: "Assigned program", code: `PA-${suffix.slice(0, 8)}`, level: "UG", durationYears: 4 },
      }),
      prisma.program.create({
        data: { institutionId: institution.id, departmentId: departmentB.id, name: "Unassigned program", code: `PB-${suffix.slice(0, 8)}`, level: "UG", durationYears: 4 },
      }),
    ]);
    const [feeA, feeB] = await Promise.all([
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Assigned campus fees", programId: programA.id, createdById: director.id, status: "ACTIVE" },
      }),
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Unassigned campus fees", programId: programB.id, createdById: director.id, status: "ACTIVE" },
      }),
    ]);

    const assigned = await getDirectorDepartmentIds(institution.id, director.id);
    assert.deepEqual(assigned, [departmentA.id]);
    assert.ok(!assigned.includes(departmentB.id), "departments at an unassigned campus must never be inferred as authorized");
    assert.deepEqual(await getDirectorDepartmentIds(institution.id, `no-access-${suffix}`), []);
    const visibleFees = await listFeeStructures(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["fees.structure.read"],
    });
    assert.deepEqual(visibleFees.map((row) => row.id), [feeA.id]);
    assert.ok(!visibleFees.some((row) => row.id === feeB.id), "fee structures at another campus must not be returned to the Director");

    const financeExport = await exportData(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["fees.reports.export"],
    }, "fee-structures", "json");
    const exportedFees = JSON.parse(financeExport.buffer.toString("utf8")) as Array<{ id: string }>;
    assert.deepEqual(exportedFees.map((row) => row.id), [feeA.id], "downloaded fee structure exports must enforce the same campus boundary");

    const report = await getInstitutionInsights(institution.id, { departmentIds: assigned });
    assert.equal(report.kpis.departments, 1, "campus reports must count only the assigned department");
  } finally {
    await prisma.feeStructure.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
