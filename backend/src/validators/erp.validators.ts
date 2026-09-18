import { z } from "zod";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must use HH:mm (24-hour) time");

export const createTimetableEntrySchema = z
  .object({
    courseOfferingId: z.string().uuid(),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeOfDay,
    endTime: timeOfDay,
    room: z.string().trim().max(100).optional(),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const createNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum(["ALL", "STUDENT", "FACULTY", "PARENT", "STAFF", "HOD", "MANAGEMENT"]).optional(),
  departmentId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const createExamSchema = z.object({
  courseOfferingId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  examDate: z.coerce.date(),
  maxMarks: z.number().positive().max(10000),
});

export const upsertExamResultSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  marks: z.number().min(0).max(10000),
  remarks: z.string().trim().max(2000).optional(),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  amount: z.number().positive().max(100000000),
  dueDate: z.coerce.date().optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive().max(100000000),
  reference: z.string().trim().max(200).optional(),
});

export const createParentLinkSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().trim().max(100).optional(),
});
