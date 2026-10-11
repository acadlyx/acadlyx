import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import {
  assignFeeStructure,
  createFeeStructure,
  publishFeeStructure,
} from "../services/feeStructure.service";

test("Chairman draft publication unlocks idempotent Accounts assignment and persisted invoice rows", {
  skip: process.env.RUN_POSTGRES_INTEGRATION !== "1" || !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Fee lifecycle ${suffix}`, slug: `fee-life-${suffix}` },
  });

  try {
    const department = await prisma.department.create({
      data: { institutionId: institution.id, name: "Test department", code: `FD-${suffix.slice(0, 8)}` },
    });
    const program = await prisma.program.create({
      data: {
        institutionId: institution.id,
        departmentId: department.id,
        name: "Test program",
        code: `FP-${suffix.slice(0, 8)}`,
        level: "UG",
        durationYears: 4,
      },
    });
    const academicYear = await prisma.academicYear.create({
      data: {
        institutionId: institution.id,
        name: `FY-${suffix.slice(0, 8)}`,
        startDate: new Date("2029-07-01T00:00:00.000Z"),
        endDate: new Date("2030-06-30T00:00:00.000Z"),
      },
    });
    const semester = await prisma.semester.create({
      data: {
        institutionId: institution.id,
        programId: program.id,
        academicYearId: academicYear.id,
        number: 1,
        name: "Semester 1",
      },
    });
    const [chairman, accounts, student] = await Promise.all([
      prisma.user.create({
        data: { institutionId: institution.id, email: `chairman-${suffix}@fee-test.invalid`, idNumber: `CH-${suffix}`, passwordHash: "not-a-login-secret", firstName: "Test", lastName: "Chairman" },
      }),
      prisma.user.create({
        data: { institutionId: institution.id, email: `accounts-${suffix}@fee-test.invalid`, idNumber: `AC-${suffix}`, passwordHash: "not-a-login-secret", firstName: "Test", lastName: "Accounts" },
      }),
      prisma.user.create({
        data: { institutionId: institution.id, email: `student-${suffix}@fee-test.invalid`, idNumber: `ST-${suffix}`, passwordHash: "not-a-login-secret", firstName: "Test", lastName: "Student" },
      }),
    ]);
    const studentRole = await prisma.role.create({
      data: { institutionId: institution.id, name: "STUDENT", isSystem: true },
    });
    await prisma.userRole.create({ data: { userId: student.id, roleId: studentRole.id } });
    await prisma.studentEnrollment.create({
      data: {
        institutionId: institution.id,
        userId: student.id,
        programId: program.id,
        academicYearId: academicYear.id,
        semesterId: semester.id,
        status: "ACTIVE",
      },
    });
    const feeHead = await prisma.feeHead.create({
      data: { institutionId: institution.id, name: "Tuition", code: `TU-${suffix.slice(0, 8)}` },
    });

    const chairmanActor = {
      id: chairman.id,
      institutionId: institution.id,
      email: chairman.email,
      roles: ["CHAIRMAN"],
      permissions: ["fees.structure.manage", "fees.structure.publish", "fees.structure.read"],
    };
    const accountsActor = {
      id: accounts.id,
      institutionId: institution.id,
      email: accounts.email,
      roles: ["ACCOUNTS"],
      permissions: ["fees.assign", "fees.structure.read"],
    };

    const created = await createFeeStructure(institution.id, chairmanActor, {
      name: "Published tuition fee",
      academicYearId: academicYear.id,
      programId: program.id,
      semesterId: semester.id,
      items: [{ feeHeadId: feeHead.id, amount: 12500, dueDays: 30, installmentNumber: 1 }],
    });
    assert.equal(created.status, "DRAFT", "create must never publish implicitly");

    await assert.rejects(
      () => assignFeeStructure(institution.id, accountsActor, created.id, [student.id]),
      /ACTIVE fee structure/i,
      "Accounts cannot assign a draft",
    );

    await publishFeeStructure(institution.id, chairmanActor, created.id);
    const persisted = await prisma.feeStructure.findFirstOrThrow({
      where: { id: created.id, institutionId: institution.id },
    });
    assert.equal(persisted.status, "ACTIVE", "Chairman publication must persist before assignment");

    const first = await assignFeeStructure(institution.id, accountsActor, created.id, [student.id]);
    assert.equal(first.generated, 1);
    assert.equal(first.studentCount, 1);
    const invoices = await prisma.feeInvoice.findMany({
      where: { institutionId: institution.id, feeStructureId: created.id, studentId: student.id },
    });
    assert.equal(invoices.length, 1);
    assert.equal(Number(invoices[0].amount), 12500);
    assert.equal(invoices[0].status, "PENDING");

    const second = await assignFeeStructure(institution.id, accountsActor, created.id, [student.id]);
    assert.equal(second.generated, 0, "repeated assignment must not duplicate invoices");
    assert.equal(second.skipped, 1);
    assert.equal(
      await prisma.feeInvoice.count({ where: { institutionId: institution.id, feeStructureId: created.id, studentId: student.id } }),
      1,
    );
    assert.equal(
      await prisma.feeTransaction.count({ where: { institutionId: institution.id, invoiceId: invoices[0].id, type: "INVOICE" } }),
      1,
      "assignment must persist exactly one matching finance transaction",
    );
  } finally {
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
