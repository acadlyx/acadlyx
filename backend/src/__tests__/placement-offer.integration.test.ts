import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../lib/prisma";
import { drainDomainEventOutbox } from "../services/domainEvent.service";
import "../services/placementAutomation.service";
import {
  createPlacementOffer,
  getMyPlacementCalendar,
  listPlacementOffers,
  transitionPlacementOffer,
  verifyPlacementJoining,
} from "../services/placement.service";

async function createActiveEnrollment(institutionId: string, userId: string, suffix: string) {
  const campus = await prisma.campus.create({
    data: { institutionId, name: `Offer campus ${suffix}`, code: `OC-${suffix.slice(0, 8)}` },
  });
  const department = await prisma.department.create({
    data: { institutionId, campusId: campus.id, name: `Offer department ${suffix}`, code: `OD-${suffix.slice(0, 8)}` },
  });
  const program = await prisma.program.create({
    data: { institutionId, departmentId: department.id, name: `Offer programme ${suffix}`, code: `OP-${suffix.slice(0, 8)}`, level: "UG", durationYears: 4 },
  });
  const academicYear = await prisma.academicYear.create({
    data: { institutionId, name: `Offer year ${suffix.slice(0, 12)}`, startDate: new Date("2026-04-01T00:00:00.000Z"), endDate: new Date("2027-03-31T00:00:00.000Z") },
  });
  const batch = await prisma.batch.create({
    data: { institutionId, programId: program.id, name: `Offer batch ${suffix.slice(0, 12)}`, code: `OB-${suffix.slice(0, 8)}`, admissionYear: 2023, completionYear: 2027 },
  });
  return prisma.studentEnrollment.create({
    data: { institutionId, userId, programId: program.id, academicYearId: academicYear.id, batchId: batch.id, status: "ACTIVE" },
  });
}

