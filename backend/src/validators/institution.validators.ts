import { z } from "zod";

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a hex color")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Secondary color must be a hex color")
    .optional()
    .or(z.literal("")),

  admin: z.object({
    firstName: z.string().trim().min(2).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    password: z.string().min(8).max(128),
  }),
});

export const updateInstitutionSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    )
    .optional(),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a hex color")
    .optional()
    .or(z.literal("")),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Secondary color must be a hex color")
    .optional()
    .or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const listInstitutionsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateInstitutionInput = z.infer<
  typeof createInstitutionSchema
>;

export type UpdateInstitutionInput = z.infer<
  typeof updateInstitutionSchema
>;
