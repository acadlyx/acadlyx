import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { inclusiveDays } from "../utils/http";
import { PaginationParams } from "../utils/pagination";
import {
  ApplyLeaveInput,
  CreateLeaveTypeInput,
  UpdateLeaveTypeInput,
} from "../validators/leave.validators";
import { assertLeaveDecisionAuthority } from "./workflowAuthority.service";
import { recordAuditLog } from "./audit.service";

type Meta = { ipAddress?: string; userAgent?: string };

const STAFF_ROLES = [
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
];

const DEFAULT_TYPES = [
  { code: "CL", name: "Casual Leave", annualQuota: 12, applicableRoles: STAFF_ROLES },
  { code: "SL", name: "Sick Leave", annualQuota: 10, applicableRoles: [...STAFF_ROLES, "STUDENT"] },
  { code: "EL", name: "Earned Leave", annualQuota: 15, applicableRoles: STAFF_ROLES },
  { code: "STD", name: "Student Leave", annualQuota: 0, applicableRoles: ["STUDENT"] },
];

const MAX_SPAN_DAYS = 180;
const MAX_BACKDATE_DAYS = 14;

const include = {
  applicant: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  },
  leaveType: { select: { id: true, name: true, code: true } },
} satisfies Prisma.LeaveRequestInclude;

type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: typeof include }>;

function shape(row: LeaveRow) {
  const { userRoles, ...applicant } = row.applicant;
  return {
    ...row,
    applicant: { ...applicant, roles: userRoles.map((binding) => binding.role.name) },
  };
}

async function ensureDefaultTypes(institutionId: string) {
  const count = await prisma.leaveType.count({ where: { institutionId } });
  if (count > 0) return;
  await prisma.leaveType.createMany({
    data: DEFAULT_TYPES.map((type) => ({ ...type, institutionId })),
    skipDuplicates: true,
  });
}

function applicable(type: { applicableRoles: string[] }, roles: string[]): boolean {
  return type.applicableRoles.length === 0 || type.applicableRoles.some((r) => roles.includes(r));
}

export async function listLeaveTypes(
  institutionId: string,
  actor: AuthenticatedUser,
  includeAll: boolean
) {
  await ensureDefaultTypes(institutionId);
  const types = await prisma.leaveType.findMany({
    where: { institutionId, ...(includeAll ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
  });
  return includeAll ? types : types.filter((type) => applicable(type, actor.roles));
}

export async function createLeaveType(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateLeaveTypeInput,
  meta: Meta
) {
  const duplicate = await prisma.leaveType.findFirst({
    where: { institutionId, code: input.code },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A leave type with this code already exists", 409);

  const type = await prisma.leaveType.create({
    data: {
      institutionId,
      name: input.name,
      code: input.code,
      annualQuota: input.annualQuota,
      applicableRoles: input.applicableRoles,
    },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "leave.type.create",
    entityType: "LeaveType",
    entityId: type.id,
    ...meta,
  });
  return type;
}

export async function updateLeaveType(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateLeaveTypeInput,
  meta: Meta
) {
  const existing = await prisma.leaveType.findFirst({
    where: { id, institutionId },
    select: { id: true },
  });
  if (!existing) throw new AppError("Leave type not found", 404);

  const type = await prisma.leaveType.update({
    where: { id },
    data: {
      name: input.name,
      annualQuota: input.annualQuota,
      applicableRoles: input.applicableRoles,
      isActive: input.isActive,
    },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "leave.type.update",
    entityType: "LeaveType",
    entityId: id,
    metadata: { changed: Object.keys(input) },
    ...meta,
  });
  return type;
}

async function usedDays(
  institutionId: string,
  applicantId: string,
  leaveTypeId: string,
  year: number,
  status: string
): Promise<number> {
  const result = await prisma.leaveRequest.aggregate({
    where: {
      institutionId,
      applicantId,
      leaveTypeId,
      status,
      fromDate: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    _sum: { days: true },
  });
  return result._sum.days ?? 0;
}

export async function getBalances(institutionId: string, actor: AuthenticatedUser) {
  const types = await listLeaveTypes(institutionId, actor, false);
  const year = new Date().getUTCFullYear();
  return Promise.all(
    types.map(async (type) => {
      const [used, pending] = await Promise.all([
        usedDays(institutionId, actor.id, type.id, year, "APPROVED"),
        usedDays(institutionId, actor.id, type.id, year, "PENDING"),
      ]);
      return {
        leaveTypeId: type.id,
        name: type.name,
        code: type.code,
        annualQuota: type.annualQuota,
        used,
        pending,
        remaining: type.annualQuota > 0 ? Math.max(0, type.annualQuota - used - pending) : null,
      };
    })
  );
}

export async function applyLeave(
  institutionId: string,
  actor: AuthenticatedUser,
  input: ApplyLeaveInput,
  meta: Meta
) {
  const type = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, institutionId, isActive: true },
  });
  if (!type) throw new AppError("Leave type not found", 404);
  if (!applicable(type, actor.roles)) {
    throw new AppError("This leave type is not available for your role", 403);
  }

  const days = inclusiveDays(input.fromDate, input.toDate);
  if (days > MAX_SPAN_DAYS) {
    throw new AppError(`A single request cannot exceed ${MAX_SPAN_DAYS} days`, 400);
  }
  const earliest = Date.now() - MAX_BACKDATE_DAYS * 86_400_000;
  if (input.fromDate.getTime() < earliest) {
    throw new AppError(`Leave cannot be back-dated more than ${MAX_BACKDATE_DAYS} days`, 400);
  }

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      institutionId,
      applicantId: actor.id,
      status: { in: ["PENDING", "APPROVED"] },
      fromDate: { lte: input.toDate },
      toDate: { gte: input.fromDate },
    },
    select: { id: true },
  });
  if (overlap) throw new AppError("You already have a leave request covering these dates", 409);

  if (type.annualQuota > 0) {
    const year = input.fromDate.getUTCFullYear();
    const [approved, pending] = await Promise.all([
      usedDays(institutionId, actor.id, type.id, year, "APPROVED"),
      usedDays(institutionId, actor.id, type.id, year, "PENDING"),
    ]);
    if (approved + pending + days > type.annualQuota) {
      throw new AppError(
        `Insufficient ${type.name} balance: ${Math.max(0, type.annualQuota - approved - pending)} day(s) remaining`,
        409
      );
    }
  }

  const request = await prisma.leaveRequest.create({
    data: {
      institutionId,
      applicantId: actor.id,
      leaveTypeId: type.id,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days,
      reason: input.reason,
    },
    include,
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "leave.apply",
    entityType: "LeaveRequest",
    entityId: request.id,
    metadata: { days, leaveType: type.code },
    ...meta,
  });
  return shape(request);
}

