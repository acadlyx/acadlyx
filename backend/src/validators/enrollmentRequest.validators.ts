import { z } from "zod";

export const enrollmentRequestListQuery = z.object({
  status: z.enum(["PENDING","APPROVED","REJECTED","NEEDS_CORRECTION","CANCELLED"]).optional(),
  programId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
});

export const submitEnrollmentRequestSchema = z.object({
  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
});

export const decideEnrollmentRequestSchema = z.object({
  decision: z.enum(["APPROVED","REJECTED","NEEDS_CORRECTION"]),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.decision !== "APPROVED" && !value.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required for rejection or correction." });
  }
});

export const bulkEnrollmentDecisionSchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1).max(500),
  decision: z.enum(["APPROVED","REJECTED","NEEDS_CORRECTION"]),
  reason: z.string().trim().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (value.decision !== "APPROVED" && !value.reason) {
    ctx.addIssue({ code: "custom", path: ["reason"], message: "A reason is required for rejection or correction." });
  }
});
