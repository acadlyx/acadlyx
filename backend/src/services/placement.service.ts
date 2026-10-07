import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertCanViewStudent } from "./accessScope.service";
import { recordAuditLog } from "./audit.service";

const APPLICATION_TRANSITIONS: Record<string, string[]> = {
  APPLIED: ["SHORTLISTED", "REJECTED", "WITHDRAWN"],
  SHORTLISTED: ["INTERVIEW", "REJECTED", "WITHDRAWN"],
  INTERVIEW: ["OFFERED", "REJECTED", "WITHDRAWN"],
  OFFERED: ["ACCEPTED", "REJECTED", "WITHDRAWN"],
  ACCEPTED: ["JOINED", "WITHDRAWN"],
  JOINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

function isPlacementManager(actor: AuthenticatedUser): boolean {
  return actor.permissions.includes("placements.manage");
}

function assertInstitution(actor: AuthenticatedUser, institutionId: string): void {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.institutionId !== institutionId) throw new AppError("Institution context mismatch.", 403);
}

export async function listOpportunities(
  institutionId: string,
  actor: AuthenticatedUser,
  options: { search?: string; activeOnly?: boolean } = {},
) {
  assertInstitution(actor, institutionId);
  const now = new Date();
  return prisma.opportunity.findMany({
    where: {
      institutionId,
      ...(options.activeOnly !== false ? { isActive: true } : {}),
      ...(options.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { organization: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(actor.roles.includes("STUDENT")
        ? {
            OR: [
              { deadline: null },
              { deadline: { gte: now } },
            ],
          }
        : {}),
    },
    include: { targetRole: { select: { id: true, name: true } } },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
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
  if (!isPlacementManager(actor)) throw new AppError("Placement management authority is required.", 403);
  if (!input.title.trim() || !input.organization.trim()) {
    throw new AppError("Title and organization are required.", 400);
  }
  if (input.deadline && new Date(input.deadline).getTime() <= Date.now()) {
    throw new AppError("Opportunity deadline must be in the future.", 400);
  }
  if (input.targetRoleId) {
    const role = await prisma.targetRole.findFirst({ where: { id: input.targetRoleId }, select: { id: true } });
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
  if (!actor.roles.includes("STUDENT") || !actor.permissions.includes("placements.apply")) {
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
    const application = await prisma.application.create({
      data: { institutionId, studentId: actor.id, opportunityId },
      include: { opportunity: { select: { id: true, title: true, organization: true } } },
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
  const studentId = actor.roles.includes("STUDENT") ? actor.id : options.studentId;
  if (!actor.roles.includes("STUDENT") && !isPlacementManager(actor)) {
    throw new AppError("Placement application access is not permitted.", 403);
  }
  if (studentId) await assertCanViewStudent(institutionId, actor, studentId);

  return prisma.application.findMany({
    where: {
      institutionId,
      ...(options.opportunityId ? { opportunityId: options.opportunityId } : {}),
      ...(studentId ? { studentId } : {}),
    },
    include: {
      opportunity: { select: { id: true, title: true, organization: true, deadline: true } },
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { appliedAt: "desc" },
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
  const next = status.trim().toUpperCase();
  if (!APPLICATION_TRANSITIONS[application.status]?.includes(next)) {
    throw new AppError(`Invalid placement application transition: ${application.status} -> ${next}`, 409);
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { status: next },
    include: { opportunity: { select: { id: true, title: true, organization: true } } },
  });
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

export async function placementMetrics(institutionId: string, actor: AuthenticatedUser) {
  assertInstitution(actor, institutionId);
  if (!isPlacementManager(actor) && !actor.permissions.includes("placements.read")) {
    throw new AppError("Placement intelligence access is not permitted.", 403);
  }
  const [opportunities, applications, statusRows, organizations] = await Promise.all([
    prisma.opportunity.count({ where: { institutionId, isActive: true } }),
    prisma.application.count({ where: { institutionId } }),
    prisma.application.groupBy({ by: ["status"], where: { institutionId }, _count: { _all: true } }),
    prisma.opportunity.groupBy({ by: ["organization"], where: { institutionId }, _count: { _all: true }, orderBy: { _count: { organization: "desc" } }, take: 10 }),
  ]);
  const status = Object.fromEntries(statusRows.map(row => [row.status, row._count._all]));
  const selected = (status.OFFERED ?? 0) + (status.ACCEPTED ?? 0) + (status.JOINED ?? 0);
  return {
    opportunities,
    applications,
    status,
    organizations: organizations.map(row => ({ organization: row.organization, opportunities: row._count._all })),
    applicationSuccessRate: applications ? Math.round((selected / applications) * 1000) / 10 : 0,
  };
}
