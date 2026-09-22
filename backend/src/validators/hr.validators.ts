import { z } from "zod";
import { optionalText, optionalUuid, pageQuery } from "./common";

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "VISITING"] as const;
export const EMPLOYEE_STATUSES = ["ACTIVE", "ON_LEAVE", "RESIGNED", "TERMINATED", "RETIRED"] as const;

export const employeeListQuery = z.object({
  ...pageQuery,
  departmentId: z.string().uuid().optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
});

export const createEmployeeSchema = z.object({
  userId: z.string().uuid(),
  employeeCode: z.string().trim().min(1).max(50).toUpperCase(),
  departmentId: optionalUuid,
  designation: z.string().trim().min(2).max(150),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("FULL_TIME"),
  joiningDate: z.coerce.date(),
  qualification: optionalText(300),
  address: optionalText(500),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(30),
});

export const updateEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(1).max(50).toUpperCase().optional(),
  departmentId: z.preprocess((v) => (v === "" ? null : v), z.string().uuid().nullable().optional()),
  designation: z.string().trim().min(2).max(150).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  joiningDate: z.coerce.date().optional(),
  status: z.enum(EMPLOYEE_STATUSES).optional(),
  qualification: optionalText(300),
  address: optionalText(500),
  emergencyContactName: optionalText(150),
  emergencyContactPhone: optionalText(30),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
