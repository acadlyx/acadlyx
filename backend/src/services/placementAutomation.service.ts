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
  if (!drive || !["PUBLISHED", "APPLICATION_OPEN"].includes(status)) return [];

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
    } else if (["CLOSED", "APPLICATION_CLOSED"].includes(nextStatus)) {
      const applications = await prisma.application.findMany({
        where: { institutionId, placementDriveId: driveId },
        select: { studentId: true },
      });
      await notifyRecipients({
        institutionId,
        recipientIds: applications.map((application) => application.studentId),
        dedupePrefix: `placement:drive:${driveId}:${nextStatus.toLowerCase()}`,
        title: "Placement drive updated",
        body: nextStatus === "CLOSED" ? "This placement drive has been closed." : "Registration for this placement drive has closed.",
        actionUrl: "/student/placements",
      });
    }
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
      select: { id: true, studentId: true, status: true, role: true, joiningDate: true, company: { select: { name: true } } },
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
          ? `placement:offer:${offer.id}:revised:${offer.joiningDate?.toISOString() ?? "no-joining-date"}`
          : `placement:offer:${offer.id}:status:${offer.status.toLowerCase()}`,
      title: isCreated ? "You received a placement offer" : isUpdated ? "Placement offer revised" : "Placement offer status updated",
      body: isCreated
        ? `${offer.company.name} has issued you an offer for ${offer.role}. Review it in ACADLYX.`
        : isUpdated
          ? `${offer.company.name} revised your offer for ${offer.role}.`
          : `Your offer from ${offer.company.name} is now ${offer.status.replaceAll("_", " ").toLowerCase()}.`,
      actionUrl: "/student/placements",
    });
  }
}

subscribeDomainEvent("*", async (event) => {
  await handlePlacementEvent(event);
});
