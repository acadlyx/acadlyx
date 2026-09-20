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
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(2).max(250).optional(),
  author: z.string().trim().min(2).max(200).optional(),
  isbn: optionalText(32),
  category: optionalText(80),
  publisher: optionalText(150),
  shelfLocation: optionalText(60),
  totalCopies: z.coerce.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});

export const issueBookSchema = z.object({
  bookId: z.string().uuid(),
  borrowerId: z.string().uuid(),
  dueDate: z.coerce.date().optional(),
});

export const reserveBookSchema = z.object({
  bookId: z.string().uuid(),
  borrowerId: z.string().uuid().optional(),
});

export const returnBookSchema = z.object({
  /// LOST marks the copy as never coming back and removes it from stock.
  condition: z.enum(["RETURNED", "LOST"]).default("RETURNED"),
  waiveFine: z.boolean().default(false),
  note: optionalText(300),
});

export const circulationListQuery = z.object({
  ...pageQuery,
  status: z.enum(["RESERVED", "ISSUED", "RETURNED", "LOST", "OVERDUE"]).optional(),
  borrowerId: z.string().uuid().optional(),
  bookId: z.string().uuid().optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type IssueBookInput = z.infer<typeof issueBookSchema>;
export type ReturnBookInput = z.infer<typeof returnBookSchema>;
