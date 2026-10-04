import { Request } from "express";
import * as finance from "../services/finance.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution, requireAuthenticatedUser } from "../utils/requireInstitution";
const a=(req:Request)=>requireAuthenticatedUser(req);
export const overview=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.overview(requireInstitution(req),a(req))}));
export const invoices=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.invoices(requireInstitution(req),a(req),req.query as any)}));
export const invoice=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.invoice(requireInstitution(req),a(req),req.params.id)}));
export const createInvoice=asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await finance.createInvoice(requireInstitution(req),a(req),req.body)}));
export const payment=asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await finance.payment(requireInstitution(req),a(req),req.params.id,req.body)}));
export const payments=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.listPayments(requireInstitution(req),a(req))}));
export const receipts=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.listReceipts(requireInstitution(req),a(req))}));
export const collections=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.collections(requireInstitution(req),a(req))}));
export const concessions=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.concessions(requireInstitution(req),a(req))}));
export const refunds=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.refunds(requireInstitution(req),a(req))}));
export const requestRefund=asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await finance.requestRefund(requireInstitution(req),a(req),req.params.id,req.body)}));
export const approveRefund=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.approveRefund(requireInstitution(req),a(req),req.params.id)}));
export const processRefund=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.processRefund(requireInstitution(req),a(req),req.params.id)}));
export const transactions=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.transactions(requireInstitution(req),a(req))}));

export const exportFinancial=asyncHandler(async(req,res)=>{const file=await finance.exportFinancial(requireInstitution(req),a(req),String(req.query.type),String(req.query.format||"xlsx") as "xlsx"|"csv");res.setHeader("Content-Type",file.contentType);res.setHeader("Content-Disposition",`attachment; filename="${file.filename}"`);res.setHeader("X-Export-Row-Count",String(file.rowCount));res.status(200).send(file.buffer)});

export const auditTrail=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.auditTrail(requireInstitution(req),a(req))}));

export const requestConcession=asyncHandler(async(req,res)=>res.status(201).json({success:true,data:await finance.requestConcession(requireInstitution(req),a(req),req.params.id,req.body)}));
export const approveConcession=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.approveConcession(requireInstitution(req),a(req),req.params.id)}));

export const cancelInvoice=asyncHandler(async(req,res)=>res.json({success:true,data:await finance.cancelInvoice(requireInstitution(req),a(req),req.params.id)}));
