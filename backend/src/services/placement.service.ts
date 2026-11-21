import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertCanViewStudent, getStudentWhereScope, getAuthorizedDepartmentIds, getDirectorCampusIds, getEffectiveWorkspaceRole } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  APPLICATION_SUBMITTED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["TEST", "INTERVIEW", "REJECTED", "WITHDRAWN"],
  TEST: ["INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["SELECTED", "REJECTED", "WITHDRAWN"],
  SELECTED: ["OFFERED", "REJECTED"],
  OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN"],
  JOINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

type PlacementCohortTargeting = {
  campusIds?: string[];
  programIds?: string[];
  departmentIds?: string[];
  batchIds?: string[];
  semesterIds?: string[];
  sectionIds?: string[];
  graduatingYears?: number[];
};

/** Resolve a cohort against active, institution-scoped enrollments. Graduation
 * year is the Batch.completionYear maintained by the institution, not inferred
 * from a user's current semester or from client-supplied student records. */
async function resolvePlacementCohortAudience(institutionId: string, targeting?: PlacementCohortTargeting) {
  if (!targeting) return [];
  const hasFilters = Boolean(
    targeting.campusIds?.length || targeting.programIds?.length ||
    targeting.departmentIds?.length || targeting.batchIds?.length ||
    targeting.semesterIds?.length || targeting.sectionIds?.length ||
    targeting.graduatingYears?.length,
  );
  if (!hasFilters) return [];
  const users = await prisma.user.findMany({
    where: {
      institutionId,
      userRoles: { some: { role: { name: "STUDENT" } } },
      studentEnrollments: {
        some: {
          institutionId,
          status: "ACTIVE",
          ...(targeting.batchIds?.length ? { batchId: { in: targeting.batchIds } } : {}),
          ...(targeting.semesterIds?.length ? { semesterId: { in: targeting.semesterIds } } : {}),
          ...(targeting.sectionIds?.length ? { sectionId: { in: targeting.sectionIds } } : {}),
          ...(targeting.graduatingYears?.length ? { batch: { completionYear: { in: targeting.graduatingYears } } } : {}),
          program: {
            ...(targeting.programIds?.length ? { id: { in: targeting.programIds } } : {}),
            department: {
              ...(targeting.departmentIds?.length ? { id: { in: targeting.departmentIds } } : {}),
              ...(targeting.campusIds?.length ? { campusId: { in: targeting.campusIds } } : {}),
            },
          },
        },
      },
    },
    select: { id: true },
    take: 10000,
  });
  return users.map((user) => user.id);
}

async function assertNoPlacementScheduleConflicts(
  tx: Prisma.TransactionClient,
  institutionId: string,
  studentIds: string[],
  startsAt: Date,
  endsAt: Date,
  ignore?: { interviewId?: string; testId?: string },
) {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (!ids.length) return;
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new AppError("The scheduled end time must be after the start time.", 422);
  }
  const fallbackStart = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const nullEndStart = new Date(startsAt.getTime() - 60 * 60 * 1000);
  const [interviews, tests] = await Promise.all([
    tx.placementInterview.findMany({
      where: {
        institutionId,
        status: "SCHEDULED",
        ...(ignore?.interviewId ? { id: { not: ignore.interviewId } } : {}),
        startsAt: { lt: endsAt },
        OR: [
          { endsAt: { gt: startsAt } },
          { endsAt: null, startsAt: { gt: nullEndStart } },
        ],
        participants: { some: { studentId: { in: ids } } },
      },
      select: {
        id: true, roundType: true, startsAt: true, endsAt: true,
        drive: { select: { title: true, company: { select: { name: true } } } },
        participants: { where: { studentId: { in: ids } }, select: { studentId: true } },
      },
      take: 100,
    }),
    tx.placementTest.findMany({
      where: {
        institutionId,
        status: "SCHEDULED",
        ...(ignore?.testId ? { id: { not: ignore.testId } } : {}),
        scheduledAt: { gte: fallbackStart, lt: endsAt },
        participants: { some: { studentId: { in: ids } } },
      },
      select: {
        id: true, title: true, scheduledAt: true, durationMinutes: true,
        drive: { select: { company: { select: { name: true } } } },
        participants: { where: { studentId: { in: ids } }, select: { studentId: true } },
      },
      take: 100,
    }),
  ]);

  const overlappingTests = tests.filter((item) => {
    const durationMinutes = item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : 60;
    const existingEnd = item.scheduledAt.getTime() + durationMinutes * 60_000;
    return item.scheduledAt.getTime() < endsAt.getTime() && existingEnd > startsAt.getTime();
  });
  if (interviews.length || overlappingTests.length) {
    const labels = [
      ...interviews.slice(0, 3).map((item) => `${item.drive.company.name} · ${item.drive.title} · ${item.roundType} interview`),
      ...overlappingTests.slice(0, 3).map((item) => `${item.drive.company.name} · ${item.title} assessment`),
    ];
    const omitted = interviews.length + overlappingTests.length - labels.length;
    throw new AppError(
      `Schedule conflict detected for one or more selected candidates: ${labels.join("; ")}${omitted > 0 ? `; and ${omitted} additional conflict(s)` : ""}. Change the time or refine the candidate cohort.`,
      409,
    );
  }
}

async function enqueuePlacementEvent(
  tx: Prisma.TransactionClient,
  institutionId: string,
  actorId: string,
  name: string,
  payload: Record<string, unknown>,
) {
  await tx.domainEventOutbox.create({
    data: {
      institutionId,
      actorId,
      name,
      payload: payload as Prisma.InputJsonValue,
      occurredAt: new Date(),
    },
  });
}

async function advanceApplicationsForScheduledRound(
  tx: Prisma.TransactionClient,
  institutionId: string,
  actorId: string,
  driveId: string,
  opportunityId: string | null,
  studentIds: string[],
  targetStatus: "TEST" | "INTERVIEW",
) {
  if (!studentIds.length) return;
  const allowedFrom = targetStatus === "TEST" ? ["SHORTLISTED"] : ["SHORTLISTED", "TEST"];
  const applications = await tx.application.findMany({
    where: {
      institutionId,
      studentId: { in: [...new Set(studentIds)] },
      OR: [
        { placementDriveId: driveId },
        ...(opportunityId ? [{ opportunityId }] : []),
      ],
      status: { in: allowedFrom },
    },
    select: { id: true, status: true },
    orderBy: { id: "asc" },
    take: 10000,
  });
  for (const application of applications) {
    if (!APPLICATION_TRANSITIONS[application.status]?.includes(targetStatus)) continue;
    const changed = await tx.application.updateMany({
      where: { id: application.id, institutionId, status: application.status },
      data: { status: targetStatus },
    });
    if (changed.count !== 1) {
      throw new AppError("A candidate application changed while the recruitment round was being scheduled. Refresh the pipeline and retry.", 409);
    }
    // The assigned round itself produces the student-facing schedule notice.
    // Keep the stage transition in the outbox for auditability without sending
    // a second notification for the same scheduling action.
    await enqueuePlacementEvent(tx, institutionId, actorId, "placement.application.status_changed", {
      applicationId: application.id,
      driveId,
      from: application.status,
      to: targetStatus,
      trigger: "scheduled_round",
    });
  }
}

const PLACEMENT_MANAGER_WORKSPACES = new Set([
  "SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR",
  "DIRECTOR","DEAN","HOD","PLACEMENT",
]);

function activeWorkspace(actor: AuthenticatedUser): string {
  return getEffectiveWorkspaceRole(actor);
}

function isPlacementManager(actor: AuthenticatedUser): boolean {
  return PLACEMENT_MANAGER_WORKSPACES.has(activeWorkspace(actor)) &&
    actor.permissions.includes("placements.manage");
}

function assertInstitution(actor: AuthenticatedUser, institutionId: string): void {
  if (activeWorkspace(actor) === "SUPER_ADMIN") return;
  if (actor.institutionId !== institutionId) throw new AppError("Institution context mismatch.", 403);
}

async function getPlacementStudentScope(institutionId: string, actor: AuthenticatedUser): Promise<Prisma.UserWhereInput> {
  if (["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","PLACEMENT"].includes(activeWorkspace(actor))) return {};
  return getStudentWhereScope(institutionId, actor);
}

async function assertPlacementEntitlement(institutionId: string): Promise<void> {
  const entitlement = await prisma.tenantFeatureEntitlement.findFirst({
    where: { institutionId, featureKey: "placements" },
    select: { isEnabled: true },
  });
  if (entitlement && !entitlement.isEnabled) {
    throw new AppError("Placement is not enabled for this institution.", 403);
  }
}

export async function listOpportunities(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { search?: string; activeOnly?: boolean } = {},
) {
  assertInstitution(actor, institutionId);
  const now = new Date();
  const filters: Prisma.OpportunityWhereInput[] = [
    { institutionId },
    ...(options.activeOnly !== false ? [{ isActive: true }] : []),
  ];
  if (options.search) {
    filters.push({
      OR: [
        { title: { contains: options.search, mode: "insensitive" } },
        { organization: { contains: options.search, mode: "insensitive" } },
      ],
    });
  }
  if (activeWorkspace(actor) === "STUDENT") {
    filters.push(
      { OR: [{ deadline: null }, { deadline: { gte: now } }] },
      // Drives are rendered with their own eligibility and application state.
      // Keep their linked opportunity out of the generic opportunities list.
      { placementDrive: { is: null } },
    );
  }
  return prisma.opportunity.findMany({
    where: { AND: filters },
    include: { targetRole: { select: { id: true, name: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

export async function createOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  input: {
    title: string;
    organization: string;
    description?: string;
    deadline?: string | null;
    targetRoleId?: string | null;
  },
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!input.title.trim() || !input.organization.trim()) {
    throw new AppError("Title and organization are required.", 400);
  }
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) {
    throw new AppError("Opportunity deadline must be in the future.", 400);
  }
  if (input.targetRoleId) {
    const role = await prisma.targetRole.findFirst({ where: { id: input.targetRoleId, institutionId, isActive: true }, select: { id: true } });
    if (!role) throw new AppError("Target role not found.", 404);
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      institutionId,
      title: input.title.trim(),
      organization: input.organization.trim(),
      description: input.description?.trim() || null,
      deadline: input.deadline ? new Date(input.deadline) : null,
      targetRoleId: input.targetRoleId || null,
    },
    include: { targetRole: { select: { id: true, name: true } } },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.opportunity.created",
    entityType: "Opportunity",
    entityId: opportunity.id,
    metadata: { title: opportunity.title, organization: opportunity.organization },
  });
  return opportunity;
}

export async function updateOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: Partial<{
    title: string;
    organization: string;
    description: string | null;
    deadline: string | null;
    isActive: boolean;
    targetRoleId: string | null;
  }>,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.opportunity.findFirst({ where: { id, institutionId } });
  if (!existing) throw new AppError("Placement opportunity not found.", 404);
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) {
    throw new AppError("Opportunity deadline must be in the future.", 400);
  }
  if (input.targetRoleId) {
    const role = await prisma.targetRole.findFirst({
      where: { id: input.targetRoleId, institutionId, isActive: true },
      select: { id: true },
    });
    if (!role) throw new AppError("Target role not found.", 404);
  }
  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      organization: input.organization?.trim(),
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      deadline: input.deadline === undefined ? undefined : input.deadline ? new Date(input.deadline) : null,
      isActive: input.isActive,
      targetRoleId: input.targetRoleId,
    },
    include: { targetRole: { select: { id: true, name: true } } },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.opportunity.updated",
    entityType: "Opportunity",
    entityId: id,
    metadata: { changed: Object.keys(input) },
  });
  return opportunity;
}

export async function applyToOpportunity(
  institutionId: string,
  actor: AuthenticatedUser,
  opportunityId: string,
) {
  assertInstitution(actor, institutionId);
  if (activeWorkspace(actor) !== "STUDENT" || !actor.permissions.includes("placements.apply")) {
    throw new AppError("Student placement application authority is required.", 403);
  }
  await assertCanViewStudent(institutionId, actor, actor.id);

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, institutionId, isActive: true },
    select: { id: true, deadline: true },
  });
  if (!opportunity) throw new AppError("Placement opportunity not found.", 404);
  if (opportunity.deadline && opportunity.deadline.getTime() < Date.now()) {
    throw new AppError("The placement application deadline has passed.", 409);
  }

  try {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: { institutionId, studentId: actor.id, opportunityId },
        include: { opportunity: { select: { id: true, title: true, organization: true } } },
      });
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.application.created", {
        applicationId: created.id,
      });
      return created;
    });
    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "placements.application.created",
      entityType: "Application",
      entityId: application.id,
      metadata: { opportunityId },
    });
    return application;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      throw new AppError("You have already applied to this opportunity.", 409);
    }
    throw error;
  }
}

export async function listApplications(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { opportunityId?: string; studentId?: string } = {},
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement application access is not permitted.", 403);
  const studentId = activeWorkspace(actor) === "STUDENT" ? actor.id : options.studentId;
  if (studentId) await assertCanViewStudent(institutionId, actor, studentId);
  const scopedStudentWhere = studentId ? { id: studentId } : await getPlacementStudentScope(institutionId, actor);

  return prisma.application.findMany({
    where: {
      institutionId,
      ...(options.opportunityId ? { opportunityId: options.opportunityId } : {}),
      student: scopedStudentWhere,
    },
    include: {
      opportunity: { select: { id: true, title: true, organization: true, deadline: true } },
      student: { select: { id: true, firstName: true, lastName: true, email: true, profile: { select: { admissionNumber: true } } } },
    },
    orderBy: { appliedAt: "desc" },
    take: 200,
  });
}

export async function transitionApplication(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  status: string,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const application = await prisma.application.findFirst({ where: { id, institutionId } });
  if (!application) throw new AppError("Placement application not found.", 404);
  await assertCanViewStudent(institutionId, actor, application.studentId);
  const next = status.trim().toUpperCase();
  if (["OFFERED", "ACCEPTED", "JOINED"].includes(next)) {
    throw new AppError("Offer and joining states must be changed through the offer workflow so the authoritative offer record stays consistent.", 409);
  }
  if (!APPLICATION_TRANSITIONS[application.status]?.includes(next)) {
    throw new AppError(`Invalid placement application transition: ${application.status} -> ${next}`, 409);
  }

  // Compare-and-set the current status so concurrent reviewers cannot overwrite
  // a newer decision after both read the same previous state.
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.application.updateMany({
      where: { id, institutionId, status: application.status },
      data: { status: next },
    });
    if (changed.count !== 1) {
      throw new AppError("This application was updated by another user. Refresh and review the latest status.", 409);
    }
    const row = await tx.application.findFirst({
      where: { id, institutionId },
      include: { opportunity: { select: { id: true, title: true, organization: true } } },
    });
    if (!row) throw new AppError("Placement application not found.", 404);
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.application.status_changed", {
      applicationId: id,
      from: application.status,
      to: next,
      driveId: application.placementDriveId,
    });
    return row;
  });
  // Keep candidate schedules in sync with the recruitment pipeline. A student
  // moved into TEST or INTERVIEW is automatically attached to already-scheduled
  // events for that drive; event creation also backfills candidates already at
  // that stage. The unique participant keys make these operations idempotent.
  if (next === "TEST" || next === "INTERVIEW") {
    let driveId = application.placementDriveId;
    if (!driveId) {
      const linkedDrive = await prisma.placementDrive.findFirst({
        where: { institutionId, opportunityId: application.opportunityId },
        select: { id: true },
      });
      driveId = linkedDrive?.id ?? null;
    }
    if (!driveId) {
      const legacyOpportunity = await prisma.opportunity.findFirst({
        where: { id: application.opportunityId, institutionId },
        select: { title: true },
      });
      const legacyDriveId = legacyOpportunity?.title.startsWith("Drive:")
        ? legacyOpportunity.title.slice("Drive:".length)
        : "";
      if (legacyDriveId) {
        const legacyDrive = await prisma.placementDrive.findFirst({
          where: { id: legacyDriveId, institutionId },
          select: { id: true },
        });
        driveId = legacyDrive?.id ?? null;
      }
    }
    if (driveId && next === "TEST") {
      const scheduledTests = await prisma.placementTest.findMany({
        where: { institutionId, driveId, status: "SCHEDULED" },
        select: { id: true, title: true, scheduledAt: true },
      });
      if (scheduledTests.length) {
        const existingParticipants = await prisma.placementTestParticipant.findMany({
          where: { testId: { in: scheduledTests.map((test) => test.id) }, studentId: application.studentId },
          select: { testId: true },
        });
        const alreadyAssigned = new Set(existingParticipants.map((participant) => participant.testId));
        const toAssign = scheduledTests.filter((test) => !alreadyAssigned.has(test.id));
        if (toAssign.length) {
          await prisma.$transaction(async (tx) => {
            await tx.placementTestParticipant.createMany({
              data: toAssign.map((test) => ({ testId: test.id, studentId: application.studentId })),
              skipDuplicates: true,
            });
            for (const test of toAssign) {
              await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
                eventType: "test", eventId: test.id, version: "assigned", recipientIds: [application.studentId],
              });
            }
          });
        }
      }
    }
    if (driveId && next === "INTERVIEW") {
      const scheduledInterviews = await prisma.placementInterview.findMany({
        where: { institutionId, driveId, status: "SCHEDULED" },
        select: { id: true, roundType: true, startsAt: true },
      });
      if (scheduledInterviews.length) {
        const existingParticipants = await prisma.placementInterviewParticipant.findMany({
          where: { interviewId: { in: scheduledInterviews.map((interview) => interview.id) }, studentId: application.studentId },
          select: { interviewId: true },
        });
        const alreadyAssigned = new Set(existingParticipants.map((participant) => participant.interviewId));
        const toAssign = scheduledInterviews.filter((interview) => !alreadyAssigned.has(interview.id));
        if (toAssign.length) {
          await prisma.$transaction(async (tx) => {
            await tx.placementInterviewParticipant.createMany({
              data: toAssign.map((interview) => ({ interviewId: interview.id, studentId: application.studentId })),
              skipDuplicates: true,
            });
            for (const interview of toAssign) {
              await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
                eventType: "interview", eventId: interview.id, version: "assigned", recipientIds: [application.studentId],
              });
            }
          });
        }
      }
    }
  }

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.application.status_changed",
    entityType: "Application",
    entityId: id,
    metadata: { from: application.status, to: next, opportunityId: application.opportunityId },
  });
  return updated;
}


