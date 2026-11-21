import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { assertCampusInScope, getAuthorizedCampusIds, isDirectorScoped } from "./accessScope.service";
import {
  CreateEventInput,
  UpdateEventInput,
} from "../validators/calendar.validators";

type Meta = { ipAddress?: string; userAgent?: string };

const AUDIENCE_ALL = ["ALL", "STUDENTS", "FACULTY", "STAFF"] as const;

/**
 * Campus ownership is explicit. Institution-wide roles may manage tenant-wide
 * records; other workspaces are filtered to server-derived campus assignments.
 * Directors never see unassigned legacy events because that would cross campus boundaries.
 */
async function calendarCampusWhere(institutionId: string, actor: AuthenticatedUser): Promise<Prisma.CalendarEventWhereInput> {
  const allowed = await getAuthorizedCampusIds(institutionId, actor);
  if (allowed === null) return {};
  if (isDirectorScoped(actor)) return { campusId: { in: allowed } };
  return { OR: [{ campusId: null }, { campusId: { in: allowed } }] };
}

async function resolveCampusForWrite(institutionId: string, actor: AuthenticatedUser, requested?: string | null): Promise<string | null> {
  const allowed = await getAuthorizedCampusIds(institutionId, actor);
  if (allowed === null) {
    if (requested) await assertCampusInScope(institutionId, actor, requested);
    return requested || null;
  }
  if (!requested) {
    if (allowed.length === 1) return allowed[0];
    if (allowed.length === 0) throw new AppError("No active campus is assigned to this calendar workspace.", 403);
    throw new AppError("Choose one of your assigned campuses before saving this calendar event.", 422);
  }
  await assertCampusInScope(institutionId, actor, requested);
  return requested;
}

async function assertCanManageExistingCampusEvent(institutionId: string, actor: AuthenticatedUser, campusId: string | null): Promise<void> {
  const allowed = await getAuthorizedCampusIds(institutionId, actor);
  if (allowed !== null && (!campusId || !allowed.includes(campusId))) {
    throw new AppError("This calendar event is outside your assigned campus scope.", 403);
  }
}

/**
 * Which audiences a viewer is entitled to see. Audience is a
 * publication scope, not a permission: a student must never receive
 * a FACULTY-only entry even though calendar.read is granted to all.
 */
export function visibleAudiences(actor: AuthenticatedUser): string[] {
  const audiences = new Set<string>(["ALL"]);
  if (actor.permissions.includes("calendar.manage")) {
    return [...AUDIENCE_ALL];
  }
  if (actor.roles.includes("STUDENT") || actor.roles.includes("PARENT")) {
    audiences.add("STUDENTS");
  }
  if (actor.roles.includes("FACULTY") || actor.roles.includes("HOD")) {
    audiences.add("FACULTY");
  }
  if (
    actor.roles.includes("STAFF") ||
    actor.roles.includes("MANAGEMENT") ||
    actor.roles.includes("DIRECTOR")
  ) {
    audiences.add("STAFF");
  }
  return [...audiences];
}

const include = {
  academicYear: { select: { id: true, name: true } },
  campus: { select: { id: true, name: true, code: true } },
} satisfies Prisma.CalendarEventInclude;

export async function listEvents(
  institutionId: string,
  actor: AuthenticatedUser,
  pagination: PaginationParams,
  filters: {
    from?: Date;
    to?: Date;
    eventType?: string;
    academicYearId?: string;
    audience?: string;
    campusId?: string;
    search?: string;
  }
) {
  const campusWhere = await calendarCampusWhere(institutionId, actor);
  if (filters.campusId) await assertCampusInScope(institutionId, actor, filters.campusId);
  const allowed = visibleAudiences(actor);
  const audienceFilter =
    filters.audience && allowed.includes(filters.audience)
      ? [filters.audience]
      : allowed;

  const where: Prisma.CalendarEventWhereInput = {
    ...campusWhere,
    institutionId,
    ...(filters.campusId ? { campusId: filters.campusId } : {}),
    audience: { in: audienceFilter },
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.academicYearId
      ? { academicYearId: filters.academicYearId }
      : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" } }
      : {}),
    /* Overlap test: an event is in range when it starts before the
       window closes and ends after the window opens. */
    ...(filters.to ? { startDate: { lte: filters.to } } : {}),
    ...(filters.from ? { endDate: { gte: filters.from } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.calendarEvent.findMany({
      where,
      include,
      orderBy: { startDate: "asc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.calendarEvent.count({ where }),
  ]);

  return { items, total };
}

export async function getUpcoming(
  institutionId: string,
  actor: AuthenticatedUser,
  limit = 10
) {
  const campusWhere = await calendarCampusWhere(institutionId, actor);
  return prisma.calendarEvent.findMany({
    where: {
      ...campusWhere,
      institutionId,
      audience: { in: visibleAudiences(actor) },
      endDate: { gte: new Date() },
    },
    include,
    orderBy: { startDate: "asc" },
    take: Math.min(limit, 50),
  });
}

async function assertAcademicYear(
  institutionId: string,
  academicYearId?: string | null
) {
  if (!academicYearId) return;
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, institutionId },
    select: { id: true },
  });
  if (!year) throw new AppError("Academic year not found in this institution", 404);
}

export async function createEvent(
  institutionId: string,
  actor: AuthenticatedUser,
  input: CreateEventInput,
  meta: Meta
) {
  const campusId = await resolveCampusForWrite(institutionId, actor, input.campusId);
  await assertAcademicYear(institutionId, input.academicYearId);

  const event = await prisma.calendarEvent.create({
    data: {
      institutionId,
      campusId,
      title: input.title,
      description: input.description ?? null,
      eventType: input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      academicYearId: input.academicYearId ?? null,
      audience: input.audience,
      createdById: actor.id,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "calendar.event.create",
    entityType: "CalendarEvent",
    entityId: event.id,
    metadata: { title: event.title, eventType: event.eventType, campusId: event.campusId },
    ...meta,
  });

  return event;
}

export async function updateEvent(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  input: UpdateEventInput,
  meta: Meta
) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, institutionId },
  });
  if (!existing) throw new AppError("Event not found", 404);
  await assertCanManageExistingCampusEvent(institutionId, actor, existing.campusId);
  const campusId = input.campusId === undefined ? existing.campusId : await resolveCampusForWrite(institutionId, actor, input.campusId);

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  if (endDate < startDate) {
    throw new AppError("endDate must not be before startDate", 422);
  }
  await assertAcademicYear(institutionId, input.academicYearId);

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: input.title,
      description: input.description,
      eventType: input.eventType,
      startDate: input.startDate,
      endDate: input.endDate,
      academicYearId: input.academicYearId,
      campusId,
      audience: input.audience,
    },
    include,
  });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "calendar.event.update",
    entityType: "CalendarEvent",
    entityId: id,
    metadata: input as Prisma.InputJsonValue,
    ...meta,
  });

  return event;
}

export async function deleteEvent(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
  meta: Meta
) {
  const existing = await prisma.calendarEvent.findFirst({
    where: { id, institutionId },
    select: { id: true, title: true, campusId: true },
  });
  if (!existing) throw new AppError("Event not found", 404);
  await assertCanManageExistingCampusEvent(institutionId, actor, existing.campusId);

  await prisma.calendarEvent.delete({ where: { id } });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "calendar.event.delete",
    entityType: "CalendarEvent",
    entityId: id,
    metadata: { title: existing.title, campusId: existing.campusId },
    ...meta,
  });

  return { id, deleted: true };
}
