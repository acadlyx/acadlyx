import { prisma } from "../lib/prisma";
import { DomainEvent, subscribeDomainEvent } from "./domainEvent.service";

type JsonObject = Record<string, unknown>;

function stringField(payload: JsonObject, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function notifyRecipients(input: {
  institutionId: string;
  recipientIds: string[];
  dedupePrefix: string;
  title: string;
  body: string;
  actionUrl: string;
}) {
  const recipientIds = [...new Set(input.recipientIds.filter(Boolean))];
  if (!recipientIds.length) return;
  await prisma.notification.createMany({
    data: recipientIds.map((userId) => ({
      institutionId: input.institutionId,
      userId,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      priority: "NORMAL",
      dedupeKey: `${input.dedupePrefix}:${userId}`,
    })),
    skipDuplicates: true,
  });
}

/** Resolve the student audience from current active enrollment and authoritative eligibility data. */
async function eligibleStudentIds(institutionId: string, driveId: string, status: string): Promise<string[]> {
  const drive = await prisma.placementDrive.findFirst({
    where: { id: driveId, institutionId },
    select: {
      id: true,
      campusId: true,
      status: true,
      cgpaRequirement: true,
      maxBacklogs: true,
      eligiblePrograms: true,
      eligibleDepartments: true,
      eligibleBatches: true,
      eligibleSemesters: true,
      requiredSkills: true,
      academicRequirements: true,
      opportunityId: true,
    },
  });
  if (!drive || !["PUBLISHED", "APPLICATION_OPEN", "CLOSED", "CANCELLED"].includes(status)) return [];

  const programIds = stringArray(drive.eligiblePrograms);
  const departmentIds = stringArray(drive.eligibleDepartments);
  const batchIds = stringArray(drive.eligibleBatches);
  const semesterIds = stringArray(drive.eligibleSemesters);
  const skillIds = stringArray(drive.requiredSkills);
  const rules = drive.academicRequirements && typeof drive.academicRequirements === "object" && !Array.isArray(drive.academicRequirements)
    ? drive.academicRequirements as JsonObject
    : {};
  const allowAcademicOverride = rules.allowIneligibleStudents === true;

  const users = await prisma.user.findMany({
    where: {
      institutionId,
      userRoles: { some: { role: { name: "STUDENT" } } },
      studentEnrollments: {
        some: {
          institutionId,
          status: "ACTIVE",
          ...(batchIds.length ? { batchId: { in: batchIds } } : {}),
          ...(semesterIds.length ? { semesterId: { in: semesterIds } } : {}),
          program: {
            ...(programIds.length ? { id: { in: programIds } } : {}),
            department: {
              ...(departmentIds.length ? { id: { in: departmentIds } } : {}),
              ...(drive.campusId ? { campusId: drive.campusId } : {}),
            },
          },
        },
      },
    },
    select: {
      id: true,
      placementAcademicSnapshot: { select: { cgpa: true, backlogCount: true, academicStatus: true, graduationEligible: true } },
      studentSkills: {
        where: skillIds.length ? { skillId: { in: skillIds } } : undefined,
        select: { skillId: true },
      },
    },
    orderBy: { id: "asc" },
    take: 10000,
  });

  let ids = users.filter((user) => {
    const academic = user.placementAcademicSnapshot;
    if (!allowAcademicOverride) {
      if (drive.cgpaRequirement != null && (academic?.cgpa == null || academic.cgpa < drive.cgpaRequirement)) return false;
      if (drive.maxBacklogs != null && (academic?.backlogCount == null || academic.backlogCount > drive.maxBacklogs)) return false;
      if (typeof rules.academicStatus === "string" && academic?.academicStatus !== rules.academicStatus) return false;
      if (rules.graduationEligible === true && academic?.graduationEligible !== true) return false;
      if (skillIds.some((skillId) => !user.studentSkills.some((skill) => skill.skillId === skillId))) return false;
    }
    return true;
  }).map((user) => user.id);

  if (status === "APPLICATION_OPEN" && ids.length) {
    const existing = await prisma.application.findMany({
      where: {
        institutionId,
        studentId: { in: ids },
        OR: [
          { placementDriveId: drive.id },
          ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
        ],
      },
      select: { studentId: true },
    });
    const applied = new Set(existing.map((item) => item.studentId));
    ids = ids.filter((id) => !applied.has(id));
  }
  return ids;
}

async function handlePlacementEvent(event: DomainEvent) {
  if (!event.institutionId || !event.name.startsWith("placement.")) return;
  const payload = event.payload as JsonObject;
  const institutionId = event.institutionId;

  if (event.name === "placement.schedule.changed") {
    const eventType = stringField(payload, "eventType");
    const eventId = stringField(payload, "eventId");
    const version = stringField(payload, "version");
    const requestedRecipients = stringArray(payload.recipientIds);
    if (!eventType || !eventId || !version || !["interview", "test", "visit"].includes(eventType)) return;

    let label = "Placement activity";
    let companyName = "your placement team";
    let startsAt: Date | null = null;
    let eventTitle = "Placement activity";
    if (eventType === "interview") {
      const item = await prisma.placementInterview.findFirst({
        where: { id: eventId, institutionId },
        select: { roundType: true, roundNumber: true, startsAt: true, drive: { select: { title: true, company: { select: { name: true } } } } },
      });
      if (!item) return;
      label = "Placement interview";
      companyName = item.drive.company.name;
      eventTitle = `${item.roundType} interview · ${item.drive.title} · Round ${item.roundNumber}`;
      startsAt = item.startsAt;
    } else if (eventType === "test") {
      const item = await prisma.placementTest.findFirst({
        where: { id: eventId, institutionId },
        select: { title: true, scheduledAt: true, drive: { select: { title: true, company: { select: { name: true } } } } },
      });
      if (!item) return;
      label = "Placement assessment";
      companyName = item.drive.company.name;
      eventTitle = item.title || item.drive.title;
      startsAt = item.scheduledAt;
    } else {
      const item = await prisma.placementVisit.findFirst({
        where: { id: eventId, institutionId },
        select: { type: true, startsAt: true, company: { select: { name: true } } },
      });
      if (!item) return;
      label = "Placement activity";
      companyName = item.company.name;
      eventTitle = item.type;
      startsAt = item.startsAt;
    }

    const verifiedRecipients = requestedRecipients.length
      ? await prisma.user.findMany({
          where: {
            institutionId,
            id: { in: [...new Set(requestedRecipients)] },
            userRoles: { some: { role: { name: "STUDENT" } } },
          },
          select: { id: true },
          take: 10000,
        })
      : [];
    const recipientIds = verifiedRecipients.map((item) => item.id);
    const cancelled = version === "cancelled";
    const published = version === "published";
    const rescheduled = version.startsWith("rescheduled:");
    const updated = version.startsWith("updated:");
    const verb = cancelled ? "cancelled" : published ? "published" : rescheduled ? "rescheduled" : updated ? "updated" : "scheduled";
    await notifyRecipients({
      institutionId,
      recipientIds,
      dedupePrefix: `placement:${eventType}:${eventId}:${version}`,
      title: `${label} ${verb}`,
      body: cancelled
        ? `${eventTitle} from ${companyName} has been cancelled.`
        : published
          ? `${eventTitle} from ${companyName} has been published for ${startsAt?.toLocaleString() ?? "the scheduled time"}.`
          : rescheduled
            ? `${eventTitle} from ${companyName} has a new scheduled time: ${startsAt?.toLocaleString() ?? "see ACADLYX for details"}.`
            : updated
              ? `${eventTitle} from ${companyName} was updated. Current scheduled time: ${startsAt?.toLocaleString() ?? "see ACADLYX for details"}.`
              : `${eventTitle} from ${companyName} is scheduled for ${startsAt?.toLocaleString() ?? "the scheduled time"}.`,
      actionUrl: "/student/placements",
    });
    return;
  }

  if (event.name === "placement.drive.status_changed") {
    const driveId = stringField(payload, "driveId");
    const nextStatus = stringField(payload, "to");
    if (!driveId || !nextStatus) return;

    if (nextStatus === "PUBLISHED" || nextStatus === "APPLICATION_OPEN") {
      const drive = await prisma.placementDrive.findFirst({
        where: { id: driveId, institutionId },
        select: { title: true, applicationDeadline: true, company: { select: { name: true } } },
      });
      if (!drive) return;
      const recipients = await eligibleStudentIds(institutionId, driveId, nextStatus);
      await notifyRecipients({
        institutionId,
        recipientIds: recipients,
        dedupePrefix: `placement:drive:${driveId}:${nextStatus.toLowerCase()}`,
        title: nextStatus === "PUBLISHED" ? "New placement drive published" : "Placement registration is open",
        body: nextStatus === "PUBLISHED"
          ? `${drive.company.name}: ${drive.title} is published. Review your eligibility and details.`
          : `${drive.company.name}: registration is open for ${drive.title}${drive.applicationDeadline ? ` until ${drive.applicationDeadline.toLocaleString()}` : ""}.`,
        actionUrl: "/student/placements",
      });
    } else if (["CLOSED", "APPLICATION_CLOSED", "CANCELLED"].includes(nextStatus)) {
      const drive = await prisma.placementDrive.findFirst({
        where: { id: driveId, institutionId },
        select: { opportunityId: true },
      });
      const applications = await prisma.application.findMany({
        where: {
          institutionId,
          OR: [
            { placementDriveId: driveId },
            ...(drive?.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
          ],
        },
        select: { studentId: true },
      });
      const eligible = ["CLOSED", "CANCELLED"].includes(nextStatus)
        ? await eligibleStudentIds(institutionId, driveId, nextStatus)
        : [];
      const recipients = [...new Set([...applications.map((application) => application.studentId), ...eligible])];
      await notifyRecipients({
        institutionId,
        recipientIds: recipients,
        dedupePrefix: `placement:drive:${driveId}:${nextStatus.toLowerCase()}`,
        title: nextStatus === "CANCELLED" ? "Placement drive cancelled" : "Placement drive updated",
        body: nextStatus === "CANCELLED"
          ? "This placement drive has been cancelled. Review your placement dashboard for other opportunities."
          : nextStatus === "CLOSED"
            ? "This placement drive has been closed."
            : "Registration for this placement drive has closed.",
        actionUrl: "/student/placements",
      });
    }
    return;
  }

  if (event.name === "placement.drive.updated") {
    const driveId = stringField(payload, "driveId");
    const version = stringField(payload, "version");
    if (!driveId || !version) return;
    const drive = await prisma.placementDrive.findFirst({
      where: { id: driveId, institutionId },
      select: {
        id: true, title: true, status: true, applicationDeadline: true, driveDate: true,
        opportunityId: true, company: { select: { name: true } },
      },
    });
    if (!drive || !["PUBLISHED", "APPLICATION_OPEN"].includes(drive.status)) return;
    const [eligible, applications] = await Promise.all([
      eligibleStudentIds(institutionId, driveId, drive.status),
      prisma.application.findMany({
        where: {
          institutionId,
          OR: [
            { placementDriveId: driveId },
            ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
          ],
        },
        select: { studentId: true },
      }),
    ]);
    const recipients = [...new Set([...eligible, ...applications.map((application) => application.studentId)])];
    await notifyRecipients({
      institutionId,
      recipientIds: recipients,
      dedupePrefix: `placement:drive:${driveId}:updated:${version}`,
      title: "Placement drive details updated",
      body: `${drive.company.name}: ${drive.title} has updated recruitment details.${drive.applicationDeadline ? ` Registration deadline: ${drive.applicationDeadline.toLocaleString()}.` : ""}${drive.driveDate ? ` Drive date: ${drive.driveDate.toLocaleString()}.` : ""} Review the current details in ACADLYX.`,
      actionUrl: "/student/placements",
    });
    return;
  }

  if (event.name === "placement.application.created") {
    const applicationId = stringField(payload, "applicationId");
    if (!applicationId) return;
    const application = await prisma.application.findFirst({
      where: { id: applicationId, institutionId },
      select: {
        id: true, studentId: true, status: true,
        opportunity: { select: { title: true, organization: true } },
      },
    });
    if (!application) return;
    await notifyRecipients({
      institutionId,
      recipientIds: [application.studentId],
      dedupePrefix: `placement:application:${application.id}:submitted`,
      title: "Placement application submitted",
      body: `Your application for ${application.opportunity.title} at ${application.opportunity.organization} has been recorded.`,
      actionUrl: "/student/placements",
    });
    return;
  }

  if (event.name === "placement.application.status_changed") {
    const applicationId = stringField(payload, "applicationId");
    const nextStatus = stringField(payload, "to");
    if (!applicationId || !nextStatus || nextStatus === "OFFERED") return;
    const application = await prisma.application.findFirst({
      where: { id: applicationId, institutionId },
      select: { id: true, studentId: true, opportunity: { select: { title: true, organization: true } } },
    });
    if (!application) return;
    await notifyRecipients({
      institutionId,
      recipientIds: [application.studentId],
      dedupePrefix: `placement:application:${application.id}:${nextStatus.toLowerCase()}`,
      title: nextStatus === "REJECTED" ? "Placement application update" : "Placement selection update",
      body: `${application.opportunity.organization}: your application for ${application.opportunity.title} is now ${nextStatus.replaceAll("_", " ").toLowerCase()}.`,
      actionUrl: "/student/placements",
    });
    return;
  }

  if (event.name === "placement.offer.created" || event.name === "placement.offer.status_changed" || event.name === "placement.offer.updated") {
    const offerId = stringField(payload, "offerId");
    if (!offerId) return;
    const offer = await prisma.placementOffer.findFirst({
      where: { id: offerId, institutionId },
      select: { id: true, studentId: true, status: true, role: true, joiningDate: true, responseDeadline: true, updatedAt: true, company: { select: { name: true } } },
    });
    if (!offer) return;
    const isCreated = event.name === "placement.offer.created";
    const isUpdated = event.name === "placement.offer.updated";
    await notifyRecipients({
      institutionId,
      recipientIds: [offer.studentId],
      dedupePrefix: isCreated
        ? `placement:offer:${offer.id}:issued`
        : isUpdated
          ? `placement:offer:${offer.id}:revised:${stringField(payload, "version") ?? offer.updatedAt.toISOString()}`
          : `placement:offer:${offer.id}:status:${offer.status.toLowerCase()}`,
      title: isCreated ? "You received a placement offer" : isUpdated ? "Placement offer revised" : "Placement offer status updated",
      body: isCreated
        ? `${offer.company.name} has issued you an offer for ${offer.role}.${offer.responseDeadline ? ` Respond by ${offer.responseDeadline.toLocaleString()}.` : ""} Review it in ACADLYX.`
        : isUpdated
          ? `${offer.company.name} revised your offer for ${offer.role}.${offer.responseDeadline ? ` Respond by ${offer.responseDeadline.toLocaleString()}.` : ""}${offer.joiningDate ? ` Expected joining: ${offer.joiningDate.toLocaleDateString()}.` : ""}`
          : `Your offer from ${offer.company.name} is now ${offer.status.replaceAll("_", " ").toLowerCase()}.`,
      actionUrl: "/student/placements",
    });
  }
}

/**
 * Emit in-app offer response reminders from the running backend process.
 * The anti-join against the notification table means each run selects only
 * offers whose current reminder key has not already been delivered. A bounded
 * batch avoids depending on browser activity and remains safe across replicas.
 */
export async function processPlacementDeadlineReminders(now = new Date()) {
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
  const due = await prisma.$queryRaw<Array<{
    id: string;
    institutionId: string;
    studentId: string;
    responseDeadline: Date;
    role: string;
    companyName: string;
  }>>`
    SELECT
      o."id",
      o."institutionId",
      o."studentId",
      o."responseDeadline",
      o."role",
      c."name" AS "companyName"
    FROM "placement_offers" o
    INNER JOIN "placement_companies" c
      ON c."id" = o."companyId"
     AND c."institutionId" = o."institutionId"
    LEFT JOIN "notifications" n
      ON n."institutionId" = o."institutionId"
     AND n."userId" = o."studentId"
     AND n."dedupeKey" = (
       'placement:offer:' || o."id" || ':' ||
       CASE WHEN o."responseDeadline" <= ${nextHour}
         THEN 'deadline-1h' ELSE 'deadline-24h' END ||
       ':' || o."studentId"
     )
    WHERE o."status" = 'OFFERED'
      AND o."responseDeadline" > ${now}
      AND o."responseDeadline" <= ${next24Hours}
      AND n."id" IS NULL
    ORDER BY o."responseDeadline" ASC, o."id" ASC
    LIMIT 500
  `;

  if (!due.length) return { scanned: 0, created: 0 };
  const notifications = due.map((offer) => {
    const urgent = offer.responseDeadline.getTime() <= nextHour.getTime();
    const deadline = offer.responseDeadline.toISOString().replace("T", " ").replace("Z", " UTC");
    return {
      institutionId: offer.institutionId,
      userId: offer.studentId,
      title: urgent ? "Placement offer deadline in 1 hour" : "Placement offer response due within 24 hours",
      body: `${offer.companyName} is awaiting your response to the offer for ${offer.role}. Respond by ${deadline}.`,
      actionUrl: "/student/placements",
      priority: urgent ? "HIGH" : "NORMAL",
      dedupeKey: `placement:offer:${offer.id}:${urgent ? "deadline-1h" : "deadline-24h"}:${offer.studentId}`,
    };
  });
  const created = await prisma.notification.createMany({ data: notifications, skipDuplicates: true });
  return { scanned: due.length, created: created.count };
}

subscribeDomainEvent("*", async (event) => {
  await handlePlacementEvent(event);
});
