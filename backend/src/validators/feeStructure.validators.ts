import { z } from "zod";

const uuid = z
  .string()
  .uuid();

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{3}$/,
    "Currency must be a three-letter code"
  );

const positiveAmount = z
  .number()
  .finite()
  .positive()
  .max(1000000000);

const feeHeadItemSchema =
  z.object({
    feeHeadId: uuid,

    amount:
      positiveAmount,

    dueDays:
      z
        .number()
        .int()
        .min(0)
        .max(3650)
        .optional(),

    installmentNumber:
      z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional(),
  });

export const feeHeadCreateSchema =
  z.object({
    name:
      z
        .string()
        .trim()
        .min(2)
        .max(150),

    code:
      z
        .string()
        .trim()
        .min(2)
        .max(50),

    description:
      z
        .string()
        .trim()
        .max(1000)
        .optional(),
  });

export const feeHeadUpdateSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(2)
          .max(150)
          .optional(),

      code:
        z
          .string()
          .trim()
          .min(2)
          .max(50)
          .optional(),

      description:
        z
          .string()
          .trim()
          .max(1000)
          .nullable()
          .optional(),

      isActive:
        z
          .boolean()
          .optional(),
    })
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      {
        message:
          "At least one field must be supplied",
      }
    );

export const feeStructureCreateSchema =
  z.object({
    name:
      z
        .string()
        .trim()
        .min(2)
        .max(200),

    academicYearId:
      uuid.optional(),

    programId:
      uuid.optional(),

    semesterId:
      uuid.optional(),

    status:
      z
        .enum([
          "DRAFT",
          "ACTIVE",
          "ARCHIVED",
        ])
        .default("DRAFT"),

    currency:
      currency.default("INR"),

    notes:
      z
        .string()
        .trim()
        .max(3000)
        .optional(),

    items:
      z
        .array(feeHeadItemSchema)
        .min(1)
        .max(500),
  })
  .refine(
    (value) =>
      !value.semesterId ||
      Boolean(value.programId),
    {
      message:
        "programId is required when semesterId is supplied",
      path: ["programId"],
    }
  );

export const feeStructureUpdateSchema =
  z
    .object({
      name:
        z
          .string()
          .trim()
          .min(2)
          .max(200)
          .optional(),

      status:
        z
          .enum([
            "DRAFT",
            "ACTIVE",
            "ARCHIVED",
          ])
          .optional(),

      currency:
        currency.optional(),

      notes:
        z
          .string()
          .trim()
          .max(3000)
          .nullable()
          .optional(),

      items:
        z
          .array(feeHeadItemSchema)
          .min(1)
          .max(500)
          .optional(),
    })
    .refine(
      (value) =>
        Object.keys(value).length >
        0,
      {
        message:
          "At least one field must be supplied",
      }
    );

export const feeStructureListSchema =
  z.object({
    status:
      z
        .enum([
          "DRAFT",
          "ACTIVE",
          "ARCHIVED",
        ])
        .optional(),

    academicYearId:
      uuid.optional(),

    programId:
      uuid.optional(),

    semesterId:
      uuid.optional(),

    includeInactive:
      z
        .enum(["true", "false"])
        .optional(),
  });
