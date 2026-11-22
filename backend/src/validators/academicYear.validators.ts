import { z } from "zod";

const calendarFields = {
  registrationOpensAt: z.coerce.date().nullable().optional(),
  registrationClosesAt: z.coerce.date().nullable().optional(),
  addDropDeadline: z.coerce.date().nullable().optional(),
  withdrawalDeadline: z.coerce.date().nullable().optional(),
  exceptionalWithdrawalAllowed: z.boolean().optional(),
  exceptionalWithdrawalStartsAt: z.coerce.date().nullable().optional(),
  exceptionalWithdrawalEndsAt: z.coerce.date().nullable().optional(),
};

function validateCalendar(data: {
  startDate?: Date; endDate?: Date; registrationOpensAt?: Date | null;
  registrationClosesAt?: Date | null; addDropDeadline?: Date | null;
  withdrawalDeadline?: Date | null; exceptionalWithdrawalStartsAt?: Date | null;
  exceptionalWithdrawalEndsAt?: Date | null;
}, ctx: z.RefinementCtx) {
  if (data.startDate && data.endDate && data.endDate <= data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "endDate must be after startDate", path: ["endDate"] });
  }
  if (data.registrationOpensAt && data.registrationClosesAt && data.registrationClosesAt < data.registrationOpensAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Registration close must be on or after registration opening", path: ["registrationClosesAt"] });
  }
  if (data.addDropDeadline && data.registrationOpensAt && data.addDropDeadline < data.registrationOpensAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add/drop deadline cannot precede registration opening", path: ["addDropDeadline"] });
  }
  if (data.addDropDeadline && data.registrationClosesAt && data.addDropDeadline > data.registrationClosesAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Add/drop deadline cannot follow registration closing", path: ["addDropDeadline"] });
  }
  if (data.withdrawalDeadline && data.startDate && data.withdrawalDeadline < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Withdrawal deadline cannot precede the academic year", path: ["withdrawalDeadline"] });
  }
  if (data.exceptionalWithdrawalStartsAt && data.exceptionalWithdrawalEndsAt && data.exceptionalWithdrawalEndsAt < data.exceptionalWithdrawalStartsAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Exceptional withdrawal window is invalid", path: ["exceptionalWithdrawalEndsAt"] });
  }
}

export const createAcademicYearSchema = z.object({
  name: z.string().trim().min(4).max(20),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isCurrent: z.boolean().optional(),
  ...calendarFields,
}).superRefine(validateCalendar);

export const updateAcademicYearSchema = z.object({
  name: z.string().trim().min(4).max(20).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
  ...calendarFields,
}).superRefine(validateCalendar);

export const listAcademicYearsQuerySchema = z.object({
  page: z.string().optional(), pageSize: z.string().optional(),
  search: z.string().trim().optional(),
});

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