test(
  "selected application issues one private offer notification, calendar deadline and joining history",
  { skip: process.env.RUN_POSTGRES_INTEGRATION !== "1" || !process.env.DATABASE_URL },
  async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const institution = await prisma.institution.create({
      data: { name: "Placement offer integration test", slug: `placement-offer-${suffix}` },
      select: { id: true },
    });

    try {
      const [staff, candidate, other] = await Promise.all([
        prisma.user.create({
          data: {
            institutionId: institution.id, email: `offer-staff-${suffix}@example.test`,
            idNumber: `OS-${suffix}`, passwordHash: "integration-test-only",
            firstName: "Offer", lastName: "Staff",
          },
          select: { id: true, email: true },
        }),
        prisma.user.create({
          data: {
            institutionId: institution.id, email: `offer-candidate-${suffix}@example.test`,
            idNumber: `OC-${suffix}`, passwordHash: "integration-test-only",
            firstName: "Selected", lastName: "Candidate",
          },
          select: { id: true, email: true },
        }),
        prisma.user.create({
          data: {
            institutionId: institution.id, email: `offer-other-${suffix}@example.test`,
            idNumber: `OO-${suffix}`, passwordHash: "integration-test-only",
            firstName: "Other", lastName: "Student",
          },
          select: { id: true, email: true },
        }),
      ]);

      const [placementRole, studentRole] = await Promise.all([
        prisma.role.create({ data: { institutionId: institution.id, name: "PLACEMENT", isSystem: true }, select: { id: true } }),
        prisma.role.create({ data: { institutionId: institution.id, name: "STUDENT", isSystem: true }, select: { id: true } }),
      ]);
      await Promise.all([
        prisma.userRole.create({ data: { userId: staff.id, roleId: placementRole.id } }),
        prisma.userRole.create({ data: { userId: candidate.id, roleId: studentRole.id } }),
        prisma.userRole.create({ data: { userId: other.id, roleId: studentRole.id } }),
        createActiveEnrollment(institution.id, candidate.id, `candidate-${suffix}`),
        createActiveEnrollment(institution.id, other.id, `other-${suffix}`),
      ]);

      const company = await prisma.placementCompany.create({
        data: { institutionId: institution.id, name: `Offer company ${suffix}`, createdById: staff.id },
        select: { id: true, name: true },
      });
      const opportunity = await prisma.opportunity.create({
        data: {
          institutionId: institution.id, title: "Software Engineer",
          organization: company.name, description: "Offer lifecycle integration fixture.",
        },
        select: { id: true },
      });
      const drive = await prisma.placementDrive.create({
        data: {
          institutionId: institution.id, companyId: company.id, opportunityId: opportunity.id,
          title: "Software Engineer Drive", status: "OFFERED",
        },
        select: { id: true },
      });
      const application = await prisma.application.create({
        data: {
          institutionId: institution.id, studentId: candidate.id,
          opportunityId: opportunity.id, placementDriveId: drive.id, status: "SELECTED",
        },
        select: { id: true },
      });
      const staffActor = {
        id: staff.id, institutionId: institution.id, email: staff.email,
        roles: ["PLACEMENT"], permissions: ["placements.manage", "placements.read"],
      };
      const candidateActor = {
        id: candidate.id, institutionId: institution.id, email: candidate.email,
        roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
      };
      const otherActor = {
        id: other.id, institutionId: institution.id, email: other.email,
        roles: ["STUDENT"], permissions: ["placements.read", "placements.apply"],
      };

      const offer = await createPlacementOffer(institution.id, staffActor, {
        applicationId: application.id,
        role: "Software Engineer",
        offerDate: "2030-01-01T00:00:00.000Z",
        responseDeadline: "2030-03-01T00:00:00.000Z",
        joiningDate: "2030-04-01T00:00:00.000Z",
        totalCtc: 1200000,
        currency: "INR",
        offerDocumentUrl: "https://private.example.test/offer-document.pdf",
      });
      await prisma.domainEventOutbox.updateMany({
        where: { institutionId: institution.id, processedAt: null },
        data: { createdAt: new Date("2000-01-01T00:00:00.000Z") },
      });
      await drainDomainEventOutbox(100);

      const notificationKey = `placement:offer:${offer.id}:issued:${candidate.id}`;
      const notifications = await prisma.notification.findMany({
        where: { institutionId: institution.id, userId: candidate.id, dedupeKey: notificationKey },
        select: { title: true, actionUrl: true, readAt: true },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].title, "You received a placement offer");
      assert.equal(notifications[0].actionUrl, "/student/placements");
      assert.equal(notifications[0].readAt, null);

      const [candidateOffers, otherOffers, calendar] = await Promise.all([
        listPlacementOffers(institution.id, candidateActor),
        listPlacementOffers(institution.id, otherActor),
        getMyPlacementCalendar(institution.id, candidateActor),
      ]);
      assert.equal(candidateOffers.length, 1);
      assert.equal(candidateOffers[0].id, offer.id);
      assert.equal(candidateOffers[0].offerDocumentUrl, "https://private.example.test/offer-document.pdf");
      assert.equal(otherOffers.length, 0, "another student must not see the offer or its document");
      assert.ok(calendar.some((item) => item.id === `offer-deadline:${offer.id}`), "response deadline must appear in the student's calendar");
      assert.ok(calendar.some((item) => item.id === `joining:${offer.id}`), "configured joining date must appear in the student's calendar");

      await transitionPlacementOffer(institution.id, candidateActor, offer.id, "ACCEPTED");
      const acceptedApplication = await prisma.application.findFirst({
        where: { id: application.id, institutionId: institution.id },
        select: { status: true },
      });
      assert.equal(acceptedApplication?.status, "ACCEPTED");

      await verifyPlacementJoining(institution.id, staffActor, offer.id, {
        status: "VERIFIED",
        actualJoiningDate: "2030-04-01T00:00:00.000Z",
        notes: "Verified by integration test",
      });
      await drainDomainEventOutbox(100);
      const [joinedOffer, joinedApplication] = await Promise.all([
        prisma.placementOffer.findFirst({ where: { id: offer.id, institutionId: institution.id }, select: { status: true, joiningStatus: true } }),
        prisma.application.findFirst({ where: { id: application.id, institutionId: institution.id }, select: { status: true } }),
      ]);
      assert.equal(joinedOffer?.status, "JOINED");
      assert.equal(joinedOffer?.joiningStatus, "VERIFIED");
      assert.equal(joinedApplication?.status, "JOINED");
    } finally {
      await prisma.domainEventOutbox.deleteMany({ where: { institutionId: institution.id } });
      await prisma.institution.delete({ where: { id: institution.id } });
    }
  },
);