export async function bulkTransitionApplications(
  institutionId: string,
  actor: AuthenticatedUser,
  ids: string[],
  status: string,
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const uniqueIds = [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))];
  if (uniqueIds.length !== ids.length) {
    throw new AppError("Bulk application IDs must be non-empty and unique.", 422);
  }
  if (uniqueIds.length < 1 || uniqueIds.length > 100) {
    throw new AppError("Choose between 1 and 100 applications for a bulk update.", 422);
  }
  const next = status.trim().toUpperCase();
  if (!["SHORTLISTED", "TEST", "INTERVIEW", "SELECTED", "REJECTED", "WITHDRAWN"].includes(next)) {
    throw new AppError("Bulk updates support shortlist, assessment, interview, selection, rejection, and withdrawal only. Offer and joining states must use the offer workflow.", 422);
  }
  const updated: Array<{ id: string; status: string }> = [];
  const failed: Array<{ id: string; message: string }> = [];
  // Process sequentially with per-record compare-and-set transactions. This
  // keeps database concurrency bounded and deliberately returns partial
  // results rather than rolling back unrelated, valid decisions.
  for (const id of uniqueIds) {
    try {
      const item = await transitionApplication(institutionId, actor, id, next);
      updated.push({ id: item.id, status: item.status });
    } catch (error) {
      failed.push({
        id,
        message: error instanceof Error ? error.message : "Application update failed.",
      });
    }
  }
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.applications.bulk_status_changed",
    entityType: "PlacementApplicationBatch",
    entityId: uniqueIds.join(",").slice(0, 200),
    metadata: {
      requested: uniqueIds.length,
      updated: updated.length,
      failed: failed.length,
      targetStatus: next,
    },
  });
  return { requested: uniqueIds.length, updated, failed };
}

export async function placementMetrics(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) {
    throw new AppError("Placement intelligence access is not permitted.", 403);
  }

  const directorScope = activeWorkspace(actor) === "DIRECTOR";
  const directorCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && directorCampusIds.length === 0) throw new AppError("No campus scope is assigned to this director", 403);
  const scopedDriveWhere: Prisma.PlacementDriveWhereInput = { institutionId, ...(directorScope ? { campusId: { in: directorCampusIds } } : {}) };
  const scopedCompanyWhere: Prisma.PlacementCompanyWhereInput = { institutionId, ...(directorScope ? { drives: { some: { campusId: { in: directorCampusIds } } } } : {}) };
  const studentWhere: Prisma.UserWhereInput = await getPlacementStudentScope(institutionId, actor);
  const studentBaseWhere: Prisma.UserWhereInput = {
    AND: [
      studentWhere,
      { userRoles: { some: { role: { name: "STUDENT" } } } },
      { studentEnrollments: { some: { institutionId, status: "ACTIVE" } } },
    ],
  };
  const applicationWhere: Prisma.ApplicationWhereInput = { institutionId, student: studentWhere };
  const offerWhere: Prisma.PlacementOfferWhereInput = { institutionId, student: studentWhere };

  const [
    drives,
    openDrives,
    applications,
    statusRows,
    offers,
    acceptedOffers,
    joinedOfferStudents,
    packageStats,
    companies,
    eligibleStudents,
  ] = await Promise.all([
    prisma.placementDrive.count({ where: scopedDriveWhere }),
    prisma.placementDrive.count({ where: { ...scopedDriveWhere, status: { in: ["PUBLISHED","APPLICATION_OPEN","SHORTLISTING","TEST","INTERVIEW"] } } }),
    prisma.application.count({ where: applicationWhere }),
    prisma.application.groupBy({ by: ["status"], where: applicationWhere, _count: { _all: true } }),
    prisma.placementOffer.count({ where: offerWhere }),
    prisma.placementOffer.count({ where: { ...offerWhere, status: "ACCEPTED" } }),
    prisma.placementOffer.groupBy({
      by: ["studentId"],
      where: { ...offerWhere, status: "JOINED" },
    }),
    prisma.placementOffer.aggregate({ where: offerWhere, _avg: { totalCtc: true }, _max: { totalCtc: true }, _min: { totalCtc: true } }),
    prisma.placementCompany.count({ where: scopedCompanyWhere }),
    prisma.user.count({ where: { institutionId, ...studentBaseWhere } }),
  ]);

  const status = Object.fromEntries(statusRows.map((row) => [row.status, row._count._all]));
  // Placement rate counts distinct students, not offers: one student may receive
  // multiple offers but must contribute only once to the placed-student total.
  const joinedOffers = joinedOfferStudents.length;
  const placedStudents = joinedOffers;
  return {
    drives, openDrives, companies, applications, offers, acceptedOffers, joinedOffers, placedStudents,
    eligibleStudents,
    unplacedStudents: Math.max(eligibleStudents - placedStudents, 0),
    status,
    placementRate: eligibleStudents ? Math.round((placedStudents / eligibleStudents) * 1000) / 10 : 0,
    applicationSuccessRate: applications ? Math.round(((status.SELECTED ?? 0) + (status.OFFERED ?? 0) + (status.ACCEPTED ?? 0) + (status.JOINED ?? 0)) / applications * 1000) / 10 : 0,
    offerAcceptanceRate: offers ? Math.round((acceptedOffers / offers) * 1000) / 10 : 0,
    joiningRate: acceptedOffers ? Math.round((joinedOffers / acceptedOffers) * 1000) / 10 : 0,
    averagePackage: packageStats._avg.totalCtc ? Number(packageStats._avg.totalCtc) : 0,
    highestPackage: packageStats._max.totalCtc ? Number(packageStats._max.totalCtc) : 0,
    lowestPackage: packageStats._min.totalCtc ? Number(packageStats._min.totalCtc) : 0,
  };
}

export async function listPlacementCompanies(institutionId: string, actor: AuthenticatedUser, search?: string) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const directorScope = activeWorkspace(actor) === "DIRECTOR";
  const directorCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && directorCampusIds.length === 0) throw new AppError("No campus scope is assigned to this director", 403);
  const where = { institutionId, ...(directorScope ? { drives: { some: { campusId: { in: directorCampusIds } } } } : {}), ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}) };
  if (isPlacementManager(actor)) {
    return prisma.placementCompany.findMany({
      where,
      include: { contacts: true, history: true },
      orderBy: { name: "asc" },
      take: 100,
    });
  }
  return prisma.placementCompany.findMany({
    where,
    select: {
      id: true,
      name: true,
      logoUrl: true,
      industry: true,
      companyType: true,
      website: true,
      description: true,
      headquarters: true,
      relationshipStatus: true,
    },
    orderBy: { name: "asc" },
    take: 100,
  });
}

