import { z } from "zod";

const optionalNullableDate = z.preprocess(
  (value) => value === null || value === "" ? null : value,
  z.coerce.date().nullable().optional()
);

const registrationCalendarFields = {
  registrationOpensAt: optionalNullableDate,
  registrationClosesAt: optionalNullableDate,
  addDropDeadline: optionalNullableDate,
  withdrawalDeadline: optionalNullableDate,
  exceptionalWithdrawalAllowed: z.boolean().optional(),
  exceptionalWithdrawalStartsAt: optionalNullableDate,
  exceptionalWithdrawalEndsAt: optionalNullableDate,
};

export const createAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.boolean().optional(),
    ...registrationCalendarFields,
  })
  .superRefine((data, ctx) => {
    if (data.endDate <= data.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endDate must be after startDate", path: ["endDate"] });
    }
    if (data.registrationOpensAt && data.registrationClosesAt && data.registrationOpensAt >= data.registrationClosesAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration close must be after registration opening", path: ["registrationClosesAt"] });
    }
    if (data.addDropDeadline && data.registrationOpensAt && data.addDropDeadline < data.registrationOpensAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add/drop deadline cannot precede registration opening", path: ["addDropDeadline"] });
    }
    if (data.withdrawalDeadline && data.addDropDeadline && data.withdrawalDeadline < data.addDropDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Withdrawal deadline cannot precede add/drop deadline", path: ["withdrawalDeadline"] });
    }
    if (data.exceptionalWithdrawalAllowed && (!data.exceptionalWithdrawalStartsAt || !data.exceptionalWithdrawalEndsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal requires both opening and closing dates", path: ["exceptionalWithdrawalStartsAt"] });
    }
    if (data.exceptionalWithdrawalStartsAt && data.exceptionalWithdrawalEndsAt && data.exceptionalWithdrawalStartsAt >= data.exceptionalWithdrawalEndsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal close must be after opening", path: ["exceptionalWithdrawalEndsAt"] });
    }
    if (data.withdrawalDeadline && data.exceptionalWithdrawalStartsAt && data.exceptionalWithdrawalStartsAt <= data.withdrawalDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal must open after the normal withdrawal deadline", path: ["exceptionalWithdrawalStartsAt"] });
    }
  });

export const updateAcademicYearSchema = z
  .object({
    name: z.string().trim().min(4).max(20).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.boolean().optional(),
    ...registrationCalendarFields,
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endDate must be after startDate", path: ["endDate"] });
    }
    if (data.registrationOpensAt && data.registrationClosesAt && data.registrationOpensAt >= data.registrationClosesAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration close must be after registration opening", path: ["registrationClosesAt"] });
    }
    if (data.addDropDeadline && data.registrationOpensAt && data.addDropDeadline < data.registrationOpensAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add/drop deadline cannot precede registration opening", path: ["addDropDeadline"] });
    }
    if (data.withdrawalDeadline && data.addDropDeadline && data.withdrawalDeadline < data.addDropDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Withdrawal deadline cannot precede add/drop deadline", path: ["withdrawalDeadline"] });
    }
    if (data.exceptionalWithdrawalAllowed && data.exceptionalWithdrawalStartsAt === undefined && data.exceptionalWithdrawalEndsAt === undefined) {
      // The service merges partial updates with stored calendar settings.
    } else if (data.exceptionalWithdrawalAllowed && (!data.exceptionalWithdrawalStartsAt || !data.exceptionalWithdrawalEndsAt)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal requires both opening and closing dates", path: ["exceptionalWithdrawalStartsAt"] });
    }
    if (data.exceptionalWithdrawalStartsAt && data.exceptionalWithdrawalEndsAt && data.exceptionalWithdrawalStartsAt >= data.exceptionalWithdrawalEndsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal close must be after opening", path: ["exceptionalWithdrawalEndsAt"] });
    }
    if (data.withdrawalDeadline && data.exceptionalWithdrawalStartsAt && data.exceptionalWithdrawalStartsAt <= data.withdrawalDeadline) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal must open after the normal withdrawal deadline", path: ["exceptionalWithdrawalStartsAt"] });
    }
  });

export const listAcademicYearsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
});

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
