import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { drainDomainEventOutbox } from "../services/domainEvent.service";
import "../services/placementAutomation.service";
import { createPlacementTest, createPlacementVisit, listPlacementTests, listPlacementVisits, updatePlacementTest, updatePlacementVisit } from "../services/placement.service";

async function createActiveStudentEnrollment(institutionId: string, userId: string, suffix: string) {
  const campus = await prisma.campus.create({
    data: { institutionId, name: `Placement campus ${suffix}`, code: `PC-${suffix.slice(0, 8)}` },
  });
  const department = await prisma.department.create({
    data: { institutionId, campusId: campus.id, name: `Placement department ${suffix}`, code: `PD-${suffix.slice(0, 8)}` },
  });
  const program = await prisma.program.create({
    data: { institutionId, departmentId: department.id, name: `Placement programme ${suffix}`, code: `PP-${suffix.slice(0, 8)}`, level: "UG", durationYears: 4 },
  });
  const academicYear = await prisma.academicYear.create({
    data: { institutionId, name: `Placement academic year ${suffix.slice(0, 12)}`, startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2027-03-31T00:00:00.000Z") },
  });
  const batch = await prisma.batch.create({
    data: { institutionId, programId: program.id, name: `Placement batch ${suffix.slice(0, 12)}`, code: `PB-${suffix.slice(0, 8)}`, admissionYear: 2023, completionYear: 2027 },
  });
  return prisma.studentEnrollment.create({
    data: { institutionId, userId, programId: program.id, academicYearId: academicYear.id, batchId: batch.id, status: "ACTIVE" },
  });
}

async function drainPlacementEvents(institutionId: string) {
  // Drain in bounded batches until the tenant's currently eligible outbox queue
  // is empty. One 100-event batch may not reach the event whose lifecycle is
  // under assertion when other workflows have enqueued more work in the fixture.
  let claimed = 0;
  let failed = 0;
  for (let batch = 0; batch < 25; batch += 1) {
    const result = await drainDomainEventOutbox(100, { institutionId });
    claimed += result.claimed;
    failed += result.failed;
    if (result.claimed < 100) break;
  }
  if (failed > 0) {
    const failedEvents = await prisma.domainEventOutbox.findMany({
      where: { institutionId, processedAt: null, lastError: { not: null } },
      select: { name: true, payload: true, attempts: true, lastError: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    assert.equal(failed, 0, "placement outbox event handler failed after claiming " + claimed + " events: " + JSON.stringify(failedEvents));
  }
}

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
      createActiveStudentEnrollment(institution.id, intendedStudent.id, `visit-${suffix}`),
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
    await drainPlacementEvents(institution.id);

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
    await prisma.placementVisit.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementTest.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementDrive.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementCompany.deleteMany({ where: { institutionId: institution.id } });
    await prisma.domainEventOutbox.deleteMany({ where: { institutionId: institution.id } });
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
      createActiveStudentEnrollment(institution.id, intendedStudent.id, `test-${suffix}`),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: intendedStudent.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: otherStudent.id } }),
    ]);
    const company = await prisma.placementCompany.create({
      data: { institutionId: institution.id, name: `Assessment company ${suffix}`, createdById: staff.id },
    });
    const opportunity = await prisma.opportunity.create({
      data: {
        institutionId: institution.id,
        title: "Targeted assessment role",
        organization: company.name,
        description: "PostgreSQL placement audience test fixture.",
      },
    });
    const drive = await prisma.placementDrive.create({
      data: { institutionId: institution.id, companyId: company.id, opportunityId: opportunity.id, title: "Targeted recruitment drive", status: "TEST" },
    });
    await prisma.application.create({
      data: {
        institutionId: institution.id,
        studentId: intendedStudent.id,
        opportunityId: opportunity.id,
        placementDriveId: drive.id,
        status: "SHORTLISTED",
      },
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
      status: "DRAFT",
      scheduledAt: "2030-03-01T10:00:00.000Z",
      durationMinutes: 45,
      instructions: "Join five minutes early",
      studentIds: [intendedStudent.id],
    });
    assert.equal((await listPlacementTests(institution.id, intendedActor)).length, 0, "draft assessment must not be visible to students");
    assert.equal(await prisma.notification.count({ where: { institutionId: institution.id, userId: intendedStudent.id, dedupeKey: { startsWith: `placement:test:${created.id}:` } } }), 0, "draft assessment must not notify students");
    await updatePlacementTest(institution.id, staffActor, created.id, { status: "SCHEDULED" });
    await drainPlacementEvents(institution.id);
    const [intended, other] = await Promise.all([
      listPlacementTests(institution.id, intendedActor),
      listPlacementTests(institution.id, otherActor),
    ]);
    assert.equal(intended.length, 1);
    assert.equal(intended[0].id, created.id);
    assert.equal(intended[0].participants[0]?.resultStatus, "PENDING");
    assert.equal(intended[0].instructions, "Join five minutes early");
    assert.equal(other.length, 0);
    assert.equal(await prisma.notification.count({ where: { institutionId: institution.id, userId: intendedStudent.id, dedupeKey: { startsWith: `placement:test:${created.id}:published:` } } }), 1, "publishing assessment notifies assigned student exactly once");
  } finally {
    await prisma.placementVisit.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementTest.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementDrive.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementCompany.deleteMany({ where: { institutionId: institution.id } });
    await prisma.domainEventOutbox.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});