export async function createPlacementCompany(institutionId: string, actor: AuthenticatedUser, input: {
  name: string; logoUrl?: string; industry?: string; companyType?: string; website?: string; description?: string; headquarters?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const name = input.name.trim();
  if (name.length < 2) throw new AppError("Company name is required.", 400);
  const company = await prisma.placementCompany.create({
    data: { institutionId, name, logoUrl: input.logoUrl || null, industry: input.industry || null, companyType: input.companyType || null, website: input.website || null, description: input.description || null, headquarters: input.headquarters || null, createdById: actor.id },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.company.created", entityType: "PlacementCompany", entityId: company.id, metadata: { name } });
  return company;
}


export async function updatePlacementCompany(institutionId: string, actor: AuthenticatedUser, id: string, input: {
  name?: string; logoUrl?: string | null; industry?: string | null; companyType?: string | null;
  website?: string | null; description?: string | null; headquarters?: string | null;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!(await prisma.placementCompany.findFirst({ where: { id, institutionId }, select: { id: true } }))) throw new AppError("Company not found in this institution.", 404);
  if (input.name !== undefined && input.name.trim().length < 2) throw new AppError("Company name must contain at least two characters.", 400);
  const updated = await prisma.placementCompany.update({ where: { id }, data: {
    name: input.name?.trim(), logoUrl: input.logoUrl, industry: input.industry, companyType: input.companyType,
    website: input.website, description: input.description, headquarters: input.headquarters,
  }});
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.company.updated", entityType: "PlacementCompany", entityId: id, metadata: { fields: Object.keys(input) } });
  return updated;
}

export async function listPlacementDrives(institutionId: string, actor: AuthenticatedUser, options: { status?: string; search?: string; page?: number; pageSize?: number } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const directorScope = activeWorkspace(actor) === "DIRECTOR";
  const directorCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && directorCampusIds.length === 0) throw new AppError("No campus scope is assigned to this director", 403);
  const scopedDepartmentIds = ["DEAN","HOD","FACULTY","DIRECTOR"].includes(activeWorkspace(actor)) ? await getAuthorizedDepartmentIds(institutionId, actor) : null;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const rows = await prisma.placementDrive.findMany({
    where: {
      institutionId,
      ...(directorScope ? { campusId: { in: directorCampusIds } } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.search ? { OR: [{ title: { contains: options.search, mode: "insensitive" } }, { company: { name: { contains: options.search, mode: "insensitive" } } }] } : {}),
      ...(activeWorkspace(actor) === "STUDENT" ? { status: { in: ["PUBLISHED","APPLICATION_OPEN","APPLICATION_CLOSED","SHORTLISTING","TEST","INTERVIEW","OFFERED"] } } : {}),
    },
    include: { company: { select: { id: true, name: true, logoUrl: true } }, opening: true },
    orderBy: [{ driveDate: "asc" }, { createdAt: "desc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  if (activeWorkspace(actor) === "STUDENT") {
    return Promise.all(rows.map(async (row) => ({
      ...row,
      eligibility: await checkDriveEligibility(institutionId, actor, row.id),
    })));
  }
  if (!scopedDepartmentIds) return rows;
  if (!scopedDepartmentIds.length) return [];
  const allowed = new Set(scopedDepartmentIds);
  const campuses = new Set(directorCampusIds);
  return rows.filter((row) => {
    const ids = Array.isArray(row.eligibleDepartments)
      ? row.eligibleDepartments.filter((id): id is string => typeof id === "string")
      : [];
    if (directorScope) {
      const campusMatch = Boolean(row.campusId && campuses.has(row.campusId));
      const departmentMatch = ids.length > 0 && ids.some((id) => allowed.has(id));
      return campusMatch || departmentMatch;
    }
    return ids.length === 0 || ids.some((id) => allowed.has(id));
  });
}

export async function createPlacementDrive(institutionId: string, actor: AuthenticatedUser, input: {
  companyId: string; title: string; openingId?: string; campusId?: string; applicationDeadline?: string; driveDate?: string;
  venue?: string; onlineLink?: string; cgpaRequirement?: number; maxBacklogs?: number; vacancies?: number;
  eligiblePrograms?: string[]; eligibleDepartments?: string[]; eligibleBatches?: string[]; eligibleSemesters?: string[]; requiredSkills?: string[];
  academicRequirements?: Record<string, unknown>;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true, name: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  if (input.openingId && !(await prisma.placementOpening.findFirst({ where: { id: input.openingId, institutionId, companyId: input.companyId }, select: { id: true } }))) {
    throw new AppError("Opening does not belong to the selected company.", 422);
  }
  if (input.campusId) {
    const campus = await prisma.campus.findFirst({ where: { id: input.campusId, institutionId, isActive: true }, select: { id: true } });
    if (!campus) throw new AppError("Campus must belong to this institution and be active.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const assignedCampusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!input.campusId || !assignedCampusIds.includes(input.campusId)) {
      throw new AppError("Directors may create drives only for an assigned campus.", 403);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const allowedDepartmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    if (!input.eligibleDepartments?.length || input.eligibleDepartments.some((id) => !allowedDepartmentIds.includes(id))) {
      throw new AppError("Academic workspaces may create drives only for explicitly assigned departments.", 403);
    }
  }
  const [programs, departments, batches, semesters, skills] = await Promise.all([
    input.eligiblePrograms?.length ? prisma.program.findMany({ where: { institutionId, id: { in: input.eligiblePrograms }, isActive: true }, select: { id: true } }) : [],
    input.eligibleDepartments?.length ? prisma.department.findMany({ where: { institutionId, id: { in: input.eligibleDepartments }, isActive: true }, select: { id: true } }) : [],
    input.eligibleBatches?.length ? prisma.batch.findMany({ where: { institutionId, id: { in: input.eligibleBatches }, isActive: true }, select: { id: true } }) : [],
    input.eligibleSemesters?.length ? prisma.semester.findMany({ where: { institutionId, id: { in: input.eligibleSemesters }, isActive: true }, select: { id: true } }) : [],
    input.requiredSkills?.length ? prisma.skill.findMany({ where: { institutionId, id: { in: input.requiredSkills }, isActive: true }, select: { id: true } }) : [],
  ]);
  if (programs.length !== (input.eligiblePrograms?.length ?? 0)
    || departments.length !== (input.eligibleDepartments?.length ?? 0)
    || batches.length !== (input.eligibleBatches?.length ?? 0)
    || semesters.length !== (input.eligibleSemesters?.length ?? 0)
    || skills.length !== (input.requiredSkills?.length ?? 0)) {
    throw new AppError("Eligibility criteria must reference active records in this institution.", 422);
  }
  const drive = await prisma.$transaction(async (tx) => {
    const opportunity = await tx.opportunity.create({
      data: {
        institutionId,
        title: input.title.trim(),
        organization: company.name,
        description: "Placement Drive",
        deadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null,
      },
      select: { id: true },
    });
    return tx.placementDrive.create({
      data: {
        institutionId,
        companyId: input.companyId,
        title: input.title.trim(),
        opportunityId: opportunity.id,
        openingId: input.openingId || null,
        campusId: input.campusId || null,
        applicationDeadline: input.applicationDeadline ? new Date(input.applicationDeadline) : null,
        driveDate: input.driveDate ? new Date(input.driveDate) : null,
        venue: input.venue || null,
        onlineLink: input.onlineLink || null,
        cgpaRequirement: input.cgpaRequirement,
        maxBacklogs: input.maxBacklogs,
        vacancies: input.vacancies,
        eligiblePrograms: input.eligiblePrograms ?? undefined,
        eligibleDepartments: input.eligibleDepartments ?? undefined,
        eligibleBatches: input.eligibleBatches ?? undefined,
        eligibleSemesters: input.eligibleSemesters ?? undefined,
        requiredSkills: input.requiredSkills ?? undefined,
        academicRequirements: input.academicRequirements ? input.academicRequirements as unknown as Prisma.InputJsonValue : undefined,
      },
      include: { company: true, opening: true, opportunity: true },
    });
  });
  await prisma.placementCompanyHistory.upsert({
    where: { institutionId_companyId: { institutionId, companyId: drive.companyId } },
    create: { institutionId, companyId: drive.companyId, driveCount: 1, lastInteractionAt: new Date() },
    update: { driveCount: { increment: 1 }, lastInteractionAt: new Date() },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.drive.created", entityType: "PlacementDrive", entityId: drive.id, metadata: { title: drive.title, companyId: drive.companyId } });
  return drive;
}


export async function updatePlacementDrive(institutionId: string, actor: AuthenticatedUser, id: string, input: {
  companyId?: string; title?: string; openingId?: string | null; campusId?: string | null;
  applicationDeadline?: string | null; driveDate?: string | null; venue?: string | null; onlineLink?: string | null;
  cgpaRequirement?: number | null; maxBacklogs?: number | null; vacancies?: number | null;
  eligiblePrograms?: string[]; eligibleDepartments?: string[]; eligibleBatches?: string[];
  eligibleSemesters?: string[]; requiredSkills?: string[]; academicRequirements?: Record<string, unknown>;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const current = await prisma.placementDrive.findFirst({ where: { id, institutionId } });
  if (!current) throw new AppError("Placement drive not found.", 404);
  const companyId = input.companyId ?? current.companyId;
  const company = await prisma.placementCompany.findFirst({ where: { id: companyId, institutionId }, select: { id: true, name: true } });
  if (!company) throw new AppError("Company must belong to this institution.", 422);
  const openingId = input.openingId === undefined ? current.openingId : input.openingId;
  if (openingId && !(await prisma.placementOpening.findFirst({ where: { id: openingId, institutionId, companyId }, select: { id: true } }))) {
    throw new AppError("Opening must belong to the selected company and institution.", 422);
  }
  const campusId = input.campusId === undefined ? current.campusId : input.campusId;
  if (campusId && !(await prisma.campus.findFirst({ where: { id: campusId, institutionId, isActive: true }, select: { id: true } }))) {
    throw new AppError("Campus must belong to this institution and be active.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const assigned = await getDirectorCampusIds(institutionId, actor.id);
    if (!campusId || !assigned.includes(campusId)) throw new AppError("Directors may edit drives only for an assigned campus.", 403);
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const allowedDepartmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const currentDepartments = Array.isArray(current.eligibleDepartments)
      ? current.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    const requestedDepartments = input.eligibleDepartments === undefined ? currentDepartments : input.eligibleDepartments;
    if (!requestedDepartments.length || requestedDepartments.some((departmentId) => !allowedDepartmentIds.includes(departmentId))) {
      throw new AppError("Academic workspaces may edit drives only for explicitly assigned departments.", 403);
    }
  }
  const checks = [
    { values: input.eligiblePrograms, find: () => prisma.program.findMany({ where: { institutionId, id: { in: input.eligiblePrograms ?? [] }, isActive: true }, select: { id: true } }) },
    { values: input.eligibleDepartments, find: () => prisma.department.findMany({ where: { institutionId, id: { in: input.eligibleDepartments ?? [] }, isActive: true }, select: { id: true } }) },
    { values: input.eligibleBatches, find: () => prisma.batch.findMany({ where: { institutionId, id: { in: input.eligibleBatches ?? [] }, isActive: true }, select: { id: true } }) },
    { values: input.eligibleSemesters, find: () => prisma.semester.findMany({ where: { institutionId, id: { in: input.eligibleSemesters ?? [] }, isActive: true }, select: { id: true } }) },
    { values: input.requiredSkills, find: () => prisma.skill.findMany({ where: { institutionId, id: { in: input.requiredSkills ?? [] }, isActive: true }, select: { id: true } }) },
  ];
  for (const check of checks) {
    if (check.values !== undefined && check.values.length) {
      const found = await check.find();
      if (found.length !== check.values.length) throw new AppError("Eligibility criteria must reference active records in this institution.", 422);
    }
  }
  const previousRules = current.academicRequirements && typeof current.academicRequirements === "object" && !Array.isArray(current.academicRequirements)
    ? current.academicRequirements as Record<string, unknown> : {};
  const rules = input.academicRequirements === undefined ? undefined : { ...previousRules, ...input.academicRequirements };
  const updated = await prisma.$transaction(async (tx) => {
    const drive = await tx.placementDrive.update({
      where: { id },
      data: {
        companyId: input.companyId,
        title: input.title?.trim(),
        openingId: input.openingId === undefined ? undefined : openingId,
        campusId: input.campusId === undefined ? undefined : campusId,
        applicationDeadline: input.applicationDeadline === undefined ? undefined : input.applicationDeadline ? new Date(input.applicationDeadline) : null,
        driveDate: input.driveDate === undefined ? undefined : input.driveDate ? new Date(input.driveDate) : null,
        venue: input.venue,
        onlineLink: input.onlineLink,
        cgpaRequirement: input.cgpaRequirement,
        maxBacklogs: input.maxBacklogs,
        vacancies: input.vacancies,
        eligiblePrograms: input.eligiblePrograms as Prisma.InputJsonValue | undefined,
        eligibleDepartments: input.eligibleDepartments as Prisma.InputJsonValue | undefined,
        eligibleBatches: input.eligibleBatches as Prisma.InputJsonValue | undefined,
        eligibleSemesters: input.eligibleSemesters as Prisma.InputJsonValue | undefined,
        requiredSkills: input.requiredSkills as Prisma.InputJsonValue | undefined,
        academicRequirements: rules as Prisma.InputJsonValue | undefined,
      },
      include: { company: true, opening: true, opportunity: true },
    });
    if (drive.opportunityId) await tx.opportunity.updateMany({ where: { id: drive.opportunityId, institutionId }, data: { title: drive.title, organization: company.name, deadline: drive.applicationDeadline } });
    const notificationRelevantFields = [
      "companyId", "title", "openingId", "campusId", "applicationDeadline", "driveDate",
      "venue", "onlineLink", "cgpaRequirement", "maxBacklogs", "vacancies",
      "eligiblePrograms", "eligibleDepartments", "eligibleBatches", "eligibleSemesters",
      "requiredSkills", "academicRequirements",
    ];
    if (drive.status !== "DRAFT" && Object.keys(input).some((field) => notificationRelevantFields.includes(field))) {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.drive.updated", {
        driveId: drive.id,
        version: drive.updatedAt.toISOString(),
        fields: Object.keys(input),
      });
    }
    return drive;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.drive.updated", entityType: "PlacementDrive", entityId: id, metadata: { fields: Object.keys(input) } });
  return updated;
}

const DRIVE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["APPLICATION_OPEN", "CLOSED", "CANCELLED"],
  APPLICATION_OPEN: ["APPLICATION_CLOSED", "CLOSED", "CANCELLED"],
  APPLICATION_CLOSED: ["SHORTLISTING", "CLOSED", "CANCELLED"],
  SHORTLISTING: ["TEST", "INTERVIEW", "CLOSED", "CANCELLED"],
  TEST: ["INTERVIEW", "OFFERED", "CLOSED", "CANCELLED"],
  INTERVIEW: ["OFFERED", "CLOSED", "CANCELLED"],
  OFFERED: ["ACCEPTED", "CLOSED", "CANCELLED"],
  ACCEPTED: ["JOINED", "CLOSED", "CANCELLED"],
  JOINED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
};

export async function transitionPlacementDrive(institutionId: string, actor: AuthenticatedUser, id: string, status: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({ where: { id, institutionId } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (activeWorkspace(actor) === "DIRECTOR") {
    const assignedCampusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!drive.campusId || !assignedCampusIds.includes(drive.campusId)) {
      throw new AppError("Placement drive not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const allowedDepartmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const driveDepartmentIds = Array.isArray(drive.eligibleDepartments)
      ? drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!driveDepartmentIds.length || !driveDepartmentIds.some((departmentId) => allowedDepartmentIds.includes(departmentId))) {
      throw new AppError("Placement drive not found in the authorised department scope.", 404);
    }
  }
  const next = status.toUpperCase();
  if (!DRIVE_TRANSITIONS[drive.status]?.includes(next)) throw new AppError(`Invalid placement drive transition: ${drive.status} -> ${next}`, 409);
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.placementDrive.updateMany({
      where: { id, institutionId, status: drive.status },
      data: { status: next },
    });
    if (changed.count !== 1) {
      throw new AppError("This drive was updated by another user. Refresh before changing its status.", 409);
    }
    const row = await tx.placementDrive.findFirst({ where: { id, institutionId } });
    if (!row) throw new AppError("Placement drive not found.", 404);
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.drive.status_changed", {
      driveId: id,
      from: drive.status,
      to: next,
    });
    return row;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.drive.status_changed", entityType: "PlacementDrive", entityId: id, metadata: { from: drive.status, to: next } });
  return updated;
}

export async function checkDriveEligibility(institutionId: string, actor: AuthenticatedUser, driveId: string, studentId?: string) {
  assertInstitution(actor, institutionId);
  let target = activeWorkspace(actor) === "STUDENT" ? actor.id : studentId;
  if (activeWorkspace(actor) === "PARENT" && !target) {
    const link = await prisma.parentStudentLink.findFirst({ where: { institutionId, parentId: actor.id }, select: { studentId: true } });
    target = link?.studentId;
  }
  if (!target) throw new AppError("Student scope is required.", 400);
  await assertCanViewStudent(institutionId, actor, target);
  const [drive, enrollment, academic, existingApplication] = await Promise.all([
    prisma.placementDrive.findFirst({ where: { id: driveId, institutionId }, select: { id: true, campusId: true, status: true, applicationDeadline: true, cgpaRequirement: true, maxBacklogs: true, eligiblePrograms: true, eligibleDepartments: true, eligibleBatches: true, eligibleSemesters: true, requiredSkills: true, academicRequirements: true } }),
    prisma.studentEnrollment.findFirst({ where: { institutionId, userId: target, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, select: { programId: true, batchId: true, semesterId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } } }),
    prisma.placementAcademicSnapshot.findFirst({ where: { institutionId, studentId: target } }),
    prisma.application.findFirst({ where: { institutionId, studentId: target, placementDriveId: driveId }, select: { id: true } }),
  ]);
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (!enrollment) return { eligible: false, reasons: ["No active academic enrollment found."] };
  const reasons: string[] = [];
  const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  if (drive.campusId && enrollment.program.department.campusId !== drive.campusId) reasons.push("This drive is restricted to a different campus.");
  if (existingApplication) reasons.push("You have already applied to this drive.");
  if (drive.status !== "APPLICATION_OPEN") reasons.push("Applications are not open for this drive.");
  if (drive.applicationDeadline && drive.applicationDeadline.getTime() < Date.now()) reasons.push("The application deadline has passed.");
  if (list(drive.eligiblePrograms).length && !list(drive.eligiblePrograms).includes(enrollment.programId)) reasons.push("Program is not eligible.");
  if (list(drive.eligibleDepartments).length && !list(drive.eligibleDepartments).includes(enrollment.program.departmentId)) reasons.push("Department is not eligible.");
  if (list(drive.eligibleBatches).length && (!enrollment.batchId || !list(drive.eligibleBatches).includes(enrollment.batchId))) reasons.push("Batch is not eligible.");
  if (list(drive.eligibleSemesters).length && (!enrollment.semesterId || !list(drive.eligibleSemesters).includes(enrollment.semesterId))) reasons.push("Semester is not eligible.");
  if (drive.cgpaRequirement != null) {
    if (academic?.cgpa == null) reasons.push("Authoritative CGPA is not available for this student.");
    else if (academic.cgpa < drive.cgpaRequirement) reasons.push("CGPA does not meet the drive requirement.");
  }
  if (drive.maxBacklogs != null) {
    if (academic?.backlogCount == null) reasons.push("Authoritative backlog count is not available for this student.");
    else if (academic.backlogCount > drive.maxBacklogs) reasons.push("Backlog count exceeds the drive limit.");
  }
  const academicRules = drive.academicRequirements && typeof drive.academicRequirements === "object" && !Array.isArray(drive.academicRequirements)
    ? drive.academicRequirements as Record<string, unknown>
    : {};
  if (typeof academicRules.academicStatus === "string" && academic?.academicStatus !== academicRules.academicStatus) reasons.push("Academic status is not eligible.");
  if (academicRules.graduationEligible === true && academic?.graduationEligible !== true) reasons.push("Graduation eligibility is not confirmed.");


  const requiredSkillIds = list(drive.requiredSkills);
  if (requiredSkillIds.length) {
    const skillRows = await prisma.studentSkill.findMany({
      where: { institutionId, studentId: target, skillId: { in: requiredSkillIds } },
      select: { skillId: true },
    });
    const owned = new Set(skillRows.map((row) => row.skillId));
    const missingSkills = requiredSkillIds.filter((skillId) => !owned.has(skillId));
    if (missingSkills.length) reasons.push("Required placement skills are missing from the student profile.");
  }

  const allowIneligibleStudents = academicRules.allowIneligibleStudents === true;
  const nonOverrideableReasons = reasons.filter((reason) =>
    reason.startsWith("This drive is restricted") ||
    reason.startsWith("You have already applied") ||
    reason.startsWith("Applications are not open") ||
    reason.startsWith("The application deadline has passed")
  );
  const effectiveReasons = allowIneligibleStudents ? nonOverrideableReasons : reasons;
  return {
    eligible: effectiveReasons.length === 0,
    reasons,
    studentId: target,
    overrideApplied: allowIneligibleStudents && reasons.length > nonOverrideableReasons.length,
  };
}

export async function applyToDrive(institutionId: string, actor: AuthenticatedUser, driveId: string) {
  assertInstitution(actor, institutionId);
  if (activeWorkspace(actor) !== "STUDENT" || !actor.permissions.includes("placements.apply")) {
    throw new AppError("Student placement application authority is required.", 403);
  }

  const eligibility = await checkDriveEligibility(institutionId, actor, driveId);
  if (!eligibility.eligible) throw new AppError(eligibility.reasons.join(" "), 409);

  const drive = await prisma.placementDrive.findFirst({
    where: { id: driveId, institutionId },
    select: { id: true, openingId: true, companyId: true, opportunityId: true, applicationDeadline: true },
  });
  if (!drive) throw new AppError("Placement drive not found.", 404);

  const existing = await prisma.application.findFirst({
    where: { institutionId, studentId: actor.id, placementDriveId: drive.id },
    select: { id: true },
  });
  if (existing) throw new AppError("You have already applied to this placement drive.", 409);

  let opportunityId: string;
  const canonicalDrive = drive.opportunityId;
  const legacyOpportunity = canonicalDrive ? null : await prisma.opportunity.findFirst({
    where: { institutionId, title: "Drive:" + drive.id },
    select: { id: true },
  });

  if (canonicalDrive) {
    opportunityId = canonicalDrive;
  } else if (legacyOpportunity) {
    opportunityId = legacyOpportunity.id;
  } else {
    const company = await prisma.placementCompany.findFirst({
      where: { id: drive.companyId, institutionId },
      select: { name: true },
    });
    const driveRecord = await prisma.placementDrive.findUnique({
      where: { id: drive.id },
      select: { title: true },
    });
    if (!company || !driveRecord) throw new AppError("Placement drive not found.", 404);

    const opportunity = await prisma.opportunity.create({
      data: {
        institutionId,
        title: "Drive:" + drive.id,
        organization: company.name,
        description: driveRecord.title,
        deadline: drive.applicationDeadline,
      },
      select: { id: true },
    });
    opportunityId = opportunity.id;
  }

  try {
    const application = await prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: {
          institutionId,
          studentId: actor.id,
          opportunityId,
          placementDriveId: drive.id,
          placementOpeningId: drive.openingId,
          status: "APPLICATION_SUBMITTED",
        },
        include: {
          opportunity: { select: { id: true, title: true, organization: true, deadline: true } },
        },
      });
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.application.created", {
        applicationId: created.id,
        driveId: drive.id,
      });
      return created;
    });
    await recordAuditLog({
      institutionId,
      userId: actor.id,
      action: "placements.application.created",
      entityType: "Application",
      entityId: application.id,
      metadata: { driveId: drive.id, openingId: drive.openingId },
    });
    return application;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("You have already applied to this placement drive.", 409);
    }
    throw error;
  }
}

export async function placementProfile(institutionId: string, actor: AuthenticatedUser, studentId?: string) {
  assertInstitution(actor, institutionId);
  let target = activeWorkspace(actor) === "STUDENT" ? actor.id : studentId;
  if (activeWorkspace(actor) === "PARENT" && !target) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { institutionId, parentId: actor.id },
      select: { studentId: true },
    });
    target = link?.studentId;
  }
  if (!target) throw new AppError("Student scope is required.", 400);
  await assertCanViewStudent(institutionId, actor, target);
  const [profile, enrollment, skills, certifications, projects, resumes] = await Promise.all([
    prisma.placementProfile.findUnique({ where: { studentId: target } }),
    prisma.studentEnrollment.findFirst({ where: { institutionId, userId: target, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, include: { program: { include: { department: true } }, batch: true, semester: true, academicYear: true, section: true } }),
    prisma.studentSkill.findMany({ where: { institutionId, studentId: target }, include: { skill: true }, orderBy: { updatedAt: "desc" } }),
    prisma.placementCertification.findMany({ where: { institutionId, studentId: target }, orderBy: { createdAt: "desc" } }),
    prisma.placementProject.findMany({ where: { institutionId, studentId: target }, orderBy: { createdAt: "desc" } }),
    prisma.placementResume.findMany({ where: { institutionId, studentId: target }, orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }] }),
  ]);
  return { profile, enrollment, skills, certifications, projects, resumes };
}

export async function listPlacementOffers(institutionId: string, actor: AuthenticatedUser, studentId?: string) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const target = activeWorkspace(actor) === "STUDENT" ? actor.id : studentId;
  if (target) await assertCanViewStudent(institutionId, actor, target);
  const studentWhere = target ? { id: target } : await getPlacementStudentScope(institutionId, actor);
  return prisma.placementOffer.findMany({
    where: { institutionId, student: studentWhere },
    include: { company: { select: { id: true, name: true, logoUrl: true } }, student: { select: { firstName: true, lastName: true } } },
    orderBy: { offerDate: "desc" },
    take: 100,
  });
}


