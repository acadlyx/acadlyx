import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { createPlacementVisit, listPlacementVisits } from "../services/placement.service";

test("placement visit is visible only to its explicitly targeted student and omits private staff notes", {
  skip: process.env.RUN_POSTGRES_INTEGRATION !== "1" || !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Placement audience ${suffix}`, slug: `placement-aud-${suffix}` },
  });

  try {
    const [staff, intendedStudent, otherStudent] = await Promise.all([
      prisma.user.create({ data: { institutionId: institution.id, email: `placement-${suffix}@test.invalid`, idNumber: `PL-${suffix}`, passwordHash: "integration-test-only", firstName: "Placement", lastName: "Staff" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `target-${suffix}@test.invalid`, idNumber: `ST-A-${suffix}`, passwordHash: "integration-test-only", firstName: "Target", lastName: "Student" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `other-${suffix}@test.invalid`, idNumber: `ST-B-${suffix}`, passwordHash: "integration-test-only", firstName: "Other", lastName: "Student" } }),
    ]);
    const [placementRole, studentRole] = await Promise.all([
      prisma.role.create({ data: { institutionId: institution.id, name: "PLACEMENT", isSystem: true } }),
      prisma.role.create({ data: { institutionId: institution.id, name: "STUDENT", isSystem: true } }),
    ]);
    await Promise.all([
      prisma.userRole.create({ data: { userId: staff.id, roleId: placementRole.id } }),
      prisma.userRole.create({ data: { userId: intendedStudent.id, roleId: studentRole.id } }),
      prisma.userRole.create({ data: { userId: otherStudent.id, roleId: studentRole.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: intendedStudent.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: otherStudent.id } }),
    ]);
    const company = await prisma.placementCompany.create({
      data: { institutionId: institution.id, name: `Audience company ${suffix}`, createdById: staff.id },
    });
    const staffActor = {
      id: staff.id, institutionId: institution.id, email: staff.email,
      roles: ["PLACEMENT"], permissions: ["placements.manage", "placements.read"],
    };
    const intendedActor = {
      id: intendedStudent.id, institutionId: institution.id, email: intendedStudent.email,
      roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
    };
    const otherActor = {
      id: otherStudent.id, institutionId: institution.id, email: otherStudent.email,
      roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
    };

    const created = await createPlacementVisit(institution.id, staffActor, {
      companyId: company.id,
      type: "Pre-placement talk",
      startsAt: "2030-03-01T10:00:00.000Z",
      endsAt: "2030-03-01T11:00:00.000Z",
      venue: "Auditorium",
      purpose: "Company introduction",
      participatingStudentIds: [intendedStudent.id],
      notes: "Private recruiter follow-up: do not disclose",
    });
    assert.ok(created.id);

    const [intended, other] = await Promise.all([
      listPlacementVisits(institution.id, intendedActor),
      listPlacementVisits(institution.id, otherActor),
    ]);
    assert.equal(intended.length, 1, "target student must receive the assigned activity");
    assert.equal(intended[0].id, created.id);
    assert.equal(intended[0].company.name, company.name);
    assert.equal(Object.hasOwn(intended[0], "notes"), false, "private staff notes must not be returned");
    assert.equal(other.length, 0, "students outside the explicit audience must not see the activity");
  } finally {
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});

test("scheduled assessment is persisted for its explicit candidates and invisible to other students", {
  skip: process.env.RUN_POSTGRES_INTEGRATION !== "1" || !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Placement assessment ${suffix}`, slug: `placement-test-${suffix}` },
  });
  try {
    const [staff, intendedStudent, otherStudent] = await Promise.all([
      prisma.user.create({ data: { institutionId: institution.id, email: `assessor-${suffix}@test.invalid`, idNumber: `PA-${suffix}`, passwordHash: "integration-test-only", firstName: "Assessment", lastName: "Staff" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `candidate-a-${suffix}@test.invalid`, idNumber: `CA-${suffix}`, passwordHash: "integration-test-only", firstName: "Candidate", lastName: "One" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `candidate-b-${suffix}@test.invalid`, idNumber: `CB-${suffix}`, passwordHash: "integration-test-only", firstName: "Candidate", lastName: "Two" } }),
    ]);
    const [placementRole, studentRole] = await Promise.all([
      prisma.role.create({ data: { institutionId: institution.id, name: "PLACEMENT", isSystem: true } }),
      prisma.role.create({ data: { institutionId: institution.id, name: "STUDENT", isSystem: true } }),
    ]);
    await Promise.all([
      prisma.userRole.create({ data: { userId: staff.id, roleId: placementRole.id } }),
      prisma.userRole.create({ data: { userId: intendedStudent.id, roleId: studentRole.id } }),
      prisma.userRole.create({ data: { userId: otherStudent.id, roleId: studentRole.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: intendedStudent.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: otherStudent.id } }),
    ]);
    const company = await prisma.placementCompany.create({
      data: { institutionId: institution.id, name: `Assessment company ${suffix}`, createdById: staff.id },
    });
    const drive = await prisma.placementDrive.create({
      data: { institutionId: institution.id, companyId: company.id, title: "Targeted recruitment drive" },
    });
    const staffActor = {
      id: staff.id, institutionId: institution.id, email: staff.email,
      roles: ["PLACEMENT"], permissions: ["placements.manage", "placements.read"],
    };
    const intendedActor = {
      id: intendedStudent.id, institutionId: institution.id, email: intendedStudent.email,
      roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
    };
    const otherActor = {
      id: otherStudent.id, institutionId: institution.id, email: otherStudent.email,
      roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
    };
    const created = await createPlacementTest(institution.id, staffActor, {
      driveId: drive.id,
      title: "Aptitude assessment",
      scheduledAt: "2030-03-01T10:00:00.000Z",
      durationMinutes: 45,
      instructions: "Join five minutes early",
      studentIds: [intendedStudent.id],
    });
    const [intended, other] = await Promise.all([
      listPlacementTests(institution.id, intendedActor),
      listPlacementTests(institution.id, otherActor),
    ]);
    assert.equal(intended.length, 1);
    assert.equal(intended[0].id, created.id);
    assert.equal(intended[0].participants[0]?.resultStatus, "PENDING");
    assert.equal(intended[0].instructions, "Join five minutes early");
    assert.equal(other.length, 0);
  } finally {
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
