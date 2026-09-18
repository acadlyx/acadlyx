import { z } from "zod";

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must use HH:mm (24-hour) time");

const uuidParam = z.object({
  id: z.string().uuid(),
});

export const idParamSchema = uuidParam;

export const parentLinkParamsSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const timetableListQuerySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  courseOfferingId: z.string().uuid().optional(),
});

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

export const updateTimetableEntrySchema = z
  .object({
    courseOfferingId: z.string().uuid().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    startTime: timeOfDay.optional(),
    endTime: timeOfDay.optional(),
    room: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied",
  });

export const noticeListQuerySchema = z.object({
  includeExpired: z.enum(["true", "false"]).optional(),
});

export const createNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  audience: z.enum([
    "ALL",
    "STUDENT",
    "FACULTY",
    "PARENT",
    "STAFF",
    "HOD",
    "MANAGEMENT",
  ]).optional(),
  departmentId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
});

export const updateNoticeSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
    audience: z.enum([
      "ALL",
      "STUDENT",
      "FACULTY",
      "PARENT",
      "STAFF",
      "HOD",
      "MANAGEMENT",
    ]).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied",
  });

export const examListQuerySchema = z.object({
  courseOfferingId: z.string().uuid().optional(),
});

export const createExamSchema = z.object({
  courseOfferingId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  examDate: z.coerce.date(),
  maxMarks: z.number().positive().max(10000),
});

export const updateExamSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    examDate: z.coerce.date().optional(),
    maxMarks: z.number().positive().max(10000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied",
  });

export const upsertExamResultSchema = z.object({
  examId: z.string().uuid(),
  studentId: z.string().uuid(),
  marks: z.number().min(0).max(10000),
  remarks: z.string().trim().max(2000).optional(),
});

export const invoiceListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  status: z.enum(["PENDING", "PARTIAL", "PAID"]).optional(),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  amount: z.number().positive().max(100000000),
  dueDate: z.coerce.date().optional(),
});

export const updateInvoiceSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    amount: z.number().positive().max(100000000).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be supplied",
  });

export const recordPaymentSchema = z.object({
  amount: z.number().positive().max(100000000),
  reference: z.string().trim().max(200).optional(),
});

export const parentLinkListQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
});

export const createParentLinkSchema = z.object({
  parentId: z.string().uuid(),
  studentId: z.string().uuid(),
  relationship: z.string().trim().max(100).optional(),
});
