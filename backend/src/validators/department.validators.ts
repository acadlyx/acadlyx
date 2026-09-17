import {
  z,
} from "zod";

const optionalUuid =
  z.preprocess(
    (value) => {
      if (
        value === "" ||
        value === null
      ) {
        return undefined;
      }

      return value;
    },
    z
      .string()
      .uuid()
      .optional()
  );

export const createDepartmentSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(
          2,
          "Department name must contain at least 2 characters"
        )
        .max(
          150,
          "Department name cannot exceed 150 characters"
        ),

      code: z
        .string()
        .trim()
        .min(
          2,
          "Department code must contain at least 2 characters"
        )
        .max(
          20,
          "Department code cannot exceed 20 characters"
        )
        .toUpperCase(),

      campusId:
        optionalUuid,
    })
    .strict();

export const updateDepartmentSchema =
  z
    .object({
      name: z
        .string()
        .trim()
        .min(2)
        .max(150)
        .optional(),

      code: z
        .string()
        .trim()
        .min(2)
        .max(20)
        .toUpperCase()
        .optional(),

      campusId:
        z.preprocess(
          (value) => {
            if (
              value === ""
            ) {
              return null;
            }

            return value;
          },
          z
            .string()
            .uuid()
            .nullable()
            .optional()
        ),

      isActive:
        z
          .boolean()
          .optional(),
    })
    .strict()
    .refine(
      (value) =>
        Object.keys(
          value
        ).length > 0,
      {
        message:
          "At least one field must be provided",
      }
    );

export const listDepartmentsQuerySchema =
  z
    .object({
      page: z
        .string()
        .regex(
          /^\d+$/
        )
        .optional(),

      pageSize: z
        .string()
        .regex(
          /^\d+$/
        )
        .optional(),

      search: z
        .string()
        .trim()
        .max(150)
        .optional(),

      isActive: z
        .enum([
          "true",
          "false",
        ])
        .optional(),
    })
    .strict();

export type CreateDepartmentInput =
  z.infer<
    typeof createDepartmentSchema
  >;

export type UpdateDepartmentInput =
  z.infer<
    typeof updateDepartmentSchema
  >;
