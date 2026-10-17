import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma";
import { commitPartialStudentImport } from "../services/studentImport.service";
import { parseWorkbook } from "../services/import.service";

const integrationEnabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);

test("partial student import preserves existing profile data and calculates missing fields from persisted state", {
  skip: !integrationEnabled,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: "Student import preservation " + suffix, slug: "stu-imp-" + suffix },
    select: { id: true },
  });

  try {
    const campus = await prisma.campus.create({
      data: { institutionId: institution.id, name: "Import campus " + suffix, code: "IC-" + suffix.slice(0, 8) },
      select: { id: true },
    });
    const department = await prisma.department.create({
      data: { institutionId: institution.id, campusId: campus.id, name: "Import department " + suffix, code: "ID-" + suffix.slice(0, 8) },
      select: { id: true },
    });
    const program = await prisma.program.create({
      data: { institutionId: institution.id, departmentId: department.id, name: "Import programme " + suffix, code: "IP-" + suffix.slice(0, 8), level: "UG", durationYears: 4 },
      select: { id: true },
    });
    const year = await prisma.academicYear.create({
      data: { institutionId: institution.id, name: "Import year " + suffix, startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2027-03-31T00:00:00.000Z"), isCurrent: true },
      select: { id: true },
    });
    const user = await prisma.user.create({
      data: {
        institutionId: institution.id,
        email: "existing-" + suffix + "@integration.invalid",
        idNumber: "EXIST-" + suffix,
        passwordHash: "integration-test-only",
        firstName: "Existing",
        lastName: "Student",
        phone: "9999912345",
      },
      select: { id: true, email: true, idNumber: true },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        institutionId: institution.id,
        userId: user.id,
        admissionNumber: "ADM-" + suffix,
        dateOfBirth: new Date("2008-05-04T00:00:00.000Z"),
        gender: "Female",
        address: "Preserved address",
        city: "Preserved city",
        guardianName: "Preserved guardian",
        guardianPhone: "9999987654",
        admissionDate: new Date("2026-04-10T00:00:00.000Z"),
        status: "ACTIVE",
      },
      select: { id: true, admissionNumber: true },
    });
    await prisma.studentEnrollment.create({
      data: { institutionId: institution.id, userId: user.id, programId: program.id, academicYearId: year.id, status: "ACTIVE", rollNumber: "ROLL-" + suffix },
      select: { id: true },
    });

    const headers = ["Admission Number", "Email", "First Name", "Last Name", "ID Number", "Phone", "Date Of Birth", "Gender", "Address", "Guardian Name", "Guardian Phone", "Status"];
    const csv = Buffer.from([
      headers.join(","),
      ["ADM-" + suffix, ...Array(11).fill("")].join(","),
    ].join("\n"));
    const actor = {
      id: user.id,
      institutionId: institution.id,
      email: "admin-" + suffix + "@integration.invalid",
      roles: ["INSTITUTION_ADMIN"],
      permissions: ["students.create", "students.update", "users.update"],
    };

    const parsedInput = parseWorkbook(csv);
    assert.equal(parsedInput.rows[0]?.admissionnumber, "ADM-" + suffix, "CSV parser must preserve the admission number header/value: " + JSON.stringify(parsedInput.rows[0]));
    const result = await commitPartialStudentImport(csv, institution.id, actor);
    assert.equal(result.imported, 1);
    assert.equal(result.failed, 0);
    assert.equal(result.incomplete.length, 0, "a previously complete student should not be redirected to manual completion just because columns were omitted; missing fields: " + JSON.stringify(result.incomplete.map((item) => ({ row: item.row, name: item.name, missingFields: item.missingFields }))));
    assert.equal(result.complete.length, 1);

    const [afterProfile, afterUser, afterEnrollment] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.findUnique({ where: { id: user.id } }),
      prisma.studentEnrollment.findUnique({ where: { userId_academicYearId: { userId: user.id, academicYearId: year.id } } }),
    ]);
    assert.ok(afterProfile);
    assert.ok(afterUser);
    assert.ok(afterEnrollment);
    assert.equal(afterProfile.address, "Preserved address");
    assert.equal(afterProfile.city, "Preserved city");
    assert.equal(afterProfile.guardianName, "Preserved guardian");
    assert.equal(afterProfile.guardianPhone, "9999987654");
    assert.equal(afterProfile.gender, "Female");
    assert.equal(afterProfile.status, "ACTIVE");
    assert.equal(afterProfile.admissionNumber, profile.admissionNumber);
    assert.equal(afterUser.email, user.email);
    assert.equal(afterUser.idNumber, user.idNumber);
    assert.equal(afterUser.firstName, "Existing");
    assert.equal(afterUser.lastName, "Student");
    assert.equal(afterUser.phone, "9999912345");
    assert.equal(afterEnrollment.programId, program.id);
    assert.equal(afterEnrollment.rollNumber, "ROLL-" + suffix);
  } finally {
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