export async function listMine(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; leaveTypeId?: string }
) {
  const where: Prisma.LeaveRequestWhereInput = {
    institutionId,
    applicantId: actor.id,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { items: rows.map(shape), total };
}


export async function listApprovals(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: { status?: string; leaveTypeId?: string }
) {
  if (!actor.roles.some((role) => ["HR", "HOD"].includes(role))) {
    return { items: [], total: 0 };
  }

  // Approval inbox is intentionally resolved from the same per-record
  // authority check used by the decision endpoint. This prevents the list
  // endpoint from exposing requests that the actor cannot actually approve.
  const where: Prisma.LeaveRequestWhereInput = {
    institutionId,
    status: filters.status ?? "PENDING",
    ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
  };
  const candidates = await prisma.leaveRequest.findMany({
    where,
    include,
    orderBy: { createdAt: "asc" },
  });
  const authorised: LeaveRow[] = [];
  for (const row of candidates) {
    try {
      await assertLeaveDecisionAuthority(institutionId, actor, row.applicantId);
      authorised.push(row);
    } catch {
      // Not in this actor's configured approval scope.
    }
  }
  const page = authorised.slice(pagination.skip, pagination.skip + pagination.take);
  return { items: page.map(shape), total: authorised.length };
}

export async function listAll(
  institutionId: string,
  pagination: PaginationParams,
  filters: { status?: string; leaveTypeId?: string }
) {
  const where: Prisma.LeaveRequestWhereInput = {
    institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.leaveTypeId ? { leaveTypeId: filters.leaveTypeId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.leaveRequest.count({ where }),
  ]);
  return { items: rows.map(shape), total };
}

async function assertCanDecide(
  institutionId: string,
  actor: AuthenticatedUser,
  applicantId: string
) {
  await assertLeaveDecisionAuthority(institutionId, actor, applicantId);
}

export async function decide(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  decision: "APPROVED" | "REJECTED",
  note: string | undefined,
  meta: Meta
) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id, institutionId },
    select: { id: true, applicantId: true, status: true, days: true },
  });
  if (!request) throw new AppError("Leave request not found", 404);
  await assertCanDecide(institutionId, actor, request.applicantId);

  // Conditional update closes the double-decision race.
  const updated = await prisma.leaveRequest.updateMany({
    where: { id, institutionId, status: "PENDING" },
    data: {
      status: decision,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: note,
    },
  });
  if (updated.count === 0) {
    throw new AppError(`This request is already ${request.status.toLowerCase()}`, 409);
  }

  await prisma.notification.create({
    data: {
      institutionId,
      userId: request.applicantId,
      title: `Leave request ${decision === "APPROVED" ? "approved" : "rejected"}`,
      body: note ? `Decision note: ${note}` : `Your leave request was ${decision.toLowerCase()}.`,
    },
  });
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: `leave.${decision.toLowerCase()}`,
    entityType: "LeaveRequest",
    entityId: id,
    metadata: { applicantId: request.applicantId, days: request.days },
    ...meta,
  });

  const row = await prisma.leaveRequest.findFirstOrThrow({
    where: { id, institutionId },
    include,
  });
  return shape(row);
}

export async function cancel(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  meta: Meta
) {
  const updated = await prisma.leaveRequest.updateMany({
    where: { id, institutionId, applicantId: actor.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) {
    throw new AppError("Only your own pending requests can be cancelled", 409);
  }
  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "leave.cancel",
    entityType: "LeaveRequest",
    entityId: id,
    ...meta,
  });
  const row = await prisma.leaveRequest.findFirstOrThrow({
    where: { id, institutionId },
    include,
  });
  return shape(row);
}
