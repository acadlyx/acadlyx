import { z } from "zod";
const money=z.union([z.string(),z.number()]).transform(String);
export const financeInvoiceListSchema=z.object({studentId:z.string().uuid().optional(),status:z.string().max(40).optional(),search:z.string().max(100).optional(),page:z.coerce.number().int().min(1).optional(),pageSize:z.coerce.number().int().min(1).max(100).optional()});
export const financeInvoiceCreateSchema=z.object({studentId:z.string().uuid(),title:z.string().min(1).max(200),amount:money,dueDate:z.coerce.date().optional(),feeStructureId:z.string().uuid().optional(),academicYearId:z.string().uuid().optional(),semesterId:z.string().uuid().optional(),items:z.array(z.object({description:z.string().min(1).max(200),amount:money,feeHeadId:z.string().uuid().optional()})).max(50).optional()});
export const financePaymentSchema=z.object({amount:money,method:z.string().min(2).max(40),reference:z.string().max(200).optional(),paidAt:z.coerce.date().optional(),notes:z.string().max(1000).optional(),idempotencyKey:z.string().min(8).max(100)});
export const financeRefundSchema=z.object({amount:money,reason:z.string().min(3).max(1000)});
export const financeIdSchema=z.object({id:z.string().uuid()});
\nexport const financeExportSchema=z.object({type:z.enum(["invoices","payments","receipts","transactions"]),format:z.enum(["xlsx","csv"]).default("xlsx")});\n