export async function updatePlacementProfile(institutionId: string, actor: AuthenticatedUser, input: { portfolioUrl?: string|null; githubUrl?: string|null; linkedInUrl?: string|null; bio?: string|null }) {
  assertInstitution(actor, institutionId);
  if (activeWorkspace(actor) !== "STUDENT") throw new AppError("Only students may edit their placement profile.", 403);
  const profile = await prisma.placementProfile.upsert({
    where: { studentId: actor.id },
    create: { institutionId, studentId: actor.id, portfolioUrl: input.portfolioUrl ?? null, githubUrl: input.githubUrl ?? null, linkedInUrl: input.linkedInUrl ?? null, bio: input.bio ?? null },
    update: { portfolioUrl: input.portfolioUrl, githubUrl: input.githubUrl, linkedInUrl: input.linkedInUrl, bio: input.bio },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.profile.updated", entityType: "PlacementProfile", entityId: profile.id, metadata: { fields: Object.keys(input) } });
  return profile;
}

export async function createPlacementCompanyContact(institutionId: string, actor: AuthenticatedUser, companyId: string, input: { name: string; designation?: string; email?: string; phone?: string; isPrimary?: boolean; notes?: string }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: companyId, institutionId }, select: { id: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  if (!input.name.trim()) throw new AppError("Contact name is required.", 400);
  if (input.isPrimary) await prisma.placementCompanyContact.updateMany({ where: { institutionId, companyId }, data: { isPrimary: false } });
  const contact = await prisma.placementCompanyContact.create({ data: { institutionId, companyId, name: input.name.trim(), designation: input.designation?.trim() || null, email: input.email?.trim() || null, phone: input.phone?.trim() || null, isPrimary: input.isPrimary ?? false, notes: input.notes?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.company_contact.created", entityType: "PlacementCompanyContact", entityId: contact.id, metadata: { companyId } });
  return contact;
}

export async function listPlacementOpenings(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  return prisma.placementOpening.findMany({
    where: {
      institutionId,
      ...(activeWorkspace(actor) === "STUDENT"
        ? { drives: { some: { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED"] } } } }
        : {}),
    },
    include: { company: { select: { id: true, name: true } }, drives: { select: { id: true, title: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
export async function createPlacementOpening(institutionId: string, actor: AuthenticatedUser, input: {
  companyId: string; role: string; description?: string; employmentType?: string; location?: string;
  totalCtc?: number; fixedCtc?: number; variableCtc?: number; bonus?: number; stipend?: number; currency?: string; packagePeriod?: string;
  requiredSkills?: string[]; eligibility?: Record<string, unknown>; hiringBatchIds?: string[]; deadline?: string; applicationProcess?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!(await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true } }))) throw new AppError("Company not found in this institution.", 404);
  const opening = await prisma.placementOpening.create({ data: {
    institutionId, companyId: input.companyId, role: input.role.trim(), description: input.description?.trim() || null, employmentType: input.employmentType?.trim() || null,
    location: input.location?.trim() || null, totalCtc: input.totalCtc, fixedCtc: input.fixedCtc, variableCtc: input.variableCtc, bonus: input.bonus, stipend: input.stipend,
    currency: input.currency || "INR", packagePeriod: input.packagePeriod || null, requiredSkills: input.requiredSkills ?? undefined, eligibility: input.eligibility as Prisma.InputJsonValue | undefined,
    hiringBatchIds: input.hiringBatchIds ?? undefined, deadline: input.deadline ? new Date(input.deadline) : null, applicationProcess: input.applicationProcess?.trim() || null,
  }, include: { company: true }});
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.opening.created", entityType: "PlacementOpening", entityId: opening.id, metadata: { companyId: input.companyId, role: input.role }});
  return opening;
}


export async function updatePlacementOpening(institutionId: string, actor: AuthenticatedUser, id: string, input: {
  companyId?: string; role?: string; description?: string; employmentType?: string; location?: string;
  totalCtc?: number; fixedCtc?: number; variableCtc?: number; bonus?: number; stipend?: number;
  currency?: string; packagePeriod?: string; requiredSkills?: string[]; eligibility?: Record<string, unknown>;
  hiringBatchIds?: string[]; deadline?: string | null; applicationProcess?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const current = await prisma.placementOpening.findFirst({ where: { id, institutionId }, select: { id: true, companyId: true } });
  if (!current) throw new AppError("Placement opening not found.", 404);
  const companyId = input.companyId ?? current.companyId;
  if (!(await prisma.placementCompany.findFirst({ where: { id: companyId, institutionId }, select: { id: true } }))) throw new AppError("Company must belong to this institution.", 422);
  const updated = await prisma.placementOpening.update({
    where: { id },
    data: {
      companyId, role: input.role?.trim(), description: input.description, employmentType: input.employmentType, location: input.location,
      totalCtc: input.totalCtc, fixedCtc: input.fixedCtc, variableCtc: input.variableCtc, bonus: input.bonus, stipend: input.stipend,
      currency: input.currency, packagePeriod: input.packagePeriod, requiredSkills: input.requiredSkills as Prisma.InputJsonValue | undefined,
      eligibility: input.eligibility as Prisma.InputJsonValue | undefined, hiringBatchIds: input.hiringBatchIds as Prisma.InputJsonValue | undefined,
      deadline: input.deadline === undefined ? undefined : input.deadline ? new Date(input.deadline) : null, applicationProcess: input.applicationProcess,
    },
    include: { company: { select: { id: true, name: true } }, drives: { select: { id: true, title: true, status: true } } },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.opening.updated", entityType: "PlacementOpening", entityId: id, metadata: { fields: Object.keys(input) } });
  return updated;
}

export async function createPlacementOffer(institutionId: string, actor: AuthenticatedUser, input: {
  applicationId: string; role: string; offerDate: string; responseDeadline?: string; joiningDate?: string; totalCtc?: number; fixedCtc?: number; variableCtc?: number; bonus?: number; currency?: string; offerDocumentUrl?: string;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const parsedOfferDate = new Date(input.offerDate);
  const parsedResponseDeadline = input.responseDeadline ? new Date(input.responseDeadline) : null;
  const parsedJoiningDate = input.joiningDate ? new Date(input.joiningDate) : null;
  if (Number.isNaN(parsedOfferDate.getTime()) ||
      (parsedResponseDeadline && (Number.isNaN(parsedResponseDeadline.getTime()) || parsedResponseDeadline < parsedOfferDate)) ||
      (parsedJoiningDate && (Number.isNaN(parsedJoiningDate.getTime()) || parsedJoiningDate < parsedOfferDate))) {
    throw new AppError("Offer date, response deadline, and joining date must be valid; deadlines and joining cannot precede the offer date.", 422);
  }
  const application = await prisma.application.findFirst({
    where: { id: input.applicationId, institutionId },
    include: { student: { select: { id: true } }, opportunity: { select: { organization: true } } },
  });
  if (!application) throw new AppError("Application not found.", 404);
  await assertCanViewStudent(institutionId, actor, application.student.id);
  // Interview scheduling is not a selection decision. Offers can only be issued
  // after an authorised reviewer has moved the application to SELECTED.
  if (application.status !== "SELECTED") {
    throw new AppError("Only a selected candidate can receive an offer. Mark the application SELECTED first.", 409);
  }
  let linkedDrive = application.placementDriveId
    ? await prisma.placementDrive.findFirst({
        where: { id: application.placementDriveId, institutionId },
        select: {
          id: true, campusId: true, eligibleDepartments: true, opportunityId: true,
          company: { select: { id: true, name: true } },
        },
      })
    : null;
  if (!linkedDrive && application.opportunityId) {
    linkedDrive = await prisma.placementDrive.findFirst({
      where: { institutionId, opportunityId: application.opportunityId },
      select: {
        id: true, campusId: true, eligibleDepartments: true, opportunityId: true,
        company: { select: { id: true, name: true } },
      },
    });
  }
  if (linkedDrive && activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!linkedDrive.campusId || !campusIds.includes(linkedDrive.campusId)) {
      throw new AppError("The offer's placement drive is outside the director's authorised campus scope.", 404);
    }
  }
  if (linkedDrive && ["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targetedDepartments = Array.isArray(linkedDrive.eligibleDepartments)
      ? linkedDrive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targetedDepartments.length || !targetedDepartments.some((value) => departmentIds.includes(value))) {
      throw new AppError("The offer's placement drive is outside the authorised department scope.", 404);
    }
  }
  const company = linkedDrive?.company ?? await prisma.placementCompany.findFirst({
    where: { institutionId, name: application.opportunity.organization },
    select: { id: true, name: true },
  });
  if (!company) throw new AppError("Create the canonical company record before issuing an offer.", 409);

  const offer = await prisma.$transaction(async (tx) => {
    const existingOffer = await tx.placementOffer.findFirst({
      where: { institutionId, applicationId: application.id },
      select: { id: true },
    });
    if (existingOffer) throw new AppError("An offer already exists for this application. Revise the existing offer instead.", 409);

    const moved = await tx.application.updateMany({
      where: { id: application.id, institutionId, status: "SELECTED" },
      data: { status: "OFFERED" },
    });
    if (moved.count !== 1) {
      throw new AppError("The application changed while the offer was being issued. Refresh and try again.", 409);
    }
    const created = await tx.placementOffer.create({
      data: {
        institutionId,
        studentId: application.student.id,
        companyId: company.id,
        applicationId: application.id,
        role: input.role.trim(),
        offerDate: parsedOfferDate,
        responseDeadline: parsedResponseDeadline,
        joiningDate: parsedJoiningDate,
        totalCtc: input.totalCtc,
        fixedCtc: input.fixedCtc,
        variableCtc: input.variableCtc,
        bonus: input.bonus,
        currency: input.currency || "INR",
        offerDocumentUrl: input.offerDocumentUrl || null,
      },
    });
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.offer.created", {
      offerId: created.id,
      applicationId: application.id,
      studentId: application.student.id,
      driveId: linkedDrive?.id ?? application.placementDriveId,
    });
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.application.status_changed", {
      applicationId: application.id,
      from: "SELECTED",
      to: "OFFERED",
      driveId: linkedDrive?.id ?? application.placementDriveId,
    });
    return created;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.offer.created", entityType: "PlacementOffer", entityId: offer.id, metadata: { applicationId: application.id, studentId: application.student.id } });
  return offer;
}

export async function updatePlacementOffer(institutionId: string, actor: AuthenticatedUser, offerId: string, input: {
  role?: string;
  offerDate?: string;
  responseDeadline?: string | null;
  joiningDate?: string | null;
  totalCtc?: number | null;
  fixedCtc?: number | null;
  variableCtc?: number | null;
  bonus?: number | null;
  currency?: string;
  offerDocumentUrl?: string | null;
  notes?: string | null;
}) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.placementOffer.findFirst({
    where: { id: offerId, institutionId },
    select: {
      id: true, studentId: true, status: true, updatedAt: true, offerDate: true,
      responseDeadline: true, joiningDate: true, applicationId: true,
    },
  });
  if (!existing) throw new AppError("Placement offer not found.", 404);
  await assertCanViewStudent(institutionId, actor, existing.studentId);
  if (existing.status !== "OFFERED") {
    throw new AppError("Only an offer awaiting the student's response can be revised. Preserve accepted or declined offer history.", 409);
  }

  const offerDate = input.offerDate === undefined ? existing.offerDate : new Date(input.offerDate);
  const responseDeadline = input.responseDeadline === undefined
    ? existing.responseDeadline
    : input.responseDeadline ? new Date(input.responseDeadline) : null;
  const joiningDate = input.joiningDate === undefined
    ? existing.joiningDate
    : input.joiningDate ? new Date(input.joiningDate) : null;
  if (Number.isNaN(offerDate.getTime()) ||
      (responseDeadline && (Number.isNaN(responseDeadline.getTime()) || responseDeadline < offerDate)) ||
      (joiningDate && (Number.isNaN(joiningDate.getTime()) || joiningDate < offerDate))) {
    throw new AppError("Offer date, response deadline, and joining date must be valid; deadlines and joining cannot precede the offer date.", 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.placementOffer.updateMany({
      where: { id: offerId, institutionId, status: "OFFERED", updatedAt: existing.updatedAt },
      data: {
        ...(input.role !== undefined ? { role: input.role.trim() } : {}),
        ...(input.offerDate !== undefined ? { offerDate } : {}),
        ...(input.responseDeadline !== undefined ? { responseDeadline } : {}),
        ...(input.joiningDate !== undefined ? { joiningDate } : {}),
        ...(input.totalCtc !== undefined ? { totalCtc: input.totalCtc } : {}),
        ...(input.fixedCtc !== undefined ? { fixedCtc: input.fixedCtc } : {}),
        ...(input.variableCtc !== undefined ? { variableCtc: input.variableCtc } : {}),
        ...(input.bonus !== undefined ? { bonus: input.bonus } : {}),
        ...(input.currency !== undefined ? { currency: input.currency.toUpperCase() } : {}),
        ...(input.offerDocumentUrl !== undefined ? { offerDocumentUrl: input.offerDocumentUrl } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    if (changed.count !== 1) throw new AppError("The offer changed while you were editing it. Refresh and try again.", 409);
    const row = await tx.placementOffer.findFirst({ where: { id: offerId, institutionId } });
    if (!row) throw new AppError("Placement offer not found.", 404);
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.offer.updated", {
      offerId,
      version: row.updatedAt.toISOString(),
      studentId: row.studentId,
    });
    return row;
  });
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.offer.updated",
    entityType: "PlacementOffer", entityId: offerId,
    metadata: { applicationId: existing.applicationId ? "linked" : "unlinked", fields: Object.keys(input) },
  });
  return updated;
}


export async function transitionPlacementOffer(institutionId: string, actor: AuthenticatedUser, offerId: string, status: string) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  const offer = await prisma.placementOffer.findFirst({ where: { id: offerId, institutionId } });
  if (!offer) throw new AppError("Placement offer not found.", 404);
  const next = status.toUpperCase();
  const allowed: Record<string, string[]> = {
    OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
    ACCEPTED: ["JOINING_PENDING", "JOINED", "WITHDRAWN"],
    JOINING_PENDING: ["JOINED", "WITHDRAWN"],
    REJECTED: [],
    JOINED: [],
    WITHDRAWN: [],
  };
  if (activeWorkspace(actor) === "STUDENT") {
    if (offer.studentId !== actor.id) throw new AppError("This offer is outside your scope.", 403);
    if (!["ACCEPTED", "REJECTED"].includes(next) || offer.status !== "OFFERED") {
      throw new AppError("Invalid student offer transition.", 409);
    }
    if (offer.responseDeadline && Date.now() > offer.responseDeadline.getTime()) {
      throw new AppError("The offer response deadline has passed. Contact your Placement Cell for assistance.", 409);
    }
  } else {
    if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
    if (!allowed[offer.status]?.includes(next)) throw new AppError(`Invalid offer transition: ${offer.status} -> ${next}`, 409);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.placementOffer.updateMany({
      where: { id: offerId, institutionId, status: offer.status },
      data: {
        status: next,
        acceptanceAt: next === "ACCEPTED" ? new Date() : offer.acceptanceAt,
        joiningStatus: next === "JOINING_PENDING" ? "PENDING" : offer.joiningStatus,
      },
    });
    if (changed.count !== 1) throw new AppError("The offer was updated by another user. Refresh and try again.", 409);

    // Keep the application pipeline consistent with the student's actual offer decision.
    if (offer.applicationId && ["ACCEPTED", "REJECTED", "WITHDRAWN", "JOINED"].includes(next)) {
      const application = await tx.application.findFirst({
        where: { id: offer.applicationId, institutionId },
        select: { id: true, status: true },
      });
      const targetStatus = next === "JOINED" ? "JOINED" : next;
      if (application && application.status !== targetStatus) {
        const valid = APPLICATION_TRANSITIONS[application.status]?.includes(targetStatus);
        if (valid) {
          await tx.application.updateMany({
            where: { id: application.id, institutionId, status: application.status },
            data: { status: targetStatus },
          });
        }
      }
    }
    const row = await tx.placementOffer.findFirst({ where: { id: offerId, institutionId } });
    if (!row) throw new AppError("Placement offer not found.", 404);
    await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.offer.status_changed", {
      offerId,
      from: offer.status,
      to: next,
      studentId: offer.studentId,
    });
    return row;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.offer.status_changed", entityType: "PlacementOffer", entityId: offerId, metadata: { from: offer.status, to: next } });
  return updated;
}

export async function verifyPlacementJoining(
  institutionId: string,
  actor: AuthenticatedUser,
  offerId: string,
  input: { actualJoiningDate?: string; status: "VERIFIED" | "REJECTED"; proofUrl?: string; notes?: string },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const offer = await prisma.placementOffer.findFirst({
    where: { id: offerId, institutionId },
    select: {
      id: true, studentId: true, companyId: true, joiningDate: true, applicationId: true,
      status: true, joiningStatus: true, updatedAt: true,
    },
  });
  if (!offer) throw new AppError("Placement offer not found.", 404);
  await assertCanViewStudent(institutionId, actor, offer.studentId);
  const actualJoiningDate = input.actualJoiningDate ? new Date(input.actualJoiningDate) : null;
  if (actualJoiningDate && Number.isNaN(actualJoiningDate.getTime())) {
    throw new AppError("The actual joining date is invalid.", 422);
  }
  if (input.status === "VERIFIED" && !["ACCEPTED", "JOINING_PENDING", "JOINED"].includes(offer.status)) {
    throw new AppError("Only an accepted offer can have its joining verified.", 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const previousVerification = await tx.placementJoiningVerification.findUnique({
      where: { offerId }, select: { id: true, status: true },
    });
    if (previousVerification?.status === "VERIFIED" && input.status === "REJECTED") {
      throw new AppError("A verified joining cannot be silently reversed. Preserve the verification and use the institution's correction process.", 409);
    }
    const verification = await tx.placementJoiningVerification.upsert({
      where: { offerId },
      create: {
        institutionId, offerId, studentId: offer.studentId,
        expectedJoiningDate: offer.joiningDate,
        actualJoiningDate,
        status: input.status,
        proofUrl: input.proofUrl || null,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        notes: input.notes || null,
      },
      update: {
        expectedJoiningDate: offer.joiningDate,
        actualJoiningDate: actualJoiningDate === null ? undefined : actualJoiningDate,
        status: input.status,
        proofUrl: input.proofUrl === undefined ? undefined : input.proofUrl || null,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        notes: input.notes === undefined ? undefined : input.notes || null,
      },
    });

    let joinedStatusChanged = false;
    if (input.status === "VERIFIED" && offer.status !== "JOINED") {
      const changed = await tx.placementOffer.updateMany({
        where: { id: offerId, institutionId, status: offer.status, updatedAt: offer.updatedAt },
        data: {
          status: "JOINED",
          joiningStatus: "VERIFIED",
          joiningVerifiedAt: new Date(),
          joiningVerifiedById: actor.id,
        },
      });
      if (changed.count !== 1) {
        throw new AppError("The offer changed while joining was being verified. Refresh and try again.", 409);
      }
      joinedStatusChanged = true;
      if (offer.applicationId) {
        const application = await tx.application.findFirst({
          where: { id: offer.applicationId, institutionId },
          select: { id: true, status: true },
        });
        if (application && APPLICATION_TRANSITIONS[application.status]?.includes("JOINED")) {
          await tx.application.updateMany({
            where: { id: application.id, institutionId, status: application.status },
            data: { status: "JOINED" },
          });
        }
      }
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.offer.status_changed", {
        offerId, from: offer.status, to: "JOINED", studentId: offer.studentId,
      });
    } else if (input.status === "VERIFIED" && offer.status === "JOINED" && offer.joiningStatus !== "VERIFIED") {
      const changed = await tx.placementOffer.updateMany({
        where: { id: offerId, institutionId, status: "JOINED", updatedAt: offer.updatedAt },
        data: { joiningStatus: "VERIFIED", joiningVerifiedAt: new Date(), joiningVerifiedById: actor.id },
      });
      if (changed.count !== 1) throw new AppError("The offer changed while joining was being verified. Refresh and try again.", 409);
      joinedStatusChanged = true;
    }

    if (input.status === "VERIFIED" && previousVerification?.status !== "VERIFIED" && offer.status !== "JOINED") {
      const aggregate = await tx.placementOffer.aggregate({
        where: { institutionId, companyId: offer.companyId, status: "JOINED" },
        _avg: { totalCtc: true }, _max: { totalCtc: true },
      });
      await tx.placementCompanyHistory.upsert({
        where: { institutionId_companyId: { institutionId, companyId: offer.companyId } },
        create: {
          institutionId, companyId: offer.companyId, hiredCount: 1,
          averagePackage: aggregate._avg.totalCtc, highestPackage: aggregate._max.totalCtc,
          lastInteractionAt: new Date(),
        },
        update: {
          hiredCount: { increment: 1 }, averagePackage: aggregate._avg.totalCtc,
          highestPackage: aggregate._max.totalCtc, lastInteractionAt: new Date(),
        },
      });
    }
    return { verification, joinedStatusChanged };
  });

  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.joining.verified",
    entityType: "PlacementJoiningVerification", entityId: result.verification.id,
    metadata: { offerId, status: input.status },
  });
  return result.verification;
}

export async function listPlacementInterviews(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { studentId?: string; driveId?: string } = {},
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const workspace = activeWorkspace(actor);
  const studentWhere = await getPlacementStudentScope(institutionId, actor);
  const directorScope = workspace === "DIRECTOR";
  const directorCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && directorCampusIds.length === 0) throw new AppError("No campus scope is assigned to this director.", 403);
  return prisma.placementInterview.findMany({
    where: {
      institutionId,
      ...(options.driveId ? { driveId: options.driveId } : {}),
      ...(directorScope ? { drive: { campusId: { in: directorCampusIds } } } : {}),
      ...(workspace === "STUDENT" ? {
        status: { notIn: ["CANCELLED", "DRAFT"] },
        participants: { some: { studentId: actor.id } },
        drive: { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "ACCEPTED", "JOINED"] } },
      } : {}),
      ...(options.studentId ? { participants: { some: { studentId: options.studentId } } } : {}),
      ...(!["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","DIRECTOR","REGISTRAR","DEAN","PLACEMENT","STUDENT"].includes(workspace)
        ? { participants: { some: { student: studentWhere } } }
        : {}),
    },
    include: {
      drive: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      participants: {
        where: workspace === "STUDENT" ? { studentId: actor.id } : undefined,
        include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
}

export async function createPlacementInterview(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { driveId: string; roundNumber: number; roundType: string; startsAt: string; endsAt?: string; venue?: string; onlineLink?: string; interviewer?: string; status?: "DRAFT" | "SCHEDULED"; studentIds?: string[]; targeting?: PlacementCohortTargeting },
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({ where: { id: input.driveId, institutionId }, select: { id: true, status: true, campusId: true, eligibleDepartments: true, opportunityId: true } });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (!["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "ACCEPTED", "JOINED"].includes(drive.status)) {
    throw new AppError("Publish the placement drive before scheduling interviews.", 409);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!drive.campusId || !campusIds.includes(drive.campusId)) throw new AppError("The linked drive is outside the director's authorised campus scope.", 403);
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(drive.eligibleDepartments) ? drive.eligibleDepartments.filter((id): id is string => typeof id === "string") : [];
    if (!targeted.length || !targeted.some((id) => departmentIds.includes(id))) throw new AppError("The linked drive is outside the authorised department scope.", 403);
  }
  const driveApplications = await prisma.application.findMany({
    where: {
      institutionId,
      OR: [
        { placementDriveId: drive.id },
        ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
      ],
      status: { in: ["SHORTLISTED", "TEST", "INTERVIEW"] },
    },
    select: { studentId: true },
    orderBy: { studentId: "asc" },
    take: 10000,
  });
  const driveCandidateIds = new Set(driveApplications.map((application) => application.studentId));
  const cohortTargetIds = await resolvePlacementCohortAudience(institutionId, input.targeting);
  const explicitStudentIds = input.studentIds ?? [];
  if (new Set(explicitStudentIds).size !== explicitStudentIds.length) {
    throw new AppError("The explicitly selected interview audience contains duplicate student IDs.", 422);
  }
  if (explicitStudentIds.length) {
    const eligibleExplicit = await prisma.user.findMany({
      where: {
        institutionId, id: { in: explicitStudentIds },
        userRoles: { some: { role: { name: "STUDENT" } } },
        studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (eligibleExplicit.length !== explicitStudentIds.length) {
      throw new AppError("Every explicitly selected interview candidate must be an actively enrolled student in this institution.", 422);
    }
    if (explicitStudentIds.some((studentId) => !driveCandidateIds.has(studentId))) {
      throw new AppError("Every explicitly selected interview candidate must have a live shortlisted/test/interview application for this drive.", 422);
    }
  }
  const cohortStudentIds = cohortTargetIds.filter((studentId) => driveCandidateIds.has(studentId));
  const hasCohortFilters = Boolean(
    input.targeting && (
      input.targeting.campusIds?.length || input.targeting.programIds?.length ||
      input.targeting.departmentIds?.length || input.targeting.batchIds?.length ||
      input.targeting.graduatingYears?.length || input.targeting.semesterIds?.length ||
      input.targeting.sectionIds?.length
    ),
  );
  if (hasCohortFilters && cohortTargetIds.length === 0 && explicitStudentIds.length === 0) {
    throw new AppError("The selected placement cohort contains no active students.", 422);
  }
  if (hasCohortFilters && cohortStudentIds.length === 0 && explicitStudentIds.length === 0) {
    throw new AppError("No shortlisted, test-stage, or interview-stage applicants for this drive match the selected cohort.", 422);
  }
  const targetedStudentIds = [...new Set([...explicitStudentIds, ...cohortStudentIds])];
  const requestedStudentIds = targetedStudentIds.length
    ? targetedStudentIds
    : [...driveCandidateIds];
  if (requestedStudentIds.length) {
    const studentAccounts = await prisma.user.findMany({
      where: {
        institutionId, id: { in: requestedStudentIds },
        userRoles: { some: { role: { name: "STUDENT" } } },
      },
      select: { id: true },
    });
    if (studentAccounts.length !== requestedStudentIds.length) {
      throw new AppError("Every interview participant must have a Student account in this institution.", 422);
    }
  }
  await Promise.all(requestedStudentIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  const initialStatus = input.status ?? "SCHEDULED";
  const scheduledStart = new Date(input.startsAt);
  const scheduledEnd = input.endsAt ? new Date(input.endsAt) : new Date(scheduledStart.getTime() + 60 * 60_000);
  if (Number.isNaN(scheduledStart.getTime()) || Number.isNaN(scheduledEnd.getTime()) || scheduledEnd <= scheduledStart) {
    throw new AppError("Interview end time must be after its start time.", 422);
  }
  if (initialStatus === "SCHEDULED" && requestedStudentIds.length === 0) {
    throw new AppError("Schedule only after selecting a candidate list or cohort. Save a draft while configuring the audience.", 422);
  }
  const interview = await prisma.$transaction(async (tx) => {
    if (initialStatus === "SCHEDULED") {
      await assertNoPlacementScheduleConflicts(tx, institutionId, requestedStudentIds, scheduledStart, scheduledEnd);
    }
    const created = await tx.placementInterview.create({
      data: {
        institutionId,
        driveId: input.driveId,
        roundNumber: input.roundNumber,
        roundType: input.roundType.trim(),
        status: initialStatus,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        venue: input.venue?.trim() || null,
        onlineLink: input.onlineLink?.trim() || null,
        interviewer: input.interviewer?.trim() || null,
      },
    });
    if (requestedStudentIds.length) {
      await tx.placementInterviewParticipant.createMany({
        data: requestedStudentIds.map((studentId) => ({ interviewId: created.id, studentId })),
        skipDuplicates: true,
      });
      if (initialStatus === "SCHEDULED") {
        await advanceApplicationsForScheduledRound(
          tx, institutionId, actor.id, drive.id, drive.opportunityId, requestedStudentIds, "INTERVIEW",
        );
        await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
          eventType: "interview",
          eventId: created.id,
          version: "created",
          recipientIds: requestedStudentIds,
        });
      }
    }
    return created;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.created", entityType: "PlacementInterview", entityId: interview.id, metadata: { driveId: input.driveId, roundNumber: input.roundNumber } });
  return interview;
}

export async function addPlacementInterviewParticipant(
  institutionId: string,
  actor: AuthenticatedUser,
  interviewId: string,
  studentId: string,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  await assertCanViewStudent(institutionId, actor, studentId);
  const targetStudent = await prisma.user.findFirst({
    where: {
      id: studentId, institutionId,
      userRoles: { some: { role: { name: "STUDENT" } } },
      studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (!targetStudent) throw new AppError("Candidate must be an actively enrolled student in this institution.", 422);
  const interview = await prisma.placementInterview.findFirst({
    where: { id: interviewId, institutionId },
    select: { id: true, status: true, driveId: true, drive: { select: { campusId: true, eligibleDepartments: true, opportunityId: true } } },
  });
  if (!interview) throw new AppError("Placement interview not found.", 404);
  if (interview.status === "CANCELLED") throw new AppError("Cancelled interviews cannot receive new candidate assignments.", 409);
  const candidateApplication = await prisma.application.findFirst({
    where: {
      institutionId, studentId,
      OR: [
        { placementDriveId: interview.driveId },
        ...(interview.drive.opportunityId ? [{ opportunityId: interview.drive.opportunityId }] : []),
      ],
      status: { in: ["SHORTLISTED", "TEST", "INTERVIEW"] },
    },
    select: { id: true },
  });
  if (!candidateApplication) {
    throw new AppError("Only a shortlisted, test-stage, or interview-stage applicant for this drive can be assigned to its interview.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campuses = await getDirectorCampusIds(institutionId, actor.id);
    if (!interview.drive.campusId || !campuses.includes(interview.drive.campusId)) {
      throw new AppError("Placement interview not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departments = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(interview.drive.eligibleDepartments)
      ? interview.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((value) => departments.includes(value))) {
      throw new AppError("Placement interview not found in the authorised department scope.", 404);
    }
  }

  const participant = await prisma.$transaction(async (tx) => {
    const existing = await tx.placementInterviewParticipant.findUnique({
      where: { interviewId_studentId: { interviewId, studentId } },
      select: { interviewId: true },
    });
    const row = await tx.placementInterviewParticipant.upsert({
      where: { interviewId_studentId: { interviewId, studentId } },
      create: { interviewId, studentId },
      update: {},
    });
    if (!existing && interview.status === "SCHEDULED") {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "interview", eventId: interviewId, version: "assigned", recipientIds: [studentId],
      });
    }
    return row;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.participant_added", entityType: "PlacementInterviewParticipant", entityId: interviewId + ":" + studentId, metadata: { interviewId, studentId } });
  return participant;
}

export async function updatePlacementInterviewParticipant(
  institutionId: string,
  actor: AuthenticatedUser,
  interviewId: string,
  studentId: string,
  input: { attendanceStatus?: string; resultStatus?: string; feedback?: string | null },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const participant = await prisma.placementInterviewParticipant.findFirst({ where: { interviewId, studentId, interview: { institutionId } } });
  if (!participant) throw new AppError("Interview participant not found.", 404);
  const updated = await prisma.placementInterviewParticipant.update({
    where: { interviewId_studentId: { interviewId, studentId } },
    data: input,
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.interview.participant_updated", entityType: "PlacementInterviewParticipant", entityId: interviewId + ":" + studentId, metadata: input });
  return updated;
}

export async function listPlacementVisits(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const workspace = activeWorkspace(actor);
  // Student-facing visits are restricted to the explicit audience recorded by
  // authorised placement staff. Do not expose recruiter notes or other students'
  // records through this projection.
  if (workspace === "STUDENT") {
    return prisma.placementVisit.findMany({
      where: {
        institutionId,
        status: "PUBLISHED",
        participatingStudentIds: { array_contains: [actor.id] },
        OR: [
          { driveId: null },
          { drive: { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "ACCEPTED", "JOINED"] } } },
        ],
      },
      select: {
        id: true, type: true, startsAt: true, endsAt: true, venue: true, purpose: true,
        company: { select: { id: true, name: true, logoUrl: true } },
        drive: { select: { id: true, title: true, status: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    });
  }
  if (!["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","DIRECTOR","DEAN","HOD","PLACEMENT"].includes(workspace)) {
    return [];
  }
  const directorScope = workspace === "DIRECTOR";
  const campusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && !campusIds.length) return [];
  const departmentIds = ["DIRECTOR","DEAN","HOD"].includes(workspace)
    ? await getAuthorizedDepartmentIds(institutionId, actor)
    : null;
  if (departmentIds && !departmentIds.length) return [];
  const visits = await prisma.placementVisit.findMany({
    where: {
      institutionId,
      ...(directorScope ? { drive: { campusId: { in: campusIds } } } : {}),
    },
    include: {
      company: { select: { id: true, name: true, logoUrl: true } },
      drive: { select: { id: true, title: true, status: true, campusId: true, eligibleDepartments: true } },
    },
    orderBy: { startsAt: "asc" },
    take: 100,
  });
  if (!departmentIds) return visits;
  const allowed = new Set(departmentIds);
  return visits.filter((visit) => {
    // A scoped academic workspace cannot infer access to an unassigned,
    // institution-wide visit that has no drive/campus/department linkage.
    if (!visit.drive) return false;
    const departments = Array.isArray(visit.drive.eligibleDepartments)
      ? visit.drive.eligibleDepartments.filter((id): id is string => typeof id === "string")
      : [];
    return departments.length === 0 || departments.some((id) => allowed.has(id));
  });
}

export async function createPlacementVisit(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { companyId: string; driveId?: string; type: string; startsAt: string; endsAt?: string; venue?: string; purpose?: string; representatives?: unknown; participatingStudentIds?: string[]; targeting?: PlacementCohortTargeting; status?: "DRAFT" | "PUBLISHED"; notes?: string; followUp?: string },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const company = await prisma.placementCompany.findFirst({ where: { id: input.companyId, institutionId }, select: { id: true } });
  if (!company) throw new AppError("Company not found in this institution.", 404);
  const linkedDrive = input.driveId
    ? await prisma.placementDrive.findFirst({
        where: { id: input.driveId, institutionId, companyId: input.companyId },
        select: { id: true, campusId: true, eligibleDepartments: true, opportunityId: true },
      })
    : null;
  if (input.driveId && !linkedDrive) {
    throw new AppError("Drive does not belong to the selected company.", 422);
  }
  if (linkedDrive && activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!linkedDrive.campusId || !campusIds.includes(linkedDrive.campusId)) {
      throw new AppError("The linked drive is outside the director's authorised campus scope.", 403);
    }
  }
  if (linkedDrive && ["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targetedDepartments = Array.isArray(linkedDrive.eligibleDepartments)
      ? linkedDrive.eligibleDepartments.filter((id): id is string => typeof id === "string")
      : [];
    if (!targetedDepartments.length || !targetedDepartments.some((id) => departmentIds.includes(id))) {
      throw new AppError("The linked drive is outside the authorised department scope.", 403);
    }
  }
  if (input.participatingStudentIds?.length) {
    const uniqueStudentIds = [...new Set(input.participatingStudentIds)];
    if (uniqueStudentIds.length !== input.participatingStudentIds.length) {
      throw new AppError("The target audience contains duplicate student IDs.", 422);
    }
    await Promise.all(uniqueStudentIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
    const targetStudents = await prisma.user.findMany({
      where: {
        id: { in: uniqueStudentIds },
        institutionId,
        userRoles: { some: { role: { name: "STUDENT" } } },
        studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (targetStudents.length !== uniqueStudentIds.length) {
      throw new AppError("Every target must be an institution student within your authorised scope.", 422);
    }
  }
  const cohortStudentIds = await resolvePlacementCohortAudience(institutionId, input.targeting);
  let targetStudentIds = [...new Set([...(input.participatingStudentIds ?? []), ...cohortStudentIds])];
  if (!targetStudentIds.length && input.driveId) {
    const applicants = await prisma.application.findMany({
      where: {
        institutionId,
        OR: [
          { placementDriveId: input.driveId },
          ...(linkedDrive?.opportunityId ? [{ opportunityId: linkedDrive.opportunityId }] : []),
        ],
        status: { notIn: ["REJECTED", "WITHDRAWN"] },
      },
      select: { studentId: true },
      orderBy: { studentId: "asc" },
      take: 10000,
    });
    targetStudentIds = [...new Set(applicants.map((application) => application.studentId))];
    await Promise.all(targetStudentIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  }
  const initialStatus = input.status ?? "PUBLISHED";
  if (initialStatus === "PUBLISHED" && targetStudentIds.length === 0) {
    throw new AppError("Published activities must target a cohort, explicit students, or candidates for the linked drive.", 422);
  }
  if (cohortStudentIds.length) {
    await Promise.all(cohortStudentIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  }
  if (input.targeting && (input.targeting.campusIds?.length || input.targeting.programIds?.length || input.targeting.departmentIds?.length || input.targeting.batchIds?.length || input.targeting.graduatingYears?.length || input.targeting.semesterIds?.length || input.targeting.sectionIds?.length) && cohortStudentIds.length === 0) {
    throw new AppError("The selected placement cohort contains no active students.", 422);
  }
  const visit = await prisma.$transaction(async (tx) => {
    const created = await tx.placementVisit.create({
      data: {
        institutionId,
        companyId: input.companyId,
        driveId: input.driveId || null,
        type: input.type.trim(),
        status: initialStatus,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        venue: input.venue?.trim() || null,
        purpose: input.purpose?.trim() || null,
        representatives: input.representatives as Prisma.InputJsonValue | undefined,
        participatingStudentIds: targetStudentIds.length ? targetStudentIds : undefined,
        notes: input.notes?.trim() || null,
        followUp: input.followUp?.trim() || null,
      },
    });
    if (initialStatus === "PUBLISHED" && targetStudentIds.length) {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "visit",
        eventId: created.id,
        version: "created",
        recipientIds: targetStudentIds,
      });
    }
    return created;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.visit.created", entityType: "PlacementVisit", entityId: visit.id, metadata: { companyId: input.companyId, type: input.type } });
  return visit;
}


export async function updatePlacementVisit(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: { type?: string; startsAt?: string; endsAt?: string | null; venue?: string | null; purpose?: string | null; status?: "DRAFT" | "PUBLISHED" | "CANCELLED"; participatingStudentIds?: string[]; targeting?: PlacementCohortTargeting },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.placementVisit.findFirst({
    where: { id, institutionId },
    select: {
      id: true, status: true, startsAt: true, endsAt: true, venue: true, purpose: true, updatedAt: true,
      participatingStudentIds: true, company: { select: { name: true } }, type: true,
      drive: { select: { id: true, campusId: true, eligibleDepartments: true } },
    },
  });
  if (!existing) throw new AppError("Placement activity not found.", 404);
  if (existing.status === "CANCELLED") throw new AppError("Cancelled placement activities cannot be changed.", 409);
  if (input.status === "DRAFT" && existing.status === "PUBLISHED") {
    throw new AppError("A published activity cannot be returned to draft.", 409);
  }

  const previousRecipients = Array.isArray(existing.participatingStudentIds)
    ? existing.participatingStudentIds.filter((value): value is string => typeof value === "string")
    : [];
  const audienceProvided = input.participatingStudentIds !== undefined || input.targeting !== undefined;
  const cohortStudentIds = input.targeting
    ? await resolvePlacementCohortAudience(institutionId, input.targeting)
    : [];
  const requestedIds = [...(input.participatingStudentIds ?? []), ...cohortStudentIds];
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new AppError("The activity audience contains duplicate student IDs.", 422);
  }
  if (requestedIds.length) {
    const students = await prisma.user.findMany({
      where: {
        institutionId, id: { in: requestedIds },
        userRoles: { some: { role: { name: "STUDENT" } } },
        studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (students.length !== new Set(requestedIds).size) {
      throw new AppError("Every activity target must be an enrolled institution student.", 422);
    }
    await Promise.all(requestedIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  }
  // Before publication, edits may replace the draft audience. Published
  // activities are append-only for targeting so prior participants remain in
  // the audit/history trail and keep receiving schedule corrections.
  const recipients = audienceProvided
    ? existing.status === "DRAFT"
      ? [...new Set(requestedIds)]
      : [...new Set([...previousRecipients, ...requestedIds])]
    : previousRecipients;
  if ((input.status ?? existing.status) === "PUBLISHED" && recipients.length === 0) {
    throw new AppError("Published activities must target a cohort, explicit students, or candidates for the linked drive.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (existing.drive?.campusId) {
      if (!campusIds.includes(existing.drive.campusId)) {
        throw new AppError("Placement activity not found in the director's authorised campus scope.", 404);
      }
    } else {
      if (!recipients.length) throw new AppError("This activity has no verifiable campus assignment.", 404);
      await Promise.all(recipients.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(existing.drive?.eligibleDepartments)
      ? existing.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (targeted.length) {
      if (!targeted.some((departmentId) => departmentIds.includes(departmentId))) {
        throw new AppError("Placement activity not found in the authorised department scope.", 404);
      }
    } else {
      if (!recipients.length) throw new AppError("This activity has no verifiable department assignment.", 404);
      await Promise.all(recipients.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
    }
  }

  const nextStartsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const nextEndsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt ? new Date(input.endsAt) : null;
  if (Number.isNaN(nextStartsAt.getTime()) || (nextEndsAt && (Number.isNaN(nextEndsAt.getTime()) || nextEndsAt < nextStartsAt))) {
    throw new AppError("Activity end time must not be before its start time.", 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.placementVisit.updateMany({
      where: { id, institutionId, status: existing.status, startsAt: existing.startsAt, updatedAt: existing.updatedAt },
      data: {
        ...(input.type !== undefined ? { type: input.type.trim() } : {}),
        ...(input.startsAt ? { startsAt: nextStartsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(input.venue !== undefined ? { venue: input.venue?.trim() || null } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose?.trim() || null } : {}),
        ...(audienceProvided ? { participatingStudentIds: recipients as Prisma.InputJsonValue } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    if (changed.count !== 1) throw new AppError("This placement activity was updated by another user. Refresh and try again.", 409);
    const row = await tx.placementVisit.findFirst({ where: { id, institutionId } });
    if (!row) throw new AppError("Placement activity not found.", 404);

    const eventStatus = input.status ?? existing.status;
    let version: string | null = null;
    if (eventStatus === "CANCELLED" && existing.status === "PUBLISHED") {
      version = "cancelled";
    } else if (existing.status === "DRAFT" && eventStatus === "PUBLISHED") {
      version = "published";
    } else if (existing.status === "PUBLISHED" && eventStatus === "PUBLISHED") {
      const moved = nextStartsAt.getTime() !== existing.startsAt.getTime() ||
        (nextEndsAt?.getTime() ?? null) !== (existing.endsAt?.getTime() ?? null);
      const nextType = input.type === undefined ? existing.type : input.type.trim();
      const nextVenue = input.venue === undefined ? existing.venue : input.venue?.trim() || null;
      const nextPurpose = input.purpose === undefined ? existing.purpose : input.purpose?.trim() || null;
      const detailsChanged = moved || nextType !== existing.type || nextVenue !== existing.venue || nextPurpose !== existing.purpose;
      const audienceExpanded = recipients.some((studentId) => !previousRecipients.includes(studentId));
      if (detailsChanged) version = moved ? `rescheduled:${row.startsAt.toISOString()}` : `updated:${row.updatedAt.toISOString()}`;
      else if (audienceExpanded) version = "assigned";
    }
    const addedRecipients = recipients.filter((studentId) => !previousRecipients.includes(studentId));
    const eventRecipients = version === "assigned" ? addedRecipients : recipients;
    if (version && eventRecipients.length) {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "visit", eventId: id, version, recipientIds: eventRecipients, driveId: existing.drive?.id,
      });
    }
    return row;
  });
  await recordAuditLog({
    institutionId, userId: actor.id,
    action: input.status === "CANCELLED" ? "placements.visit.cancelled" : "placements.visit.updated",
    entityType: "PlacementVisit", entityId: id,
    metadata: { status: updated.status, type: updated.type, startsAt: updated.startsAt.toISOString() },
  });
  return updated;
}

export async function listPlacementStudents(institutionId: string, actor: AuthenticatedUser, options: { search?: string; page?: number; pageSize?: number; campusId?: string; departmentId?: string; programId?: string; batchId?: string; semesterId?: string; sectionId?: string; academicYearId?: string } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const studentWhere = await getPlacementStudentScope(institutionId, actor);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 50));
  const filters: Prisma.UserWhereInput[] = [
    studentWhere,
    { userRoles: { some: { role: { name: "STUDENT" } } } },
  ];
  if (options.search) {
    filters.push({ OR: [
      { firstName: { contains: options.search, mode: "insensitive" } },
      { lastName: { contains: options.search, mode: "insensitive" } },
      { email: { contains: options.search, mode: "insensitive" } },
      { idNumber: { contains: options.search, mode: "insensitive" } },
    ] });
  }
  if (options.campusId || options.departmentId || options.programId || options.batchId || options.semesterId || options.sectionId || options.academicYearId) {
    filters.push({
      studentEnrollments: {
        some: {
          institutionId,
          status: "ACTIVE",
          ...(options.programId ? { programId: options.programId } : {}),
          ...(options.batchId ? { batchId: options.batchId } : {}),
          ...(options.semesterId ? { semesterId: options.semesterId } : {}),
          ...(options.sectionId ? { sectionId: options.sectionId } : {}),
          ...(options.academicYearId ? { academicYearId: options.academicYearId } : {}),
          ...(options.departmentId || options.campusId ? {
            program: {
              ...(options.departmentId ? { departmentId: options.departmentId } : {}),
              ...(options.campusId ? { department: { campusId: options.campusId } } : {}),
            },
          } : {}),
        },
      },
    });
  }
  const where: Prisma.UserWhereInput = { institutionId, AND: filters };
  return prisma.user.findMany({
    where,
    select: {
      id: true, firstName: true, lastName: true, email: true, avatarUrl: true,
      studentEnrollments: {
        where: { institutionId, status: "ACTIVE" },
        orderBy: { enrolledAt: "desc" },
        take: 1,
        select: {
          program: { select: { id: true, name: true, department: { select: { id: true, name: true } } } },
          batch: { select: { id: true, name: true } },
          semester: { select: { id: true, name: true } },
        },
      },
      placementProfile: { select: { placementStatus: true, portfolioUrl: true, githubUrl: true, linkedInUrl: true } },
      _count: { select: { placementApplicationsOwned: true, placementOffers: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

async function assertPlacementStudentOwner(institutionId: string, actor: AuthenticatedUser, studentId: string) {
  assertInstitution(actor, institutionId);
  if (activeWorkspace(actor) !== "STUDENT" || actor.id !== studentId) {
    throw new AppError("Only the owning student may edit this placement profile data.", 403);
  }
}

export async function upsertPlacementSkill(institutionId: string, actor: AuthenticatedUser, skillId: string, input: { proficiency: number; evidence?: string | null }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  if (!Number.isInteger(input.proficiency) || input.proficiency < 0 || input.proficiency > 100) throw new AppError("Skill proficiency must be between 0 and 100.", 400);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, institutionId, isActive: true }, select: { id: true } });
  if (!skill) throw new AppError("Skill is not available for this institution.", 404);
  const row = await prisma.studentSkill.upsert({
    where: { studentId_skillId: { studentId: actor.id, skillId } },
    create: { institutionId, studentId: actor.id, skillId, proficiency: input.proficiency, evidence: input.evidence?.trim() || null },
    update: { proficiency: input.proficiency, evidence: input.evidence?.trim() || null },
    include: { skill: true },
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.skill.updated", entityType: "StudentSkill", entityId: actor.id + ":" + skillId, metadata: { proficiency: input.proficiency } });
  return row;
}

export async function deletePlacementSkill(institutionId: string, actor: AuthenticatedUser, skillId: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  await prisma.studentSkill.deleteMany({ where: { institutionId, studentId: actor.id, skillId } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.skill.deleted", entityType: "StudentSkill", entityId: actor.id + ":" + skillId, metadata: {} });
}

export async function createPlacementCertification(institutionId: string, actor: AuthenticatedUser, input: { name: string; issuer?: string; issuedAt?: string; credentialUrl?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementCertification.create({ data: { institutionId, studentId: actor.id, name: input.name.trim(), issuer: input.issuer?.trim() || null, issuedAt: input.issuedAt ? new Date(input.issuedAt) : null, credentialUrl: input.credentialUrl?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.certification.created", entityType: "PlacementCertification", entityId: row.id, metadata: {} });
  return row;
}

export async function deletePlacementCertification(institutionId: string, actor: AuthenticatedUser, id: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementCertification.findFirst({ where: { id, institutionId, studentId: actor.id }, select: { id: true } });
  if (!row) throw new AppError("Certification not found.", 404);
  await prisma.placementCertification.delete({ where: { id } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.certification.deleted", entityType: "PlacementCertification", entityId: id, metadata: {} });
}

export async function createPlacementProject(institutionId: string, actor: AuthenticatedUser, input: { title: string; description?: string; technologies?: string[]; projectUrl?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementProject.create({ data: { institutionId, studentId: actor.id, title: input.title.trim(), description: input.description?.trim() || null, technologies: input.technologies ?? [], projectUrl: input.projectUrl?.trim() || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.project.created", entityType: "PlacementProject", entityId: row.id, metadata: {} });
  return row;
}

export async function deletePlacementProject(institutionId: string, actor: AuthenticatedUser, id: string) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.placementProject.findFirst({ where: { id, institutionId, studentId: actor.id }, select: { id: true } });
  if (!row) throw new AppError("Project not found.", 404);
  await prisma.placementProject.delete({ where: { id } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.project.deleted", entityType: "PlacementProject", entityId: id, metadata: {} });
}

export async function createPlacementResume(institutionId: string, actor: AuthenticatedUser, input: { url: string; fileName?: string }) {
  await assertPlacementStudentOwner(institutionId, actor, actor.id);
  const row = await prisma.$transaction(async (tx) => {
    await tx.placementResume.updateMany({ where: { institutionId, studentId: actor.id }, data: { isCurrent: false } });
    return tx.placementResume.create({ data: { institutionId, studentId: actor.id, url: input.url, fileName: input.fileName?.trim() || null, isCurrent: true } });
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.resume.created", entityType: "PlacementResume", entityId: row.id, metadata: {} });
  return row;
}

export async function listPlacementTests(institutionId: string, actor: AuthenticatedUser, options: { studentId?: string; driveId?: string } = {}) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!actor.permissions.includes("placements.read")) throw new AppError("Placement access is not permitted.", 403);
  const workspace = activeWorkspace(actor);
  const target = workspace === "STUDENT" ? actor.id : options.studentId;
  if (target) await assertCanViewStudent(institutionId, actor, target);
  const studentWhere = target ? { id: target } : await getPlacementStudentScope(institutionId, actor);
  const directorScope = workspace === "DIRECTOR";
  const directorCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && directorCampusIds.length === 0) throw new AppError("No campus scope is assigned to this director.", 403);
  return prisma.placementTest.findMany({
    where: {
      institutionId,
      ...(options.driveId ? { driveId: options.driveId } : {}),
      ...(directorScope ? { drive: { campusId: { in: directorCampusIds } } } : {}),
      ...(workspace === "STUDENT" ? {
        status: { notIn: ["CANCELLED", "DRAFT"] },
        participants: { some: { studentId: actor.id } },
        drive: { status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "ACCEPTED", "JOINED"] } },
      } : {}),
      ...(!["SUPER_ADMIN","INSTITUTION_ADMIN","CHAIRMAN","MANAGEMENT","REGISTRAR","PLACEMENT"].includes(activeWorkspace(actor)) ? { participants: { some: { student: studentWhere } } } : {}),
    },
    include: {
      drive: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
      participants: { where: target ? { studentId: target } : undefined, select: { studentId: true, attendanceStatus: true, resultStatus: true, score: true, feedback: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 100,
  });
}

export async function createPlacementTest(
  institutionId: string,
  actor: AuthenticatedUser,
  input: { driveId: string; title: string; mode?: string; scheduledAt: string; durationMinutes?: number; maxScore?: number; testLink?: string; instructions?: string; status?: "DRAFT" | "SCHEDULED"; studentIds?: string[]; targeting?: PlacementCohortTargeting },
) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({
    where: { id: input.driveId, institutionId },
    select: { id: true, status: true, campusId: true, eligibleDepartments: true, opportunityId: true },
  });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (!["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "ACCEPTED", "JOINED"].includes(drive.status)) {
    throw new AppError("Publish the placement drive before scheduling assessments.", 409);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!drive.campusId || !campusIds.includes(drive.campusId)) {
      throw new AppError("The linked drive is outside the director's authorised campus scope.", 403);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targetedDepartments = Array.isArray(drive.eligibleDepartments)
      ? drive.eligibleDepartments.filter((id): id is string => typeof id === "string")
      : [];
    if (!targetedDepartments.length || !targetedDepartments.some((id) => departmentIds.includes(id))) {
      throw new AppError("The linked drive is outside the authorised department scope.", 403);
    }
  }

  const driveApplications = await prisma.application.findMany({
    where: {
      institutionId,
      OR: [
        { placementDriveId: drive.id },
        ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
      ],
      status: { in: ["SHORTLISTED", "TEST"] },
    },
    select: { studentId: true },
    orderBy: { studentId: "asc" },
    take: 10000,
  });
  const driveCandidateIds = new Set(driveApplications.map((application) => application.studentId));
  const cohortTargetIds = await resolvePlacementCohortAudience(institutionId, input.targeting);
  const explicitStudentIds = input.studentIds ?? [];
  if (new Set(explicitStudentIds).size !== explicitStudentIds.length) {
    throw new AppError("The explicitly selected assessment audience contains duplicate student IDs.", 422);
  }
  if (explicitStudentIds.length) {
    const eligibleExplicit = await prisma.user.findMany({
      where: {
        institutionId, id: { in: explicitStudentIds },
        userRoles: { some: { role: { name: "STUDENT" } } },
        studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (eligibleExplicit.length !== explicitStudentIds.length) {
      throw new AppError("Every explicitly selected assessment candidate must be an actively enrolled student in this institution.", 422);
    }
    if (explicitStudentIds.some((studentId) => !driveCandidateIds.has(studentId))) {
      throw new AppError("Every explicitly selected assessment candidate must have a shortlisted/test-stage application for this drive.", 422);
    }
  }
  const cohortStudentIds = cohortTargetIds.filter((studentId) => driveCandidateIds.has(studentId));
  const hasCohortFilters = Boolean(
    input.targeting && (
      input.targeting.campusIds?.length || input.targeting.programIds?.length ||
      input.targeting.departmentIds?.length || input.targeting.batchIds?.length ||
      input.targeting.graduatingYears?.length || input.targeting.semesterIds?.length ||
      input.targeting.sectionIds?.length
    ),
  );
  if (hasCohortFilters && cohortTargetIds.length === 0 && explicitStudentIds.length === 0) {
    throw new AppError("The selected placement cohort contains no active students.", 422);
  }
  if (hasCohortFilters && cohortStudentIds.length === 0 && explicitStudentIds.length === 0) {
    throw new AppError("No shortlisted or test-stage applicants for this drive match the selected cohort.", 422);
  }
  const targetedStudentIds = [...new Set([...explicitStudentIds, ...cohortStudentIds])];
  const participantIds = targetedStudentIds.length ? targetedStudentIds : [...driveCandidateIds];
  if (participantIds.length) {
    const studentAccounts = await prisma.user.findMany({
      where: {
        institutionId, id: { in: participantIds },
        userRoles: { some: { role: { name: "STUDENT" } } },
      },
      select: { id: true },
    });
    if (studentAccounts.length !== participantIds.length) {
      throw new AppError("Every assessment participant must have a Student account in this institution.", 422);
    }
  }
  await Promise.all(participantIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  const initialStatus = input.status ?? "SCHEDULED";
  const scheduledStart = new Date(input.scheduledAt);
  const durationMinutes = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 60;
  const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60_000);
  if (Number.isNaN(scheduledStart.getTime())) throw new AppError("Assessment time is invalid.", 422);
  if (initialStatus === "SCHEDULED" && participantIds.length === 0) {
    throw new AppError("Schedule only after selecting a candidate list or cohort. Save a draft while configuring the audience.", 422);
  }
  const row = await prisma.$transaction(async (tx) => {
    if (initialStatus === "SCHEDULED") {
      await assertNoPlacementScheduleConflicts(tx, institutionId, participantIds, scheduledStart, scheduledEnd);
    }
    const created = await tx.placementTest.create({
      data: {
        institutionId,
        driveId: input.driveId,
        title: input.title.trim(),
        mode: input.mode?.trim() || "ONLINE",
        status: initialStatus,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        maxScore: input.maxScore,
        testLink: input.testLink?.trim() || null,
        instructions: input.instructions?.trim() || null,
      },
    });
    if (participantIds.length) {
      await tx.placementTestParticipant.createMany({
        data: participantIds.map((studentId) => ({ testId: created.id, studentId })),
        skipDuplicates: true,
      });
      if (initialStatus === "SCHEDULED") {
        await advanceApplicationsForScheduledRound(
          tx, institutionId, actor.id, drive.id, drive.opportunityId, participantIds, "TEST",
        );
        await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
          eventType: "test",
          eventId: created.id,
          version: "created",
          recipientIds: participantIds,
        });
      }
    }
    return created;
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "placements.test.created",
    entityType: "PlacementTest",
    entityId: row.id,
    metadata: { driveId: input.driveId, assignedStudents: participantIds.length },
  });
  return row;
}

export async function addPlacementTestParticipant(institutionId: string, actor: AuthenticatedUser, testId: string, studentId: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  await assertCanViewStudent(institutionId, actor, studentId);
  const targetStudent = await prisma.user.findFirst({
    where: {
      id: studentId, institutionId,
      userRoles: { some: { role: { name: "STUDENT" } } },
      studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
    },
    select: { id: true },
  });
  if (!targetStudent) throw new AppError("Candidate must be an actively enrolled student in this institution.", 422);
  const test = await prisma.placementTest.findFirst({
    where: { id: testId, institutionId },
    select: { id: true, status: true, driveId: true, drive: { select: { campusId: true, eligibleDepartments: true, opportunityId: true } } },
  });
  if (!test) throw new AppError("Placement test not found.", 404);
  if (test.status === "CANCELLED") throw new AppError("Cancelled assessments cannot receive new candidate assignments.", 409);
  const candidateApplication = await prisma.application.findFirst({
    where: {
      institutionId, studentId,
      OR: [
        { placementDriveId: test.driveId },
        ...(test.drive.opportunityId ? [{ opportunityId: test.drive.opportunityId }] : []),
      ],
      status: { in: ["SHORTLISTED", "TEST"] },
    },
    select: { id: true },
  });
  if (!candidateApplication) {
    throw new AppError("Only a shortlisted or test-stage applicant for this drive can be assigned to its assessment.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campuses = await getDirectorCampusIds(institutionId, actor.id);
    if (!test.drive.campusId || !campuses.includes(test.drive.campusId)) {
      throw new AppError("Placement assessment not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departments = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(test.drive.eligibleDepartments)
      ? test.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((value) => departments.includes(value))) {
      throw new AppError("Placement assessment not found in the authorised department scope.", 404);
    }
  }
  const participant = await prisma.$transaction(async (tx) => {
    const existing = await tx.placementTestParticipant.findUnique({
      where: { testId_studentId: { testId, studentId } },
      select: { testId: true },
    });
    const row = await tx.placementTestParticipant.upsert({
      where: { testId_studentId: { testId, studentId } },
      create: { testId, studentId },
      update: {},
    });
    if (!existing && test.status === "SCHEDULED") {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "test", eventId: testId, version: "assigned", recipientIds: [studentId],
      });
    }
    return row;
  });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.test.participant_added", entityType: "PlacementTestParticipant", entityId: testId + ":" + studentId, metadata: { testId, studentId } });
  return participant;
}

export async function updatePlacementTestParticipant(institutionId: string, actor: AuthenticatedUser, testId: string, studentId: string, input: { attendanceStatus?: string; resultStatus?: string; score?: number | null; feedback?: string | null }) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const row = await prisma.placementTestParticipant.findFirst({ where: { testId, studentId, test: { institutionId } } });
  if (!row) throw new AppError("Test participant not found.", 404);
  if (input.score != null && input.score < 0) throw new AppError("Score cannot be negative.", 400);
  const updated = await prisma.placementTestParticipant.update({ where: { testId_studentId: { testId, studentId } }, data: input });
  await recordAuditLog({ institutionId, userId: actor.id, action: "placements.test.participant_updated", entityType: "PlacementTestParticipant", entityId: testId + ":" + studentId, metadata: input });
  return updated;
}


export async function listPlacementCriteriaOptions(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (!isPlacementManager(actor) || !actor.permissions.includes("placements.read")) {
    throw new AppError("Placement criteria access is not permitted.", 403);
  }

  const workspace = activeWorkspace(actor);
  const directorScope = workspace === "DIRECTOR";
  const departmentScope = ["DEAN", "HOD", "FACULTY"].includes(workspace);
  const assignedCampusIds = directorScope ? await getDirectorCampusIds(institutionId, actor.id) : [];
  if (directorScope && !assignedCampusIds.length) throw new AppError("No campus scope is assigned to this director.", 403);
  const assignedDepartmentIds = departmentScope ? await getAuthorizedDepartmentIds(institutionId, actor) : [];

  const campuses = await prisma.campus.findMany({
    where: { institutionId, isActive: true, ...(directorScope ? { id: { in: assignedCampusIds } } : {}) },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  });
  const departments = await prisma.department.findMany({
    where: {
      institutionId, isActive: true,
      ...(directorScope ? { campusId: { in: assignedCampusIds } } : {}),
      ...(departmentScope ? { id: { in: assignedDepartmentIds } } : {}),
    },
    select: { id: true, name: true, campusId: true }, orderBy: { name: "asc" },
  });
  const departmentIds = departments.map((item) => item.id);
  const programs = await prisma.program.findMany({
    where: { institutionId, isActive: true, ...(directorScope || departmentScope ? { departmentId: { in: departmentIds } } : {}) },
    select: { id: true, name: true, departmentId: true }, orderBy: { name: "asc" },
  });
  const programIds = programs.map((item) => item.id);
  const [batches, semesters, academicYears, skills] = await Promise.all([
    prisma.batch.findMany({
      where: { institutionId, isActive: true, ...(directorScope || departmentScope ? { programId: { in: programIds } } : {}) },
      select: { id: true, name: true, programId: true, admissionYear: true, completionYear: true }, orderBy: { admissionYear: "desc" },
    }),
    prisma.semester.findMany({
      where: { institutionId, isActive: true, ...(directorScope || departmentScope ? { programId: { in: programIds } } : {}) },
      select: { id: true, name: true, programId: true, academicYearId: true, number: true }, orderBy: [{ number: "asc" }, { name: "asc" }],
    }),
    prisma.academicYear.findMany({ where: { institutionId }, select: { id: true, name: true }, orderBy: { name: "desc" } }),
    prisma.skill.findMany({ where: { institutionId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const semesterIds = semesters.map((item) => item.id);
  const sections = await prisma.section.findMany({
    where: {
      institutionId, isActive: true,
      ...(directorScope || departmentScope ? { semesterId: { in: semesterIds } } : {}),
    },
    select: { id: true, name: true, semesterId: true }, orderBy: [{ semesterId: "asc" }, { name: "asc" }],
  });
  return { campuses, departments, programs, batches, semesters, sections, academicYears, skills };
}

export async function updatePlacementInterview(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: { startsAt?: string; endsAt?: string | null; venue?: string | null; onlineLink?: string | null; status?: "DRAFT" | "SCHEDULED" | "CANCELLED" },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.placementInterview.findFirst({
    where: { id, institutionId },
    select: {
      id: true, status: true, startsAt: true, endsAt: true, venue: true, onlineLink: true, updatedAt: true,
      participants: { select: { studentId: true } }, roundType: true, roundNumber: true,
      drive: { select: { campusId: true, eligibleDepartments: true, opportunityId: true } },
    },
  });
  if (!existing) throw new AppError("Placement interview not found.", 404);
  if (existing.status === "CANCELLED") throw new AppError("Cancelled interviews cannot be changed.", 409);
  if (existing.status === "SCHEDULED" && input.status === "DRAFT") throw new AppError("A scheduled interview cannot be returned to draft.", 409);
  if (existing.status === "DRAFT" && input.status === "SCHEDULED" && existing.participants.length === 0) {
    throw new AppError("Assign at least one authorised candidate before publishing this interview.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!existing.drive.campusId || !campusIds.includes(existing.drive.campusId)) {
      throw new AppError("Placement interview not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(existing.drive.eligibleDepartments)
      ? existing.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((departmentId) => departmentIds.includes(departmentId))) {
      throw new AppError("Placement interview not found in the authorised department scope.", 404);
    }
  }

  const nextStartsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const nextEndsAt = input.endsAt === undefined ? existing.endsAt : input.endsAt ? new Date(input.endsAt) : null;
  if (Number.isNaN(nextStartsAt.getTime()) || (nextEndsAt && (Number.isNaN(nextEndsAt.getTime()) || nextEndsAt < nextStartsAt))) {
    throw new AppError("Interview end time must not be before its start time.", 422);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const targetStatus = input.status ?? existing.status;
    const scheduleChanged = existing.status !== "SCHEDULED" ||
      nextStartsAt.getTime() !== existing.startsAt.getTime() ||
      (nextEndsAt?.getTime() ?? null) !== (existing.endsAt?.getTime() ?? null);
    if (targetStatus === "SCHEDULED" && scheduleChanged) {
      const conflictEnd = nextEndsAt ?? new Date(nextStartsAt.getTime() + 60 * 60_000);
      await assertNoPlacementScheduleConflicts(
        tx, institutionId, existing.participants.map((participant) => participant.studentId),
        nextStartsAt, conflictEnd, { interviewId: id },
      );
    }
    const changed = await tx.placementInterview.updateMany({
      where: { id, institutionId, status: existing.status, startsAt: existing.startsAt, updatedAt: existing.updatedAt },
      data: {
        ...(input.startsAt ? { startsAt: nextStartsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: nextEndsAt } : {}),
        ...(input.venue !== undefined ? { venue: input.venue?.trim() || null } : {}),
        ...(input.onlineLink !== undefined ? { onlineLink: input.onlineLink?.trim() || null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    if (changed.count !== 1) throw new AppError("This interview was updated by another user. Refresh and try again.", 409);
    const row = await tx.placementInterview.findFirst({ where: { id, institutionId } });
    if (!row) throw new AppError("Placement interview not found.", 404);

    const recipientIds = existing.participants.map((participant) => participant.studentId);
    if (existing.status === "DRAFT" && row.status === "SCHEDULED") {
      await advanceApplicationsForScheduledRound(
        tx, institutionId, actor.id, row.driveId, existing.drive.opportunityId,
        recipientIds, "INTERVIEW",
      );
    }
    let version: string | null = null;
    if (existing.status === "SCHEDULED" && input.status === "CANCELLED") {
      version = "cancelled";
    } else if (existing.status === "DRAFT" && row.status === "SCHEDULED") {
      version = "published";
    } else if (existing.status === "SCHEDULED" && row.status === "SCHEDULED") {
      const moved = nextStartsAt.getTime() !== existing.startsAt.getTime() ||
        (nextEndsAt?.getTime() ?? null) !== (existing.endsAt?.getTime() ?? null);
      const nextVenue = input.venue === undefined ? existing.venue : input.venue?.trim() || null;
      const nextOnlineLink = input.onlineLink === undefined ? existing.onlineLink : input.onlineLink?.trim() || null;
      const detailsChanged = moved || nextVenue !== existing.venue || nextOnlineLink !== existing.onlineLink;
      if (detailsChanged) version = moved ? `rescheduled:${row.startsAt.toISOString()}` : `updated:${row.updatedAt.toISOString()}`;
    }
    if (version && recipientIds.length) {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "interview", eventId: id, version, recipientIds,
      });
    }
    return row;
  });
  await recordAuditLog({
    institutionId, userId: actor.id,
    action: input.status === "CANCELLED" ? "placements.interview.cancelled" : "placements.interview.updated",
    entityType: "PlacementInterview", entityId: id,
    metadata: { status: updated.status, startsAt: updated.startsAt.toISOString() },
  });
  return updated;
}

export async function updatePlacementTest(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: { scheduledAt?: string; testLink?: string | null; instructions?: string | null; status?: "DRAFT" | "SCHEDULED" | "CANCELLED" },
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.placementTest.findFirst({
    where: { id, institutionId },
    select: {
      id: true, status: true, scheduledAt: true, title: true, testLink: true, instructions: true, durationMinutes: true, updatedAt: true,
      participants: { select: { studentId: true } },
      drive: { select: { campusId: true, eligibleDepartments: true, opportunityId: true } },
    },
  });
  if (!existing) throw new AppError("Placement assessment not found.", 404);
  if (existing.status === "CANCELLED") throw new AppError("Cancelled assessments cannot be changed.", 409);
  if (existing.status === "SCHEDULED" && input.status === "DRAFT") throw new AppError("A scheduled assessment cannot be returned to draft.", 409);
  if (existing.status === "DRAFT" && input.status === "SCHEDULED" && existing.participants.length === 0) {
    throw new AppError("Assign at least one authorised candidate before publishing this assessment.", 422);
  }
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!existing.drive.campusId || !campusIds.includes(existing.drive.campusId)) {
      throw new AppError("Placement assessment not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departmentIds = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(existing.drive.eligibleDepartments)
      ? existing.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((departmentId) => departmentIds.includes(departmentId))) {
      throw new AppError("Placement assessment not found in the authorised department scope.", 404);
    }
  }
  const nextScheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : existing.scheduledAt;
  if (Number.isNaN(nextScheduledAt.getTime())) throw new AppError("Assessment time is invalid.", 422);

  const updated = await prisma.$transaction(async (tx) => {
    const targetStatus = input.status ?? existing.status;
    const scheduleChanged = existing.status !== "SCHEDULED" ||
      nextScheduledAt.getTime() !== existing.scheduledAt.getTime();
    if (targetStatus === "SCHEDULED" && scheduleChanged) {
      const conflictDuration = existing.durationMinutes && existing.durationMinutes > 0 ? existing.durationMinutes : 60;
      const conflictEnd = new Date(nextScheduledAt.getTime() + conflictDuration * 60_000);
      await assertNoPlacementScheduleConflicts(
        tx, institutionId, existing.participants.map((participant) => participant.studentId),
        nextScheduledAt, conflictEnd, { testId: id },
      );
    }
    const changed = await tx.placementTest.updateMany({
      where: { id, institutionId, status: existing.status, scheduledAt: existing.scheduledAt, updatedAt: existing.updatedAt },
      data: {
        ...(input.scheduledAt ? { scheduledAt: nextScheduledAt } : {}),
        ...(input.testLink !== undefined ? { testLink: input.testLink?.trim() || null } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions?.trim() || null } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });
    if (changed.count !== 1) throw new AppError("This assessment was updated by another user. Refresh and try again.", 409);
    const row = await tx.placementTest.findFirst({ where: { id, institutionId } });
    if (!row) throw new AppError("Placement assessment not found.", 404);
    const recipientIds = existing.participants.map((participant) => participant.studentId);
    if (existing.status === "DRAFT" && row.status === "SCHEDULED") {
      await advanceApplicationsForScheduledRound(
        tx, institutionId, actor.id, row.driveId, existing.drive.opportunityId,
        recipientIds, "TEST",
      );
    }
    let version: string | null = null;
    if (existing.status === "SCHEDULED" && input.status === "CANCELLED") {
      version = "cancelled";
    } else if (existing.status === "DRAFT" && row.status === "SCHEDULED") {
      version = "published";
    } else if (existing.status === "SCHEDULED" && row.status === "SCHEDULED") {
      const moved = nextScheduledAt.getTime() !== existing.scheduledAt.getTime();
      const nextTestLink = input.testLink === undefined ? existing.testLink : input.testLink?.trim() || null;
      const nextInstructions = input.instructions === undefined ? existing.instructions : input.instructions?.trim() || null;
      const detailsChanged = moved || nextTestLink !== existing.testLink || nextInstructions !== existing.instructions;
      if (detailsChanged) version = moved ? `rescheduled:${row.scheduledAt.toISOString()}` : `updated:${row.updatedAt.toISOString()}`;
    }
    if (version && recipientIds.length) {
      await enqueuePlacementEvent(tx, institutionId, actor.id, "placement.schedule.changed", {
        eventType: "test", eventId: id, version, recipientIds,
      });
    }
    return row;
  });
  await recordAuditLog({
    institutionId, userId: actor.id,
    action: input.status === "CANCELLED" ? "placements.test.cancelled" : "placements.test.updated",
    entityType: "PlacementTest", entityId: id,
    metadata: { status: updated.status, scheduledAt: updated.scheduledAt.toISOString() },
  });
  return updated;
}

export async function previewPlacementCohortAudience(
  institutionId: string,
  actor: AuthenticatedUser,
  targeting?: PlacementCohortTargeting,
  explicitStudentIds: string[] = [],
  driveId?: string,
  applicationStatuses: string[] = [],
  candidateOnly = false,
) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const hasCohortFilters = Boolean(
    targeting && (
      targeting.campusIds?.length || targeting.programIds?.length ||
      targeting.departmentIds?.length || targeting.batchIds?.length ||
      targeting.semesterIds?.length || targeting.sectionIds?.length ||
      targeting.graduatingYears?.length
    ),
  );
  const explicitIds = [...new Set(explicitStudentIds)];
  if (!hasCohortFilters && explicitIds.length === 0 && !(driveId && applicationStatuses.length)) {
    throw new AppError("Select a cohort criterion, individual student, or recruitment stage before previewing the audience.", 422);
  }

  const cohortIds = hasCohortFilters ? await resolvePlacementCohortAudience(institutionId, targeting) : [];
  let applicationStudentIds: string[] = [];
  if (driveId && applicationStatuses.length) {
    const drive = await prisma.placementDrive.findFirst({
      where: { id: driveId, institutionId },
      select: { id: true, campusId: true, eligibleDepartments: true, opportunityId: true },
    });
    if (!drive) throw new AppError("Placement drive not found in this institution.", 404);
    if (activeWorkspace(actor) === "DIRECTOR") {
      const campusIds = await getDirectorCampusIds(institutionId, actor.id);
      if (!drive.campusId || !campusIds.includes(drive.campusId)) {
        throw new AppError("Placement drive is outside the director's authorised campus scope.", 403);
      }
    }
    if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
      const departments = await getAuthorizedDepartmentIds(institutionId, actor);
      const targeted = Array.isArray(drive.eligibleDepartments)
        ? drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
        : [];
      if (!targeted.length || !targeted.some((id) => departments.includes(id))) {
        throw new AppError("Placement drive is outside the authorised department scope.", 403);
      }
    }
    const applications = await prisma.application.findMany({
      where: {
        institutionId,
        OR: [
          { placementDriveId: drive.id },
          ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
        ],
        status: { in: applicationStatuses },
      },
      select: { studentId: true },
      orderBy: { studentId: "asc" },
      take: 10000,
    });
    applicationStudentIds = [...new Set(applications.map((application) => application.studentId))];
  }

  const targetedIds = [...new Set([...cohortIds, ...explicitIds])];
  const applicationSet = new Set(applicationStudentIds);
  let allIds: string[];
  if (candidateOnly) {
    if (!driveId || applicationStatuses.length === 0) {
      throw new AppError("Drive and candidate stage filters are required for a candidate-only preview.", 422);
    }
    allIds = targetedIds.length
      ? targetedIds.filter((studentId) => applicationSet.has(studentId))
      : applicationStudentIds;
  } else {
    // A linked activity uses a cohort or individual audience when one was
    // configured; only an otherwise-unscoped drive activity defaults to its
    // actual applicants.
    allIds = targetedIds.length ? targetedIds : applicationStudentIds;
  }
  allIds = [...new Set(allIds)];
  if (!allIds.length) return { matchingCount: 0, sample: [], truncated: false };
  const studentRows = await prisma.user.findMany({
    where: { institutionId, id: { in: allIds }, userRoles: { some: { role: { name: "STUDENT" } } } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { id: "asc" },
    take: 10000,
  });
  if (studentRows.length !== allIds.length) {
    throw new AppError("The audience includes a non-student or a student outside this institution.", 422);
  }
  if (explicitIds.length) {
    const activelyEnrolledExplicit = await prisma.user.findMany({
      where: {
        institutionId, id: { in: explicitIds },
        studentEnrollments: { some: { institutionId, status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (activelyEnrolledExplicit.length !== explicitIds.length) {
      throw new AppError("Individually selected students must have an active enrollment.", 422);
    }
  }
  await Promise.all(allIds.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
  return {
    matchingCount: allIds.length,
    sample: studentRows.slice(0, 10),
    truncated: allIds.length >= 10000,
  };
}

export async function getMyPlacementCalendar(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  await assertPlacementEntitlement(institutionId);
  if (activeWorkspace(actor) !== "STUDENT") {
    throw new AppError("This calendar endpoint is for the authenticated student.", 403);
  }
  await assertCanViewStudent(institutionId, actor, actor.id);

  const [applications, drives, interviews, tests, visits, offers] = await Promise.all([
    prisma.application.findMany({
      where: { institutionId, studentId: actor.id },
      select: { id: true, placementDriveId: true, opportunityId: true, status: true },
      take: 500,
    }),
    prisma.placementDrive.findMany({
      where: {
        institutionId,
        status: { in: ["PUBLISHED", "APPLICATION_OPEN", "APPLICATION_CLOSED", "SHORTLISTING", "TEST", "INTERVIEW", "OFFERED", "CANCELLED"] },
        driveDate: { not: null },
      },
      select: {
        id: true, title: true, status: true, driveDate: true, applicationDeadline: true,
        venue: true, onlineLink: true, campusId: true,
        eligiblePrograms: true, eligibleDepartments: true, eligibleBatches: true, eligibleSemesters: true,
        cgpaRequirement: true, maxBacklogs: true, requiredSkills: true, academicRequirements: true,
        opportunityId: true,
        company: { select: { name: true } },
      },
      orderBy: { driveDate: "asc" },
      take: 100,
    }),
    prisma.placementInterview.findMany({
      where: {
        institutionId,
        participants: { some: { studentId: actor.id } },
        status: { in: ["SCHEDULED", "CANCELLED"] },
      },
      select: {
        id: true, roundType: true, roundNumber: true, startsAt: true, endsAt: true,
        venue: true, onlineLink: true, status: true,
        drive: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.placementTest.findMany({
      where: {
        institutionId,
        participants: { some: { studentId: actor.id } },
        status: { in: ["SCHEDULED", "CANCELLED"] },
      },
      select: {
        id: true, title: true, scheduledAt: true, durationMinutes: true, testLink: true,
        instructions: true, status: true,
        drive: { select: { id: true, title: true, company: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    }),
    prisma.placementVisit.findMany({
      where: {
        institutionId,
        status: { in: ["PUBLISHED", "CANCELLED"] },
        participatingStudentIds: { array_contains: [actor.id] },
      },
      select: {
        id: true, type: true, startsAt: true, endsAt: true, venue: true, purpose: true, status: true,
        company: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.placementOffer.findMany({
      where: {
        institutionId, studentId: actor.id,
        status: { notIn: ["REJECTED", "WITHDRAWN"] },
        OR: [{ joiningDate: { not: null } }, { responseDeadline: { not: null } }],
      },
      select: {
        id: true, role: true, responseDeadline: true, joiningDate: true, joiningStatus: true, status: true,
        company: { select: { name: true } },
      },
      orderBy: { joiningDate: "asc" },
      take: 100,
    }),
  ]);

  const applicationDriveIds = new Set(applications.map((item) => item.placementDriveId).filter((id): id is string => Boolean(id)));
  const applicationOpportunityIds = new Set(applications.map((item) => item.opportunityId));
  const calendar: Array<{
    id: string; type: string; title: string; company: string; startsAt: string;
    endsAt: string | null; status: string; venue: string; actionUrl: string;
  }> = [];

  for (const drive of drives) {
    const hasApplied = applicationDriveIds.has(drive.id) || Boolean(drive.opportunityId && applicationOpportunityIds.has(drive.opportunityId));
    if (!hasApplied && !["PUBLISHED", "APPLICATION_OPEN", "CANCELLED"].includes(drive.status)) continue;
    if (!hasApplied) {
      const eligibility = await checkDriveEligibility(institutionId, actor, drive.id);
      const reasons = eligibility.reasons.filter((reason) =>
        reason !== "Applications are not open for this drive." &&
        reason !== "You have already applied to this drive."
      );
      if (reasons.length) continue;
    }
    calendar.push({
      id: `drive:${drive.id}`,
      type: "DRIVE",
      title: drive.title,
      company: drive.company.name,
      startsAt: drive.driveDate!.toISOString(),
      endsAt: null,
      status: drive.status,
      venue: drive.venue || drive.onlineLink || "",
      actionUrl: "/student/placements",
    });
    if (drive.applicationDeadline && drive.status === "APPLICATION_OPEN") {
      calendar.push({
        id: `drive-deadline:${drive.id}`,
        type: "DEADLINE",
        title: `${drive.title} registration deadline`,
        company: drive.company.name,
        startsAt: drive.applicationDeadline.toISOString(),
        endsAt: null,
        status: drive.status,
        venue: "",
        actionUrl: "/student/placements",
      });
    }
  }

  for (const item of interviews) {
    calendar.push({
      id: `interview:${item.id}`, type: "INTERVIEW",
      title: `${item.roundType} interview · Round ${item.roundNumber} · ${item.drive.title}`,
      company: item.drive.company.name, startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() ?? null, status: item.status,
      venue: item.venue || item.onlineLink || "", actionUrl: "/student/placements",
    });
  }
  for (const item of tests) {
    calendar.push({
      id: `test:${item.id}`, type: "ASSESSMENT",
      title: item.title, company: item.drive.company.name,
      startsAt: item.scheduledAt.toISOString(),
      endsAt: item.durationMinutes ? new Date(item.scheduledAt.getTime() + item.durationMinutes * 60_000).toISOString() : null,
      status: item.status, venue: item.testLink || "",
      actionUrl: "/student/placements",
    });
  }
  for (const item of visits) {
    calendar.push({
      id: `visit:${item.id}`, type: "PLACEMENT_ACTIVITY",
      title: item.type, company: item.company.name, startsAt: item.startsAt.toISOString(),
      endsAt: item.endsAt?.toISOString() ?? null, status: item.status,
      venue: item.venue || "", actionUrl: "/student/placements",
    });
  }
  for (const item of offers) {
    if (item.responseDeadline && item.status === "OFFERED") {
      calendar.push({
        id: `offer-deadline:${item.id}`, type: "OFFER_DEADLINE",
        title: `Offer response deadline · ${item.role}`, company: item.company.name,
        startsAt: item.responseDeadline.toISOString(), endsAt: null,
        status: item.status, venue: "", actionUrl: "/student/placements",
      });
    }
    if (item.joiningDate) {
      calendar.push({
        id: `joining:${item.id}`, type: "JOINING",
        title: `Joining · ${item.role}`, company: item.company.name,
        startsAt: item.joiningDate.toISOString(), endsAt: null,
        status: item.joiningStatus || item.status, venue: "", actionUrl: "/student/placements",
      });
    }
  }
  return calendar.sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime());
}

export async function deletePlacementVisit(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const existing = await prisma.placementVisit.findFirst({
    where: { id, institutionId },
    select: { id: true, status: true, type: true },
  });
  if (!existing) throw new AppError("Placement activity not found.", 404);
  if (existing.status !== "DRAFT") {
    throw new AppError("Only unused draft activities may be permanently deleted. Published or historical activities must be cancelled instead.", 409);
  }
  await prisma.$transaction(async (tx) => {
    const removed = await tx.placementVisit.deleteMany({ where: { id, institutionId, status: "DRAFT" } });
    if (removed.count !== 1) throw new AppError("The activity changed before it could be deleted. Refresh and try again.", 409);
  });
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.visit.deleted",
    entityType: "PlacementVisit", entityId: id, metadata: { previousStatus: existing.status, type: existing.type },
  });
  return { id, deleted: true };
}

export async function deletePlacementDrive(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const drive = await prisma.placementDrive.findFirst({
    where: { id, institutionId },
    select: { id: true, title: true, status: true, opportunityId: true, campusId: true },
  });
  if (!drive) throw new AppError("Placement drive not found.", 404);
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campusIds = await getDirectorCampusIds(institutionId, actor.id);
    if (!drive.campusId || !campusIds.includes(drive.campusId)) throw new AppError("Placement drive not found in the director's authorised campus scope.", 404);
  }
  if (drive.status !== "DRAFT") {
    throw new AppError("Only unused draft drives may be permanently deleted. Published drives and recruitment history must be closed or retained.", 409);
  }
  const [applications, interviews, tests, visits] = await Promise.all([
    prisma.application.count({ where: { institutionId, OR: [
      { placementDriveId: id },
      ...(drive.opportunityId ? [{ opportunityId: drive.opportunityId }] : []),
    ] } }),
    prisma.placementInterview.count({ where: { institutionId, driveId: id } }),
    prisma.placementTest.count({ where: { institutionId, driveId: id } }),
    prisma.placementVisit.count({ where: { institutionId, driveId: id } }),
  ]);
  if (applications || interviews || tests || visits) {
    throw new AppError("This draft has dependent recruitment records and cannot be deleted. Cancel/archive it to preserve history.", 409);
  }
  await prisma.$transaction(async (tx) => {
    const removed = await tx.placementDrive.deleteMany({ where: { id, institutionId, status: "DRAFT" } });
    if (removed.count !== 1) throw new AppError("The drive changed before it could be deleted. Refresh and try again.", 409);
    if (drive.opportunityId) {
      await tx.opportunity.deleteMany({ where: { id: drive.opportunityId, institutionId } });
    }
  });
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.drive.deleted",
    entityType: "PlacementDrive", entityId: id, metadata: { title: drive.title, previousStatus: drive.status },
  });
  return { id, deleted: true };
}

export async function deletePlacementInterview(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const interview = await prisma.placementInterview.findFirst({
    where: { id, institutionId },
    select: { id: true, status: true, driveId: true, roundType: true, participants: { select: { studentId: true } }, drive: { select: { campusId: true, eligibleDepartments: true } } },
  });
  if (!interview) throw new AppError("Placement interview not found.", 404);
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campuses = await getDirectorCampusIds(institutionId, actor.id);
    if (!interview.drive.campusId || !campuses.includes(interview.drive.campusId)) {
      throw new AppError("Placement interview not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departments = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(interview.drive.eligibleDepartments)
      ? interview.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((departmentId) => departments.includes(departmentId))) {
      throw new AppError("Placement interview not found in the authorised department scope.", 404);
    }
  }
  if (interview.status !== "DRAFT" || interview.participants.length > 0) {
    throw new AppError("Only unused draft interviews with no candidate assignments may be permanently deleted. Cancel the interview to preserve its recruitment history.", 409);
  }
  await prisma.$transaction(async (tx) => {
    const removed = await tx.placementInterview.deleteMany({ where: { id, institutionId, status: "DRAFT" } });
    if (removed.count !== 1) throw new AppError("The interview changed before it could be deleted. Refresh and try again.", 409);
  });
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.interview.deleted",
    entityType: "PlacementInterview", entityId: id, metadata: { previousStatus: interview.status, roundType: interview.roundType, driveId: interview.driveId },
  });
  return { id, deleted: true };
}

export async function deletePlacementTest(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const test = await prisma.placementTest.findFirst({
    where: { id, institutionId },
    select: { id: true, status: true, driveId: true, title: true, participants: { select: { studentId: true } }, drive: { select: { campusId: true, eligibleDepartments: true } } },
  });
  if (!test) throw new AppError("Placement assessment not found.", 404);
  if (activeWorkspace(actor) === "DIRECTOR") {
    const campuses = await getDirectorCampusIds(institutionId, actor.id);
    if (!test.drive.campusId || !campuses.includes(test.drive.campusId)) {
      throw new AppError("Placement assessment not found in the director's authorised campus scope.", 404);
    }
  }
  if (["DEAN", "HOD", "FACULTY"].includes(activeWorkspace(actor))) {
    const departments = await getAuthorizedDepartmentIds(institutionId, actor);
    const targeted = Array.isArray(test.drive.eligibleDepartments)
      ? test.drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
      : [];
    if (!targeted.length || !targeted.some((departmentId) => departments.includes(departmentId))) {
      throw new AppError("Placement assessment not found in the authorised department scope.", 404);
    }
  }
  if (test.status !== "DRAFT" || test.participants.length > 0) {
    throw new AppError("Only unused draft assessments with no candidate assignments may be permanently deleted. Cancel the assessment to preserve its recruitment history.", 409);
  }
  await prisma.$transaction(async (tx) => {
    const removed = await tx.placementTest.deleteMany({ where: { id, institutionId, status: "DRAFT" } });
    if (removed.count !== 1) throw new AppError("The assessment changed before it could be deleted. Refresh and try again.", 409);
  });
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.test.deleted",
    entityType: "PlacementTest", entityId: id, metadata: { previousStatus: test.status, title: test.title, driveId: test.driveId },
  });
  return { id, deleted: true };
}


async function placementEventDriveId(institutionId: string, payload: unknown): Promise<string | null> {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const direct = typeof data.driveId === "string" ? data.driveId : null;
  if (direct) return direct;
  const applicationId = typeof data.applicationId === "string" ? data.applicationId : null;
  if (applicationId) {
    const app = await prisma.application.findFirst({
      where: { id: applicationId, institutionId },
      select: { placementDriveId: true, opportunityId: true },
    });
    if (app?.placementDriveId) return app.placementDriveId;
    if (app?.opportunityId) {
      const drive = await prisma.placementDrive.findFirst({
        where: { institutionId, opportunityId: app.opportunityId },
        select: { id: true },
      });
      if (drive) return drive.id;
    }
  }
  const eventType = typeof data.eventType === "string" ? data.eventType : null;
  const eventId = typeof data.eventId === "string" ? data.eventId : null;
  if (eventType && eventId) {
    if (eventType === "interview") {
      const interview = await prisma.placementInterview.findFirst({
        where: { id: eventId, institutionId }, select: { driveId: true },
      });
      if (interview?.driveId) return interview.driveId;
    } else if (eventType === "test") {
      const test = await prisma.placementTest.findFirst({
        where: { id: eventId, institutionId }, select: { driveId: true },
      });
      if (test?.driveId) return test.driveId;
    } else if (eventType === "visit") {
      const visit = await prisma.placementVisit.findFirst({
        where: { id: eventId, institutionId }, select: { driveId: true },
      });
      if (visit?.driveId) return visit.driveId;
    }
  }
  const offerId = typeof data.offerId === "string" ? data.offerId : null;
  if (offerId) {
    const offer = await prisma.placementOffer.findFirst({
      where: { id: offerId, institutionId },
      select: { applicationId: true },
    });
    if (offer?.applicationId) return placementEventDriveId(institutionId, { applicationId: offer.applicationId });
  }
  return null;
}

async function assertPlacementFailureScope(institutionId: string, actor: AuthenticatedUser, payload: unknown) {
  const workspace = activeWorkspace(actor);
  if (workspace === "DIRECTOR" || ["DEAN", "HOD", "FACULTY"].includes(workspace)) {
    const driveId = await placementEventDriveId(institutionId, payload);
    if (!driveId) {
      const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
      const recipients = Array.isArray(data.recipientIds)
        ? [...new Set(data.recipientIds.filter((value): value is string => typeof value === "string"))]
        : [];
      // Some company activities are institution-targeted without a linked drive.
      // Their recipient list is the available scope proof; validate every student.
      if (!recipients.length) throw new AppError("This automation event has no verifiable campus/department scope.", 403);
      await Promise.all(recipients.map((studentId) => assertCanViewStudent(institutionId, actor, studentId)));
      return;
    }
    const drive = await prisma.placementDrive.findFirst({
      where: { id: driveId, institutionId },
      select: { id: true, campusId: true, eligibleDepartments: true },
    });
    if (!drive) throw new AppError("Placement event not found in your authorised scope.", 404);
    if (workspace === "DIRECTOR") {
      const campuses = await getDirectorCampusIds(institutionId, actor.id);
      if (!drive.campusId || !campuses.includes(drive.campusId)) throw new AppError("Placement event not found in your authorised campus scope.", 404);
    } else {
      const departments = await getAuthorizedDepartmentIds(institutionId, actor);
      const targeted = Array.isArray(drive.eligibleDepartments)
        ? drive.eligibleDepartments.filter((value): value is string => typeof value === "string")
        : [];
      if (!targeted.length || !targeted.some((value) => departments.includes(value))) {
        throw new AppError("Placement event not found in your authorised department scope.", 404);
      }
    }
  }
}

export async function listPlacementAutomationFailures(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const events = await prisma.domainEventOutbox.findMany({
    where: {
      institutionId, processedAt: null, attempts: { gt: 0 },
      name: { startsWith: "placement." },
    },
    select: { id: true, name: true, attempts: true, lastError: true, createdAt: true, payload: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const visible = [];
  for (const event of events) {
    try {
      await assertPlacementFailureScope(institutionId, actor, event.payload);
      visible.push({
        id: event.id, name: event.name, attempts: event.attempts,
        lastError: event.lastError, createdAt: event.createdAt,
      });
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 403 && error.statusCode !== 404) throw error;
    }
  }
  return visible;
}

export async function retryPlacementAutomationFailure(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  const event = await prisma.domainEventOutbox.findFirst({
    where: { id, institutionId, processedAt: null, attempts: { gt: 0 }, name: { startsWith: "placement." } },
    select: { id: true, payload: true },
  });
  if (!event) throw new AppError("Retryable placement automation event not found.", 404);
  await assertPlacementFailureScope(institutionId, actor, event.payload);
  const result = await prisma.domainEventOutbox.updateMany({
    where: { id, institutionId, processedAt: null, attempts: { gt: 0 }, name: { startsWith: "placement." } },
    data: { attempts: 0, lastError: null, nextAttemptAt: null },
  });
  if (result.count !== 1) throw new AppError("The event is already processed or being retried. Refresh and try again.", 409);
  await recordAuditLog({
    institutionId, userId: actor.id, action: "placements.automation.retried",
    entityType: "DomainEventOutbox", entityId: id, metadata: { name: "placement event" },
  });
  return { id, queuedForRetry: true };
}
