import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const leaveListQuery = z.object({
  ...pageQuery,
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  leaveTypeId: z.string().uuid().optional(),
});

export const applyLeaveSchema = z
  .object({
    leaveTypeId: z.string().uuid(),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: z.string().trim().min(5).max(1000),
  })
  .refine((value) => value.toDate >= value.fromDate, {
    message: "toDate must not be before fromDate",
    path: ["toDate"],
  });

export const decideLeaveSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    note: optionalText(500),
  })
  .refine((value) => value.decision === "APPROVED" || !!value.note, {
    message: "A note is required when rejecting a request",
    path: ["note"],
  });

const roleList = z
  .array(
    z.enum([
      "INSTITUTION_ADMIN",
      "DIRECTOR",
      "MANAGEMENT",
      "HOD",
      "FACULTY",
      "STAFF",
      "STUDENT",
    ])
  )
  .max(7);

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(20).toUpperCase(),
  annualQuota: z.coerce.number().int().min(0).max(366).default(0),
  applicableRoles: roleList.default([]),
});

export const updateLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  annualQuota: z.coerce.number().int().min(0).max(366).optional(),
  applicableRoles: roleList.optional(),
  isActive: z.boolean().optional(),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
