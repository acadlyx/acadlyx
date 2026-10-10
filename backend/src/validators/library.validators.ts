import { z } from "zod";
import { optionalText, pageQuery } from "./common";

export const bookListQuery = z.object({
  ...pageQuery,
  category: z.string().trim().max(80).optional(),
  availableOnly: z.enum(["true", "false"]).optional(),
});

export const createBookSchema = z.object({
  title: z.string().trim().min(2).max(250),
  author: z.string().trim().min(2).max(200),
  isbn: optionalText(32),
  category: optionalText(80),
  publisher: optionalText(150),
  shelfLocation: optionalText(60),
  totalCopies: z.coerce.number().int().min(1).max(10_000).default(1),
  defaultAcquisitionCost: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultReplacementValue: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultCurrentValue: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultLoanDays: z.coerce.number().int().min(1).max(3650).optional(),
  defaultMaxRenewals: z.coerce.number().int().min(0).max(100).optional(),
  defaultFinePerDay: z.coerce.number().nonnegative().max(100000).optional(),
  defaultFineCap: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultGracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(2).max(250).optional(),
  author: z.string().trim().min(2).max(200).optional(),
  isbn: optionalText(32),
  category: optionalText(80),
  publisher: optionalText(150),
  shelfLocation: optionalText(60),
  totalCopies: z.coerce.number().int().min(0).max(10_000).optional(),
  defaultAcquisitionCost: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultReplacementValue: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultCurrentValue: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultLoanDays: z.coerce.number().int().min(1).max(3650).optional(),
  defaultMaxRenewals: z.coerce.number().int().min(0).max(100).optional(),
  defaultFinePerDay: z.coerce.number().nonnegative().max(100000).optional(),
  defaultFineCap: z.coerce.number().nonnegative().max(100000000).optional(),
  defaultGracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  isActive: z.boolean().optional(),
});

export const issueBookSchema = z.object({
  bookId: z.string().uuid(),
  borrowerId: z.string().uuid(),
  copyId: z.string().uuid().optional(),
  issuedAt: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  loanPeriodDays: z.coerce.number().int().min(1).max(3650).optional(),
  renewalsAllowed: z.coerce.number().int().min(0).max(100).optional(),
  finePerDay: z.coerce.number().nonnegative().max(100000).optional(),
  fineCap: z.coerce.number().nonnegative().max(100000000).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  note: optionalText(500),
});

export const reserveBookSchema = z.object({
  bookId: z.string().uuid(),
  borrowerId: z.string().uuid().optional(),
});

export const returnBookSchema = z.object({
  condition: z.enum(["RETURNED", "LOST", "DAMAGED"]).default("RETURNED"),
  waiveFine: z.boolean().default(false),
  note: optionalText(300),
  fineOverride: z.coerce.number().nonnegative().max(100000000).optional(),
  fineOverrideReason: optionalText(500),
  damageSeverity: z.enum(["MINOR", "MODERATE", "SEVERE", "UNUSABLE"]).optional(),
});

export const circulationListQuery = z.object({
  ...pageQuery,
  status: z.enum(["RESERVED", "ISSUED", "RETURNED", "LOST", "DAMAGED", "OVERDUE", "CANCELLED"]).optional(),
  borrowerId: z.string().uuid().optional(),
  bookId: z.string().uuid().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type IssueBookInput = z.infer<typeof issueBookSchema>;
export type ReturnBookInput = z.infer<typeof returnBookSchema>;

export const fineWaiverRequestSchema = z.object({ reason: z.string().trim().min(3).max(500), amount: z.coerce.number().positive().max(1000000).optional() });
export const fineWaiverApprovalSchema = z.object({ reason: z.string().trim().min(3).max(500), amount: z.coerce.number().positive().max(1000000) });

export const renewLoanSchema = z.object({
  dueDate: z.coerce.date().optional(),
  note: optionalText(500),
});

export const libraryPolicySchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  maxActiveLoans: z.coerce.number().int().min(1).max(100).optional(),
  defaultLoanDays: z.coerce.number().int().min(1).max(3650).optional(),
  maxRenewals: z.coerce.number().int().min(0).max(100).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  dailyFine: z.coerce.number().nonnegative().max(100000).optional(),
  fineCap: z.coerce.number().nonnegative().max(100000000).optional(),
  lostChargeType: z.enum(["REPLACEMENT_VALUE", "CURRENT_VALUE", "FIXED"]).optional(),
  lostAdministrativeCharge: z.coerce.number().nonnegative().max(100000000).optional(),
  damagedChargeType: z.enum(["PERCENTAGE", "FIXED", "NONE"]).optional(),
  damagedChargePercent: z.coerce.number().nonnegative().max(100).optional(),
  damagedFixedCharge: z.coerce.number().nonnegative().max(100000000).optional(),
  reservationHoldDays: z.coerce.number().int().min(1).max(365).optional(),
});

export type RenewLoanInput = z.infer<typeof renewLoanSchema>;
export type LibraryPolicyInput = z.infer<typeof libraryPolicySchema>;

export const updateCopySchema = z.object({
  barcode: optionalText(120),
  location: optionalText(120),
  shelf: optionalText(120),
  acquisitionDate: z.coerce.date().optional(),
  acquisitionCost: z.coerce.number().nonnegative().max(100000000).optional(),
  replacementValue: z.coerce.number().nonnegative().max(100000000).optional(),
  currentValue: z.coerce.number().nonnegative().max(100000000).optional(),
  condition: z.enum(["GOOD","MINOR","MODERATE","SEVERE","UNUSABLE","DAMAGED"]).optional(),
  status: z.enum(["AVAILABLE","ISSUED","RESERVED","LOST","DAMAGED","MAINTENANCE","WITHDRAWN"]).optional(),
});

export type UpdateCopyInput = z.infer<typeof updateCopySchema>;