test("cohort targeting, idempotent notifications, rescheduling and cancellation stay synchronized", {
  skip: process.env.RUN_POSTGRES_INTEGRATION !== "1" || !process.env.DATABASE_URL,
}, async () => {
  const suffix = randomUUID();
  const institution = await prisma.institution.create({
    data: { name: `Placement cohort ${suffix}`, slug: `placement-cohort-${suffix}` },
  });
  try {
    const [staff, cohortStudent, otherStudent] = await Promise.all([
      prisma.user.create({ data: { institutionId: institution.id, email: `cohort-staff-${suffix}@test.invalid`, idNumber: `CS-${suffix}`, passwordHash: "integration-test-only", firstName: "Cohort", lastName: "Staff" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `cohort-target-${suffix}@test.invalid`, idNumber: `CT-${suffix}`, passwordHash: "integration-test-only", firstName: "Cohort", lastName: "Target" } }),
      prisma.user.create({ data: { institutionId: institution.id, email: `cohort-other-${suffix}@test.invalid`, idNumber: `CO-${suffix}`, passwordHash: "integration-test-only", firstName: "Other", lastName: "Student" } }),
    ]);
    const [placementRole, studentRole] = await Promise.all([
      prisma.role.create({ data: { institutionId: institution.id, name: "PLACEMENT", isSystem: true } }),
      prisma.role.create({ data: { institutionId: institution.id, name: "STUDENT", isSystem: true } }),
    ]);
    await Promise.all([
      prisma.userRole.create({ data: { userId: staff.id, roleId: placementRole.id } }),
      prisma.userRole.create({ data: { userId: cohortStudent.id, roleId: studentRole.id } }),
      prisma.userRole.create({ data: { userId: otherStudent.id, roleId: studentRole.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: cohortStudent.id } }),
      prisma.placementProfile.create({ data: { institutionId: institution.id, studentId: otherStudent.id } }),
    ]);
    const campus = await prisma.campus.create({ data: { institutionId: institution.id, name: "North Campus", code: `NC-${suffix.slice(0, 8)}` } });
    const department = await prisma.department.create({ data: { institutionId: institution.id, campusId: campus.id, name: "Computer Science", code: `CSE-${suffix.slice(0, 8)}` } });
    const program = await prisma.program.create({ data: { institutionId: institution.id, departmentId: department.id, name: "B.Tech Computer Science", code: `BTCS-${suffix.slice(0, 8)}`, level: "UG", durationYears: 4 } });
    const academicYear = await prisma.academicYear.create({ data: { institutionId: institution.id, name: `2026-2027-${suffix.slice(0, 4)}`, startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2027-03-31T00:00:00.000Z") } });
    const batch = await prisma.batch.create({ data: { institutionId: institution.id, programId: program.id, name: "2023-2027", code: `BATCH-${suffix.slice(0, 8)}`, admissionYear: 2023, completionYear: 2027 } });
    await prisma.studentEnrollment.create({ data: { institutionId: institution.id, userId: cohortStudent.id, programId: program.id, academicYearId: academicYear.id, batchId: batch.id, status: "ACTIVE" } });
    const company = await prisma.placementCompany.create({ data: { institutionId: institution.id, name: `Cohort company ${suffix}`, createdById: staff.id } });
    const staffActor = { id: staff.id, institutionId: institution.id, email: staff.email, roles: ["PLACEMENT"], permissions: ["placements.manage", "placements.read"] };
    const cohortActor = { id: cohortStudent.id, institutionId: institution.id, email: cohortStudent.email, roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"] };
    const otherActor = { id: otherStudent.id, institutionId: institution.id, email: otherStudent.email, roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"] };

    const event = await createPlacementVisit(institution.id, staffActor, {
      companyId: company.id,
      type: "Cohort orientation",
      startsAt: "2030-04-01T10:00:00.000Z",
      targeting: { campusIds: [campus.id], departmentIds: [department.id], programIds: [program.id], batchIds: [batch.id], graduatingYears: [2027] },
    });
    await drainPlacementEvents(institution.id);
    assert.equal((await listPlacementVisits(institution.id, cohortActor)).length, 1);
    assert.equal((await listPlacementVisits(institution.id, otherActor)).length, 0);
    const createdNotification = await prisma.notification.findMany({ where: { institutionId: institution.id, userId: cohortStudent.id, dedupeKey: { startsWith: `placement:visit:${event.id}:created:` } } });
    assert.equal(createdNotification.length, 1, "creation notification must be delivered once");

    await updatePlacementVisit(institution.id, staffActor, event.id, { startsAt: "2030-04-02T10:00:00.000Z" });
    await drainPlacementEvents(institution.id);
    await updatePlacementVisit(institution.id, staffActor, event.id, { startsAt: "2030-04-02T10:00:00.000Z" });
    await drainPlacementEvents(institution.id);
    const rescheduled = await prisma.notification.findMany({ where: { institutionId: institution.id, userId: cohortStudent.id, dedupeKey: { startsWith: `placement:visit:${event.id}:rescheduled:` } } });
    assert.equal(rescheduled.length, 1, "retrying the same reschedule must not duplicate notifications");
    await updatePlacementVisit(institution.id, staffActor, event.id, { status: "CANCELLED" });
    // publishDomainEvent persists the outbox row asynchronously; wait for the
    // specific cancellation event before invoking the real consumer so this
    // test cannot race the fire-and-forget insert and falsely report a drain.
    let cancellationQueued = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const queuedEvents = await prisma.domainEventOutbox.findMany({
        where: { institutionId: institution.id, name: "placement.schedule.changed" },
        select: { payload: true },
      });
      cancellationQueued = queuedEvents.some((entry) => {
        const payload = entry.payload as Record<string, unknown>;
        return payload.eventId === event.id && payload.version === "cancelled";
      });
      if (cancellationQueued) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(cancellationQueued, "cancellation event must be persisted before draining");
    await drainPlacementEvents(institution.id);
    assert.equal((await listPlacementVisits(institution.id, cohortActor)).length, 0, "cancelled activities must disappear from student schedules");
    const scheduleEvents = await prisma.domainEventOutbox.findMany({
      where: { institutionId: institution.id, name: "placement.schedule.changed" },
      select: { payload: true, processedAt: true, lastError: true },
      orderBy: { createdAt: "asc" },
    });
    const cancellationEvent = scheduleEvents.find((entry) => {
      const payload = entry.payload as Record<string, unknown>;
      return payload.eventId === event.id && payload.version === "cancelled";
    });
    assert.ok(cancellationEvent, "cancellation must enqueue a placement.schedule.changed event");
    assert.deepEqual((cancellationEvent.payload as Record<string, unknown>).recipientIds, [cohortStudent.id],
      "cancellation event must preserve the published activity's verified audience");
    assert.ok(cancellationEvent.processedAt, "cancellation event must be drained by the real outbox consumer");
    assert.equal(cancellationEvent.lastError, null, "cancellation event must not be left in retry after an error");
    const cancelled = await prisma.notification.findMany({ where: { institutionId: institution.id, userId: cohortStudent.id, dedupeKey: { startsWith: `placement:visit:${event.id}:cancelled:` } } });
    assert.equal(cancelled.length, 1, "cancellation notification must be delivered once");

    const draft = await createPlacementVisit(institution.id, staffActor, {
      companyId: company.id,
      type: "Draft cohort briefing",
      startsAt: "2030-04-03T10:00:00.000Z",
      status: "DRAFT",
      targeting: { batchIds: [batch.id] },
    });
    assert.equal((await listPlacementVisits(institution.id, cohortActor)).length, 0, "draft visits must not be visible to students");
    const draftCreatedNotifications = await prisma.notification.count({ where: { institutionId: institution.id, userId: cohortStudent.id, dedupeKey: { startsWith: `placement:visit:${draft.id}:` } } });
    assert.equal(draftCreatedNotifications, 0, "draft creation must not notify students");
    await updatePlacementVisit(institution.id, staffActor, draft.id, { status: "PUBLISHED" });
    await drainPlacementEvents(institution.id);
    assert.equal((await listPlacementVisits(institution.id, cohortActor)).length, 1, "publishing a draft makes it visible to the intended audience");
    const published = await prisma.notification.findMany({ where: { institutionId: institution.id, userId: cohortStudent.id, dedupeKey: { startsWith: `placement:visit:${draft.id}:published:` } } });
    assert.equal(published.length, 1, "publication notification must be delivered once");
    await updatePlacementVisit(institution.id, staffActor, draft.id, { status: "CANCELLED" });
    assert.equal((await listPlacementVisits(institution.id, cohortActor)).length, 0, "cancellation removes the published activity from student schedules");
  } finally {
    await prisma.placementVisit.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementTest.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementInterview.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementDrive.deleteMany({ where: { institutionId: institution.id } });
    await prisma.placementCompany.deleteMany({ where: { institutionId: institution.id } });
    await prisma.domainEventOutbox.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
  }
});
