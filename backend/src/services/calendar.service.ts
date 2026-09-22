import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import {
  CreateEventInput,
  UpdateEventInput,
} from "../validators/calendar.validators";

type Meta = { ipAddress?: string; userAgent?: string };

const AUDIENCE_ALL = ["ALL", "STUDENTS", "FACULTY", "STAFF"] as const;

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
    search?: string;
  }
) {
  const allowed = visibleAudiences(actor);
  const audienceFilter =
    filters.audience && allowed.includes(filters.audience)
      ? [filters.audience]
      : allowed;

  const where: Prisma.CalendarEventWhereInput = {
    institutionId,
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
  return prisma.calendarEvent.findMany({
    where: {
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
  await assertAcademicYear(institutionId, input.academicYearId);

  const event = await prisma.calendarEvent.create({
    data: {
      institutionId,
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
    metadata: { title: event.title, eventType: event.eventType },
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
    select: { id: true, title: true },
  });
  if (!existing) throw new AppError("Event not found", 404);

  await prisma.calendarEvent.delete({ where: { id } });

  await recordAuditLog({
    institutionId,
    userId: actor.id,
    action: "calendar.event.delete",
    entityType: "CalendarEvent",
    entityId: id,
    metadata: { title: existing.title },
    ...meta,
  });

  return { id, deleted: true };
}
