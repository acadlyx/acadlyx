import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma";
import { drainDomainEventOutbox } from "../services/domainEvent.service";
import "../services/placementAutomation.service";

const postgresIntegrationEnabled =
  process.env.RUN_POSTGRES_INTEGRATION === "1" &&
  Boolean(process.env.DATABASE_URL);

test(
  "placement application event creates one persistent in-app notification and retry is idempotent",
  { skip: !postgresIntegrationEnabled },
  async () => {
    const runId = randomUUID().replaceAll("-", "");
    const institution = await prisma.institution.create({
      data: {
        name: "Placement Automation Integration Test",
        slug: `placement-automation-${runId}`,
      },
      select: { id: true },
    });

    let eventId: string | null = null;
    try {
      const student = await prisma.user.create({
        data: {
          institutionId: institution.id,
          email: `student-${runId}@example.test`,
          idNumber: `PA-${runId}`,
          passwordHash: "integration-test-only-not-a-login-credential",
          firstName: "Placement",
          lastName: "Candidate",
        },
        select: { id: true },
      });
      const studentRole = await prisma.role.create({
        data: { institutionId: institution.id, name: "STUDENT", isSystem: true },
        select: { id: true },
      });
      await prisma.userRole.create({
        data: { userId: student.id, roleId: studentRole.id },
      });

      const opportunity = await prisma.opportunity.create({
        data: {
          institutionId: institution.id,
          title: "Automation Integration Role",
          organization: "Automation Integration Company",
          description: "Isolated PostgreSQL integration-test fixture.",
        },
        select: { id: true },
      });
      const application = await prisma.application.create({
        data: {
          institutionId: institution.id,
          studentId: student.id,
          opportunityId: opportunity.id,
        },
        select: { id: true },
      });

      const event = await prisma.domainEventOutbox.create({
        data: {
          institutionId: institution.id,
          actorId: student.id,
          name: "placement.application.created",
          payload: { applicationId: application.id },
          occurredAt: new Date(),
          createdAt: new Date("2000-01-01T00:00:00.000Z"),
        },
        select: { id: true },
      });
      eventId = event.id;

      // This executes the real PostgreSQL outbox consumer and registered
      // placement notification handler; no mocked API response is involved.
      await drainDomainEventOutbox(1, { institutionId: institution.id });

      const persistedEvent = await prisma.domainEventOutbox.findUnique({
        where: { id: event.id },
        select: { processedAt: true, attempts: true, lastError: true },
      });
      assert.ok(persistedEvent, "Placement outbox row disappeared.");
      assert.ok(persistedEvent.processedAt, persistedEvent.lastError ?? "Placement event was not marked processed.");
      assert.equal(persistedEvent.attempts, 1);

      const dedupeKey = `placement:application:${application.id}:submitted:${student.id}`;
      const notifications = await prisma.notification.findMany({
        where: { institutionId: institution.id, userId: student.id, dedupeKey },
        select: { title: true, body: true, actionUrl: true, readAt: true },
      });
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0].title, "Placement application submitted");
      assert.match(notifications[0].body, /Automation Integration Role/);
      assert.equal(notifications[0].actionUrl, "/student/placements");
      assert.equal(notifications[0].readAt, null);

      // Re-queue the same persisted event to model retry after notification
      // insertion but before an outbox acknowledgement. The unique dedupe key
      // must keep the persistent in-app notification count at one.
      await prisma.domainEventOutbox.update({
        where: { id: event.id },
        data: { processedAt: null, attempts: 0, lastError: null, nextAttemptAt: null },
      });
      await drainDomainEventOutbox(1, { institutionId: institution.id });
      const afterReplay = await prisma.notification.count({
        where: { institutionId: institution.id, userId: student.id, dedupeKey },
      });
      const replayedEvent = await prisma.domainEventOutbox.findUnique({
        where: { id: event.id },
        select: { processedAt: true, attempts: true, lastError: true },
      });
      assert.equal(afterReplay, 1);
      assert.ok(replayedEvent?.processedAt, replayedEvent?.lastError ?? "Replayed event was not acknowledged.");
      assert.equal(replayedEvent.attempts, 1);
    } finally {
      if (eventId) {
        await prisma.domainEventOutbox.deleteMany({ where: { id: eventId } });
      }
      await prisma.domainEventOutbox.deleteMany({ where: { institutionId: institution.id } });
    await prisma.institution.delete({ where: { id: institution.id } });
    }
  },
);
