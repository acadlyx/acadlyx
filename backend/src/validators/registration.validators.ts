import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const REGISTRATION_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "NEEDS_CORRECTION",
  "DROPPED",
] as const;

export const registrationListQuery = z.object({
  ...pageQuery,
  status: z.enum(REGISTRATION_STATUSES).optional(),
  courseOfferingId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  facultyId: z.string().uuid().optional(),
});

export const registerSchema = z.object({
  courseOfferingId: z.string().uuid(),
  /** Staff may register a student; students may only register themselves. */
  studentId: z.string().uuid().optional(),
});

export const decideRegistrationSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "NEEDS_CORRECTION"]),
    remarks: optionalText(500),
  })
  .refine((value) => value.decision === "APPROVED" || !!value.remarks, {
    message: "Remarks are required when rejecting a registration",
    path: ["remarks"],
  });

export const bulkRegisterSchema = z.object({
  courseOfferingIds: z.array(z.string().uuid()).min(1).max(100),
});

export const bulkDecisionSchema = z.object({
  registrationIds: z.array(z.string().uuid()).min(1).max(500),
  decision: z.enum(["APPROVED", "REJECTED", "NEEDS_CORRECTION"]),
  remarks: optionalText(500),
}).superRefine((value, ctx) => {
  if (value.decision !== "APPROVED" && !value.remarks) {
    ctx.addIssue({ code: "custom", path: ["remarks"], message: "Remarks are required for rejection or correction" });
  }
});

export const dropSchema = z.object({
  reason: optionalText(500),
});

export const bulkAssignCoursesSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(500),
  courseOfferingIds: z.array(z.string().uuid()).min(1).max(100),
});

export const offeringCapacitySchema = z.object({
  capacity: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  registrationOpen: z.boolean().optional(),
  isElective: z.boolean().optional(),
});

export const availableOfferingsQuery = z.object({
  ...pageQuery,
  semesterId: z.string().uuid().optional(),
  electivesOnly: z.enum(["true", "false"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type OfferingCapacityInput = z.infer<typeof offeringCapacitySchema>;
export type BulkAssignCoursesInput = z.infer<typeof bulkAssignCoursesSchema>;
