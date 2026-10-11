import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { getDirectorDepartmentIds } from "../services/accessScope.service";
import { approveFeeStructure, listFeeStructures } from "../services/feeStructure.service";
import { exportData } from "../services/export.service";
import { getInstitutionInsights } from "../services/intelligence.service";
import { getAttendanceReportOptions } from "../services/attendanceReport.service";
import { getExamSession, listExamSessions } from "../services/examination.service";

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
      roles: ["DIRECTOR"], permissions: ["exams.approve", "exams.read", "fees.structure.read", "fees.structure.approve", "fees.reports.export"],
    };
    const examinationCell = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: `exam-cell-${suffix}@scope-test.invalid`,
        idNumber: `EX-${suffix}`,
        passwordHash: "integration-test-not-a-real-password",
        firstName: "Scope",
        lastName: "Examination",
      },
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
        data: { institutionId: institution.id, name: "Assigned campus fees", programId: programA.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
      }),
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Unassigned campus fees", programId: programB.id, createdById: director.id, status: "ACTIVE" },
      }),
    ]);

    const assigned = await getDirectorDepartmentIds(institution.id, director.id);
    assert.deepEqual(assigned, [departmentA.id]);
    const assignedSessionId = randomUUID();
    const otherCampusSessionId = randomUUID();
    const examSessionInsert = async (id: string, name: string, code: string, departmentId: string, startDate: Date, endDate: Date) => {
      await prisma.$executeRaw`
        INSERT INTO "exam_sessions"
          ("id","institutionId","name","code","examType","status","startDate","endDate","createdById",
           "campusIds","departmentIds","programIds","semesterIds","sectionIds","studentIds",
           "registrationRequired","examFee","eligibilityRules","registrationStatus")
        VALUES
          (${id},${institution.id},${name},${code},'REGULAR','DRAFT',${startDate},${endDate},${examinationCell.id},
           '[]'::jsonb,${JSON.stringify([departmentId])}::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
           TRUE,0,'{}'::jsonb,'NOT_OPEN')
      `;
    };
    await examSessionInsert(assignedSessionId, "Assigned campus examination", `EX-${suffix.slice(0, 8)}`, departmentA.id, new Date("2030-01-01T00:00:00.000Z"), new Date("2030-01-03T00:00:00.000Z"));
    await examSessionInsert(otherCampusSessionId, "Other campus examination", `OUT-${suffix.slice(0, 8)}`, departmentB.id, new Date("2030-02-01T00:00:00.000Z"), new Date("2030-02-03T00:00:00.000Z"));
    const directorSessions = await listExamSessions(institution.id, directorActor, { page: 1, pageSize: 100, skip: 0, take: 100 }, {});
    assert.ok(directorSessions.items.some((row) => row.id === assignedSessionId));
    assert.ok(!directorSessions.items.some((row) => row.id === otherCampusSessionId), "Director session lists must exclude another campus");
    await getExamSession(institution.id, directorActor, assignedSessionId);
    await assert.rejects(() => getExamSession(institution.id, directorActor, otherCampusSessionId));
    assert.ok(!assigned.includes(departmentB.id), "departments at an unassigned campus must never be inferred as authorized");
    assert.deepEqual(await getDirectorDepartmentIds(institution.id, `no-access-${suffix}`), []);
    const visibleFees = await listFeeStructures(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["fees.structure.read"],
    });
    assert.deepEqual(visibleFees.map((row) => row.id), [feeA.id]);
    assert.ok(!visibleFees.some((row) => row.id === feeB.id), "fee structures at another campus must not be returned to the Director");
    await approveFeeStructure(institution.id, directorActor, feeA.id);
    await assert.rejects(() => approveFeeStructure(institution.id, directorActor, feeB.id), /not found|assigned scope/i);
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: feeA.id } }))?.status, "ACTIVE");
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: feeB.id } }))?.status, "PENDING_APPROVAL", "out-of-scope approval must not mutate the other campus record");

    const financeExport = await exportData(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["fees.reports.export"],
    }, "fee-structures", "json");
    const exportedFees = JSON.parse(financeExport.buffer.toString("utf8")) as Array<{ id: string }>;
    assert.deepEqual(exportedFees.map((row) => row.id), [feeA.id], "downloaded fee structure exports must enforce the same campus boundary");
    await assert.rejects(() => exportData(institution.id, { id: director.id, institutionId: institution.id, email: director.email, roles: ["DIRECTOR"], permissions: ["fees.reports.export"] }, "fee-structures", "json", { filters: { departmentId: departmentB.id } }), /outside the authorized export scope/i);
    await assert.rejects(() => exportData(institution.id, { id: director.id, institutionId: institution.id, email: director.email, roles: ["DIRECTOR"], permissions: ["students.read"] }, "students", "json", { filters: { programId: programB.id } }), /outside the authorized export scope/i);

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
