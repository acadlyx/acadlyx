import { z } from "zod";
const money=z.union([z.string(),z.number()]).transform(String);
export const financeInvoiceListSchema=z.object({studentId:z.string().uuid().optional(),status:z.string().max(40).optional(),search:z.string().max(100).optional(),overdueOnly:z.enum(["true","false"]).transform(value=>value==="true").optional(),page:z.coerce.number().int().min(1).optional(),pageSize:z.coerce.number().int().min(1).max(100).optional()});
export const financeInvoiceCreateSchema=z.object({studentId:z.string().uuid(),title:z.string().min(1).max(200),amount:money,dueDate:z.coerce.date().optional(),feeStructureId:z.string().uuid().optional(),academicYearId:z.string().uuid().optional(),semesterId:z.string().uuid().optional(),items:z.array(z.object({description:z.string().min(1).max(200),amount:money,feeHeadId:z.string().uuid().optional()})).max(50).optional()});
export const financePaymentSchema=z.object({amount:money,method:z.string().min(2).max(40),reference:z.string().max(200).optional(),paidAt:z.coerce.date().optional(),notes:z.string().max(1000).optional(),idempotencyKey:z.string().min(8).max(100)});
export const financeRefundSchema=z.object({amount:money,reason:z.string().min(3).max(1000)});
export const financeIdSchema=z.object({id:z.string().uuid()});

export const financeExportSchema=z.object({type:z.enum(["invoices","payments","receipts","transactions"]),format:z.enum(["xlsx","csv","docx","pdf","json"]).default("xlsx")});

export const financeConcessionSchema=z.object({amount:money,type:z.string().min(2).max(40),reason:z.string().min(3).max(1000),percentage:z.union([z.string(),z.number()]).transform(String).optional()});

export const financeDashboardSchema=z.object({period:z.enum(["today","week","month","quarter","academic"]).optional()});


const expenseMoney = z.union([
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount with up to two decimal places"),
  z.number().finite().positive(),
]).transform(String);
const expenseFields = {
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(500),
  amount: expenseMoney,
  vendor: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(200).optional(),
  spentAt: z.coerce.date(),
  supportDetails: z.string().trim().max(3000).optional(),
  supportingDocumentUrl: z.string().trim().url().max(1500).refine(v => /^https?:\/\//i.test(v), "Supporting document URL must use HTTP or HTTPS").optional().or(z.literal("")),
  campusId: z.string().uuid().optional().or(z.literal("")),
  departmentId: z.string().uuid().optional().or(z.literal("")),
};
export const financeExpenseCreateSchema = z.object(expenseFields);
export const financeExpenseUpdateSchema = z.object(expenseFields);
export const financeExpenseListSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  category: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
});
export const financeExpenseDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().trim().max(2000).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.decision === "REJECTED" && value.comment.trim().length < 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "A reason of at least 3 characters is required when rejecting an expense" });
  }
});

export const financeExpenseExportSchema=z.object({format:z.enum(["xlsx","csv","docx","pdf","json"]).default("xlsx")});
