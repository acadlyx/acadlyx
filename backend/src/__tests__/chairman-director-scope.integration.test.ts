import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { getDirectorDepartmentIds } from "../services/accessScope.service";
import { listFeeStructures } from "../services/feeStructure.service";
import { exportData } from "../services/export.service";
import { getInstitutionInsights } from "../services/intelligence.service";
import { getAttendanceReportOptions } from "../services/attendanceReport.service";
import { createExamSession, getExamSession, listExamSessions, updateExamSessionStatus } from "../services/examination.service";

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
    const chairman = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `chairman-${suffix}@scope-test.invalid`,
        idNumber: `CH-${suffix}`,
        passwordHash: "integration-test-not-a-real-password",
        firstName: "Scope",
        lastName: "Chairman",
      },
    });
    const directorActor = {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["exams.approve", "exams.manage", "fees.structure.read", "fees.reports.export"],
    };
    const chairmanActor = {
      id: chairman.id, institutionId: institution.id, email: chairman.email,
      roles: ["CHAIRMAN"], permissions: ["exams.approve", "exams.manage", "fees.structure.read"],
    };
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
    const assignedSession = await createExamSession(institution.id, directorActor, {
      name: "Assigned campus examination",
      code: `DIR-${suffix.slice(0, 8)}`,
      examType: "REGULAR",
      startDate: new Date("2030-01-01T00:00:00.000Z"),
      endDate: new Date("2030-01-03T00:00:00.000Z"),
      departmentIds: [departmentA.id],
    }, {});
    const otherCampusSession = await createExamSession(institution.id, chairmanActor, {
      name: "Other campus examination",
      code: `CH-${suffix.slice(0, 8)}`,
      examType: "REGULAR",
      startDate: new Date("2030-02-01T00:00:00.000Z"),
      endDate: new Date("2030-02-03T00:00:00.000Z"),
      departmentIds: [departmentB.id],
    }, {});
    const directorSessions = await listExamSessions(institution.id, directorActor, { page: 1, pageSize: 100, skip: 0, take: 100 }, {});
    assert.ok(directorSessions.items.some((row) => row.id === assignedSession.id));
    assert.ok(!directorSessions.items.some((row) => row.id === otherCampusSession.id), "Director session lists must exclude another campus");
    const changedSession = await updateExamSessionStatus(institution.id, directorActor, assignedSession.id, "SCHEDULED", {});
    assert.equal(changedSession.status, "SCHEDULED", "Director may transition an in-scope session");
    await assert.rejects(
      () => updateExamSessionStatus(institution.id, directorActor, otherCampusSession.id, "CANCELLED", {}),
      /assigned scope|not found/i,
    );
    await assert.rejects(
      () => createExamSession(institution.id, directorActor, {
        name: "Forbidden campus examination",
        code: `NO-${suffix.slice(0, 8)}`,
        examType: "REGULAR",
        startDate: new Date("2030-03-01T00:00:00.000Z"),
        endDate: new Date("2030-03-03T00:00:00.000Z"),
        departmentIds: [departmentB.id],
      }, {}),
      /assigned scope|assigned to this account/i,
    );
    await assert.rejects(() => getExamSession(institution.id, directorActor, otherCampusSession.id));
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
    const reportOptions = await getAttendanceReportOptions(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["attendance.read"],
    });
    assert.deepEqual(reportOptions.departments.map((row) => row.id), [departmentA.id]);
    assert.deepEqual(reportOptions.programs.map((row) => row.id), [programA.id]);
  } finally {
    await prisma.$executeRaw`DELETE FROM "exam_sessions" WHERE "institutionId" = ${institution.id}`;
    await prisma.feeStructure.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
