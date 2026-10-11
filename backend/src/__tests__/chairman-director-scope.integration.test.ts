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
    const academicYear = await prisma.academicYear.create({
      data: { institutionId: institution.id, name: `2029-30-${suffix.slice(0, 6)}`, startDate: new Date("2029-07-01T00:00:00.000Z"), endDate: new Date("2030-06-30T00:00:00.000Z") },
    });
    const [semesterA, semesterB] = await Promise.all([
      prisma.semester.create({
        data: { institutionId: institution.id, programId: programA.id, academicYearId: academicYear.id, number: 1, name: "Assigned semester" },
      }),
      prisma.semester.create({
        data: { institutionId: institution.id, programId: programB.id, academicYearId: academicYear.id, number: 1, name: "Unassigned semester" },
      }),
    ]);
    const [sectionA, sectionB] = await Promise.all([
      prisma.section.create({ data: { institutionId: institution.id, semesterId: semesterA.id, name: "Assigned section" } }),
      prisma.section.create({ data: { institutionId: institution.id, semesterId: semesterB.id, name: "Unassigned section" } }),
    ]);
    const [courseA, courseB] = await Promise.all([
      prisma.course.create({ data: { institutionId: institution.id, departmentId: departmentA.id, code: "CA-" + suffix.slice(0, 8), name: "Assigned course", credits: 3 } }),
      prisma.course.create({ data: { institutionId: institution.id, departmentId: departmentB.id, code: "CB-" + suffix.slice(0, 8), name: "Unassigned course", credits: 3 } }),
    ]);
    const [offeringA, offeringB] = await Promise.all([
      prisma.courseOffering.create({ data: { institutionId: institution.id, courseId: courseA.id, semesterId: semesterA.id, sectionId: sectionA.id, facultyId: examinationCell.id } }),
      prisma.courseOffering.create({ data: { institutionId: institution.id, courseId: courseB.id, semesterId: semesterB.id, sectionId: sectionB.id, facultyId: examinationCell.id } }),
    ]);
    const [studentA, studentB] = await Promise.all([
      prisma.user.create({ data: { institutionId: institution.id, email: "student-a-" + suffix + "@scope-test.invalid", idNumber: "SA-" + suffix, passwordHash: "integration-test-not-a-real-password", firstName: "Assigned", lastName: "Student" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: "student-b-" + suffix + "@scope-test.invalid", idNumber: "SB-" + suffix, passwordHash: "integration-test-not-a-real-password", firstName: "Other", lastName: "Student" } }),
    ]);
    await Promise.all([
      prisma.studentEnrollment.create({ data: { institutionId: institution.id, userId: studentA.id, programId: programA.id, academicYearId: academicYear.id, semesterId: semesterA.id, sectionId: sectionA.id } }),
      prisma.studentEnrollment.create({ data: { institutionId: institution.id, userId: studentB.id, programId: programB.id, academicYearId: academicYear.id, semesterId: semesterB.id, sectionId: sectionB.id } }),
    ]);
    const [attendanceA, attendanceB] = await Promise.all([
      prisma.attendanceSession.create({ data: { institutionId: institution.id, courseOfferingId: offeringA.id, facultyId: examinationCell.id, sessionDate: new Date("2030-03-01T00:00:00.000Z") } }),
      prisma.attendanceSession.create({ data: { institutionId: institution.id, courseOfferingId: offeringB.id, facultyId: examinationCell.id, sessionDate: new Date("2030-03-02T00:00:00.000Z") } }),
    ]);
    await Promise.all([
      prisma.attendanceRecord.create({ data: { attendanceSessionId: attendanceA.id, studentId: studentA.id, status: "PRESENT" } }),
      prisma.attendanceRecord.create({ data: { attendanceSessionId: attendanceB.id, studentId: studentB.id, status: "PRESENT" } }),
    ]);

    const [feeA, feeB, semesterFeeA, semesterFeeB] = await Promise.all([
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Assigned campus fees", programId: programA.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
      }),
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Unassigned campus fees", programId: programB.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
      }),
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Assigned semester fees", semesterId: semesterA.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
      }),
      prisma.feeStructure.create({
        data: { institutionId: institution.id, name: "Unassigned semester fees", semesterId: semesterB.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
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
    assert.deepEqual(visibleFees.map((row) => row.id).sort(), [feeA.id, semesterFeeA.id].sort());
    assert.ok(!visibleFees.some((row) => row.id === feeB.id || row.id === semesterFeeB.id), "program- and semester-linked structures at another campus must not be returned to the Director");
    await approveFeeStructure(institution.id, directorActor, feeA.id);
    await approveFeeStructure(institution.id, directorActor, semesterFeeA.id);
    await assert.rejects(() => approveFeeStructure(institution.id, directorActor, feeB.id), /not found|assigned scope/i);
    await assert.rejects(() => approveFeeStructure(institution.id, directorActor, semesterFeeB.id), /not found|assigned scope/i);
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: feeA.id } }))?.status, "ACTIVE");
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: semesterFeeA.id } }))?.status, "ACTIVE");
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: feeB.id } }))?.status, "PENDING_APPROVAL", "out-of-scope approval must not mutate the other campus record");
    assert.equal((await prisma.feeStructure.findUnique({ where: { id: semesterFeeB.id } }))?.status, "PENDING_APPROVAL", "out-of-scope semester approval must not mutate the other campus record");

    const raceFee = await prisma.feeStructure.create({
      data: { institutionId: institution.id, name: "Concurrent approval fees", programId: programA.id, createdById: chairman.id, status: "PENDING_APPROVAL" },
    });
    const decisions = await Promise.allSettled([
      approveFeeStructure(institution.id, directorActor, raceFee.id),
      approveFeeStructure(institution.id, directorActor, raceFee.id),
    ]);
    assert.equal(decisions.filter((decision) => decision.status === "fulfilled").length, 1, "only one concurrent approval may win");
    assert.equal(decisions.filter((decision) => decision.status === "rejected").length, 1, "the losing approval must receive a conflict");
    assert.equal(await prisma.auditLog.count({ where: { institutionId: institution.id, userId: director.id, action: "fee-structure.approve", entityId: raceFee.id } }), 1, "one state transition must produce exactly one audit row");

    const financeExport = await exportData(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["fees.reports.export"],
    }, "fee-structures", "json");
    const exportedFees = JSON.parse(financeExport.buffer.toString("utf8")) as Array<{ id: string }>;
    assert.deepEqual(exportedFees.map((row) => row.id).sort(), [feeA.id, semesterFeeA.id, raceFee.id].sort(), "downloaded fee structure exports must include program- and semester-linked assigned-campus structures and exclude the other campus");
    await assert.rejects(() => exportData(institution.id, { id: director.id, institutionId: institution.id, email: director.email, roles: ["DIRECTOR"], permissions: ["fees.reports.export"] }, "fee-structures", "json", { filters: { departmentId: departmentB.id } }), /outside the authorized export scope/i);
    await assert.rejects(() => exportData(institution.id, { id: director.id, institutionId: institution.id, email: director.email, roles: ["DIRECTOR"], permissions: ["students.read"] }, "students", "json", { filters: { programId: programB.id } }), /outside the authorized export scope/i);

    const attendanceExport = await exportData(institution.id, {
      id: director.id, institutionId: institution.id, email: director.email,
      roles: ["DIRECTOR"], permissions: ["attendance.read"],
    }, "attendance", "json");
    const exportedAttendance = JSON.parse(attendanceExport.buffer.toString("utf8")) as Array<{ id: string; studentEmail: string }>;
    const assignedAttendance = await prisma.attendanceRecord.findFirstOrThrow({ where: { attendanceSessionId: attendanceA.id } });
    assert.deepEqual(exportedAttendance.map((row) => row.id), [assignedAttendance.id], "attendance downloads must include assigned-campus records only");
    assert.ok(!exportedAttendance.some((row) => row.studentEmail === studentB.email), "attendance downloads must not expose students from another campus");

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
