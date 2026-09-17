import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      const normalized = String(value).trim();

      return normalized === "" ? undefined : normalized;
    },
    z.string().max(max).optional()
  );

export const createCampusSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Campus name must contain at least 2 characters")
      .max(150, "Campus name cannot exceed 150 characters"),

    code: z
      .string()
      .trim()
      .min(2, "Campus code must contain at least 2 characters")
      .max(30, "Campus code cannot exceed 30 characters")
      .toUpperCase(),

    address: optionalText(500),
  })
  .strict();

export const updateCampusSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Campus name must contain at least 2 characters")
      .max(150, "Campus name cannot exceed 150 characters")
      .optional(),

    code: z
      .string()
      .trim()
      .min(2, "Campus code must contain at least 2 characters")
      .max(30, "Campus code cannot exceed 30 characters")
      .toUpperCase()
      .optional(),

    address: z.preprocess(
      (value) => {
        if (value === null || value === undefined) {
          return value;
        }

        const normalized = String(value).trim();

        return normalized === "" ? null : normalized;
      },
      z.string().max(500).nullable().optional()
    ),

    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    {
      message: "At least one field must be provided",
    }
  );

export const listCampusesQuerySchema = z
  .object({
    page: z
      .string()
      .regex(/^\d+$/)
      .optional(),

    pageSize: z
      .string()
      .regex(/^\d+$/)
      .optional(),

    search: z
      .string()
      .trim()
      .max(150)
      .optional(),

    isActive: z
      .enum(["true", "false"])
      .optional(),
  })
  .strict();

export type CreateCampusInput = z.infer<
  typeof createCampusSchema
>;

export type UpdateCampusInput = z.infer<
  typeof updateCampusSchema
>;
