import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const CERTIFICATE_TYPES = [
  "BONAFIDE",
  "CHARACTER",
  "TRANSFER",
  "MARKSHEET",
  "COURSE_COMPLETION",
] as const;

export const certificateListQuery = z.object({
  ...pageQuery,
  status: z.enum(["REQUESTED", "ISSUED", "REJECTED"]).optional(),
  certificateType: z.enum(CERTIFICATE_TYPES).optional(),
  studentId: z.string().uuid().optional(),
});

export const requestCertificateSchema = z.object({
  certificateType: z.enum(CERTIFICATE_TYPES),
  purpose: z.string().trim().min(3).max(500),
  /** Staff may raise a request on a student's behalf. */
  studentId: z.string().uuid().optional(),
});

export const issueCertificateSchema = z.object({
  remarks: optionalText(500),
});

export const rejectCertificateSchema = z.object({
  remarks: z.string().trim().min(3).max(500),
});

export const verifyParams = z.object({
  certificateNumber: z.string().trim().min(4).max(64),
});

export type RequestCertificateInput = z.infer<typeof requestCertificateSchema>;
