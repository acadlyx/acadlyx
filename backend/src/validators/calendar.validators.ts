import { z } from "zod";
import { optionalText, optionalUuid, pageQuery } from "./common";

export const EVENT_TYPES = [
  "HOLIDAY",
  "EXAM",
  "EVENT",
  "DEADLINE",
  "ACADEMIC",
] as const;

export const AUDIENCES = ["ALL", "STUDENTS", "FACULTY", "STAFF"] as const;

export const calendarListQuery = z.object({
  ...pageQuery,
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  eventType: z.enum(EVENT_TYPES).optional(),
  academicYearId: z.string().uuid().optional(),
  audience: z.enum(AUDIENCES).optional(),
});

export const createEventSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: optionalText(2000),
    eventType: z.enum(EVENT_TYPES).default("EVENT"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    academicYearId: optionalUuid,
    audience: z.enum(AUDIENCES).default("ALL"),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: optionalText(2000),
    eventType: z.enum(EVENT_TYPES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    academicYearId: optionalUuid,
    audience: z.enum(AUDIENCES).optional(),
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { message: "endDate must not be before startDate", path: ["endDate"] }
  );

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
