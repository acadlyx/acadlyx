import { z } from "zod";

/**
 * Generic user administration deliberately does NOT expose every
 * institutional role.
 *
 * Student creation belongs to student administration because it must
 * atomically establish:
 *
 *   User
 *   StudentProfile
 *   StudentEnrollment
 *
 * Operational institutional roles are created according to institutional
 * authority and are enforced again by user.service.ts.
 *
 * Keeping the validator broad enough for legacy roles prevents malformed
 * role strings while the service remains the final authority boundary.
 */
const roleNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((value) =>
    value.toUpperCase()
  );

export const createUserSchema =
  z.object({
    institutionId:
      z
        .string()
        .uuid()
        .nullable()
        .optional(),

    email:
      z
        .string()
        .trim()
        .email()
        .max(200),

    firstName:
      z
        .string()
        .trim()
        .min(2)
        .max(100),

    lastName:
      z
        .string()
        .trim()
        .min(1)
        .max(100),

    phone:
      z
        .string()
        .trim()
        .max(30)
        .optional()
        .or(
          z.literal("")
        ),

    password:
      z
        .string()
        .min(8)
        .max(128),

    role:
      roleNameSchema,
  });

export const updateUserSchema =
  z.object({
    firstName:
      z
        .string()
        .trim()
        .min(2)
        .max(100)
        .optional(),

    lastName:
      z
        .string()
        .trim()
        .min(1)
        .max(100)
        .optional(),

    phone:
      z
        .string()
        .trim()
        .max(30)
        .optional()
        .or(
          z.literal("")
        ),

    isActive:
      z
        .boolean()
        .optional(),

    role:
      roleNameSchema.optional(),
  });

export const listUsersQuerySchema =
  z.object({
    page:
      z
        .string()
        .optional(),

    pageSize:
      z
        .string()
        .optional(),

    search:
      z
        .string()
        .trim()
        .optional(),

    institutionId:
      z
        .string()
        .uuid()
        .optional(),

    role:
      roleNameSchema.optional(),

    isActive:
      z
        .enum([
          "true",
          "false",
        ])
        .optional(),
  });

export type CreateUserInput =
  z.infer<
    typeof createUserSchema
  >;

export type UpdateUserInput =
  z.infer<
    typeof updateUserSchema
  >;
