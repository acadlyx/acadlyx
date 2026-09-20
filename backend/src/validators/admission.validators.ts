import { z } from "zod";
import {
  emptyToUndefined,
  optionalDate,
  optionalText,
  pageQuery,
} from "./common";

export const ADMISSION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_PENDING",
  "SELECTED",
  "REJECTED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

export const admissionListQuery = z.object({
  ...pageQuery,
  status: z.enum(ADMISSION_STATUSES).optional(),
  programId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

const person = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: optionalText(30),
  dateOfBirth: optionalDate,
  gender: optionalText(30),
  guardianName: optionalText(150),
  guardianPhone: optionalText(30),
  previousInstitution: optionalText(200),
  previousPercentage: emptyToUndefined(z.coerce.number().min(0).max(100)),
  remarks: optionalText(1000),
};

export const createAdmissionSchema = z.object({
  ...person,
  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const updateAdmissionSchema = z.object({
  firstName: person.firstName.optional(),
  lastName: person.lastName.optional(),
  email: person.email.optional(),
  phone: person.phone,
  dateOfBirth: person.dateOfBirth,
  gender: person.gender,
  guardianName: person.guardianName,
  guardianPhone: person.guardianPhone,
  previousInstitution: person.previousInstitution,
  previousPercentage: person.previousPercentage,
  remarks: person.remarks,
  programId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

export const admissionStatusSchema = z.object({
  status: z.enum(["UNDER_REVIEW", "DOCUMENTS_PENDING", "SELECTED", "REJECTED", "WITHDRAWN"]),
  remarks: optionalText(1000),
});

export const admissionEnrollSchema = z.object({
  admissionNumber: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
  semesterId: z.string().uuid(),
  sectionId: emptyToUndefined(z.string().uuid()),
  rollNumber: optionalText(50),
});

export type CreateAdmissionInput = z.infer<typeof createAdmissionSchema>;
export type UpdateAdmissionInput = z.infer<typeof updateAdmissionSchema>;
export type AdmissionEnrollInput = z.infer<typeof admissionEnrollSchema>;
