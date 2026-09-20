import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const REGISTRATION_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "DROPPED",
] as const;

export const registrationListQuery = z.object({
  ...pageQuery,
  status: z.enum(REGISTRATION_STATUSES).optional(),
  courseOfferingId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
});

export const registerSchema = z.object({
  courseOfferingId: z.string().uuid(),
  /** Staff may register a student; students may only register themselves. */
  studentId: z.string().uuid().optional(),
});

export const decideRegistrationSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    remarks: optionalText(500),
  })
  .refine((value) => value.decision === "APPROVED" || !!value.remarks, {
    message: "Remarks are required when rejecting a registration",
    path: ["remarks"],
  });

export const dropSchema = z.object({
  reason: optionalText(500),
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
