import { z } from "zod";

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const listStudentsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  status: z
    .enum([
      "ACTIVE",
      "INACTIVE",
      "GRADUATED",
      "WITHDRAWN",
      "TRANSFERRED",
    ])
    .optional(),
  academicYearId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
});

export const createStudentSchema = z.object({
  email: z.string().trim().email().max(200),
  firstName: z.string().trim().min(2).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: optionalText(30),
  password: z.string().min(8).max(128),

  admissionNumber: z.string().trim().min(1).max(100),
  dateOfBirth: optionalDate,
  gender: optionalText(30),
  bloodGroup: optionalText(20),
  nationality: optionalText(80),
  address: optionalText(500),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  guardianName: optionalText(150),
  guardianPhone: optionalText(30),
  guardianEmail: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal("")),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(30),
  admissionDate: optionalDate,
  status: z
    .enum([
      "ACTIVE",
      "INACTIVE",
      "GRADUATED",
      "WITHDRAWN",
      "TRANSFERRED",
    ])
    .default("ACTIVE"),

  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional().or(z.literal("")),
  rollNumber: optionalText(50),
});

export const updateStudentSchema = z.object({
  email: z.string().trim().email().max(200).optional(),
  firstName: z.string().trim().min(2).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: optionalText(30),

  admissionNumber: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: optionalDate,
  gender: optionalText(30),
  bloodGroup: optionalText(20),
  nationality: optionalText(80),
  address: optionalText(500),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  guardianName: optionalText(150),
  guardianPhone: optionalText(30),
  guardianEmail: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal("")),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(30),
  admissionDate: optionalDate,
  status: z
    .enum([
      "ACTIVE",
      "INACTIVE",
      "GRADUATED",
      "WITHDRAWN",
      "TRANSFERRED",
    ])
    .optional(),
});

export const enrollStudentSchema = z.object({
  academicYearId: z.string().uuid(),
  programId: z.string().uuid(),
  semesterId: z.string().uuid(),
  sectionId: z.string().uuid().optional().or(z.literal("")),
  rollNumber: optionalText(50),
  status: z
    .enum([
      "ACTIVE",
      "COMPLETED",
      "DROPPED",
      "TRANSFERRED",
    ])
    .default("ACTIVE"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
