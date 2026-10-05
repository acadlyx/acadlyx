import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";
import { recordAuditLog } from "./audit.service";
import { makeFile } from "./export.service";

type Scope={institutionId:string;studentIds?:string[];departmentIds?:string[];campusIds?:string[]};
const has=(a:AuthenticatedUser,p:string)=>a.permissions.includes(p);
const rs=(a:AuthenticatedUser)=>getCanonicalRoleNames(a.roles);

async function scope(institutionId:string,a:AuthenticatedUser):Promise<Scope>{
 const r=rs(a);
 if(r.includes("STUDENT")) return {institutionId,studentIds:[a.id]};
 if(r.includes("PARENT")) return {institutionId,studentIds:(await prisma.parentStudentLink.findMany({where:{institutionId,parentId:a.id},select:{studentId:true}})).map(x=>x.studentId)};
 if(r.includes("HOD")||r.includes("DEAN")) return {institutionId,departmentIds:(await prisma.departmentAccess.findMany({where:{userId:a.id,department:{institutionId}},select:{departmentId:true}})).map(x=>x.departmentId)};
 if(r.includes("DIRECTOR")) return {institutionId,campusIds:Array.from(new Set((await prisma.departmentAccess.findMany({where:{userId:a.id,department:{institutionId}},select:{department:{select:{campusId:true}}}})).map(x=>x.department.campusId).filter((x):x is string=>!!x)))};
 if(r.includes("ACCOUNTS")||r.includes("CHAIRMAN")||has(a,"fees.manage")||has(a,"fees.reports.export")) return {institutionId};
 throw new AppError("Financial scope is not authorized",403);
}
function invoiceWhere(s:Scope):Prisma.FeeInvoiceWhereInput{
 if(s.studentIds)return{institutionId:s.institutionId,studentId:{in:s.studentIds}};
 if(s.departmentIds)return{institutionId:s.institutionId,student:{studentEnrollments:{some:{status:"ACTIVE",program:{departmentId:{in:s.departmentIds}}}}}};
 if(s.campusIds)return{institutionId:s.institutionId,student:{studentEnrollments:{some:{status:"ACTIVE",program:{department:{campusId:{in:s.campusIds}}}}}}};
 return{institutionId:s.institutionId};
}
function paymentWhere(s:Scope):Prisma.FeePaymentWhereInput{return{institutionId:s.institutionId,invoice:s.studentIds?{studentId:{in:s.studentIds}}:s.departmentIds?{student:{studentEnrollments:{some:{status:"ACTIVE",program:{departmentId:{in:s.departmentIds}}}}}}:s.campusIds?{student:{studentEnrollments:{some:{status:"ACTIVE",program:{department:{campusId:{in:s.campusIds}}}}}}}:{}}}
function studentFinancialFilter(s:Scope):Record<string,any>{
 if(s.studentIds)return{studentId:{in:s.studentIds}};
 if(s.departmentIds)return{invoice:{student:{studentEnrollments:{some:{status:"ACTIVE",program:{departmentId:{in:s.departmentIds}}}}}}};
 if(s.campusIds)return{invoice:{student:{studentEnrollments:{some:{status:"ACTIVE",program:{department:{campusId:{in:s.campusIds}}}}}}}};
 return{};
}
function dec(v:unknown){const x=new Prisma.Decimal(String(v??"0"));if(x.lte(0))throw new AppError("Amount must be greater than zero",400);return x}
async function audit(institutionId:string,userId:string,action:string,entityType:string,entityId:string,metadata?:Prisma.InputJsonValue){await recordAuditLog({institutionId,userId,action,entityType,entityId,metadata})}

export async function overview(institutionId:string,a:AuthenticatedUser,filters:{period?:string;academicYearId?:string}={},resolvedScope?:Scope){
 if(!has(a,"fees.read")&&!has(a,"fees.collection.read"))throw new AppError("Financial visibility permission required",403);
 const s=resolvedScope ?? await scope(institutionId,a);
 const invoiceFilter:any={...invoiceWhere(s)}, paymentFilter:any={...paymentWhere(s)};
 const now=new Date(), today=new Date(now); today.setHours(0,0,0,0);
 const month=new Date(now.getFullYear(),now.getMonth(),1);
 if(filters.academicYearId){invoiceFilter.academicYearId=filters.academicYearId;paymentFilter.invoice={...(paymentFilter.invoice||{}),academicYearId:filters.academicYearId};}
 const period=filters.period;
 let from:Date|undefined;
 if(period==="today")from=today;
 if(period==="week"){from=new Date(today);from.setDate(from.getDate()-6);}
 if(period==="month")from=month;
 if(period==="quarter"){const qStart=Math.floor(now.getMonth()/3)*3;from=new Date(now.getFullYear(),qStart,1);}
 if(from){invoiceFilter.createdAt={gte:from};paymentFilter.paidAt={gte:from};}
 const overdueWhere={...invoiceFilter,dueDate:{lt:now},status:{in:["PENDING","PARTIALLY_PAID","OVERDUE"]}};
 const [invAgg,paidAgg,refAgg,overdueAgg,invoiceCount,paymentCount,todayAgg,monthAgg]=await Promise.all([
  prisma.feeInvoice.aggregate({where:invoiceFilter,_sum:{amount:true}}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS"},_sum:{amount:true}}),
  prisma.feeInvoice.aggregate({where:invoiceFilter,_sum:{refundedAmount:true}}),
  prisma.feeInvoice.aggregate({where:overdueWhere,_sum:{amount:true,paidAmount:true,refundedAmount:true}}),
  prisma.feeInvoice.count({where:invoiceFilter}),
  prisma.feePayment.count({where:paymentFilter}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:today}},_sum:{amount:true}}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:month}},_sum:{amount:true}})
 ]);
 const billed=Number(invAgg._sum.amount||0), collected=Number(paidAgg._sum.amount||0), refunded=Number(refAgg._sum.refundedAmount||0);
 const overdue=Math.max(0,Number(overdueAgg._sum.amount||0)-Number(overdueAgg._sum.paidAmount||0)-Number(overdueAgg._sum.refundedAmount||0));
 return {billed,collected,refunded,outstanding:Math.max(0,billed-collected-refunded),overdue,collectionPercentage:billed?collected/billed*100:0,todayCollection:Number(todayAgg._sum.amount||0),monthCollection:Number(monthAgg._sum.amount||0),invoiceCount,paymentCount,scope:s};
}

export async function commandCenter(institutionId:string,a:AuthenticatedUser,input:{period?:string}={}){
 if(!has(a,"fees.read")&&!has(a,"fees.collection.read"))throw new AppError("Financial visibility permission required",403);
 let academicYearId:string|undefined;
 if(input.period==="academic"){
  const year=await prisma.academicYear.findFirst({where:{institutionId,isCurrent:true},select:{id:true}});
  academicYearId=year?.id;
 }
 const s=await scope(institutionId,a);
 const scopedInvoice=invoiceWhere(s);
 const scopedPayment=paymentWhere(s);
 const invoiceFilter:any=academicYearId?{...scopedInvoice,academicYearId}:scopedInvoice;
 const paymentFilter:any=academicYearId?{...scopedPayment,invoice:{...(scopedPayment.invoice as any),academicYearId}}:scopedPayment;
 const base=await overview(institutionId,a,{period:input.period,academicYearId},s);
 const now=new Date(), thirty=new Date(now.getTime()-30*24*60*60*1000);
 const [methods,todayMethods,trendPayments,recentPayments,recentInvoices,pendingRefunds,pendingConcessions,pendingInvoices,departments]=await Promise.all([
  prisma.feePayment.groupBy({by:["method"],where:{...paymentFilter,status:"SUCCESS"},_sum:{amount:true},_count:{_all:true}}),
  prisma.feePayment.groupBy({by:["method"],where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:new Date(new Date().setHours(0,0,0,0))}},_sum:{amount:true},_count:{_all:true}}),
  prisma.feePayment.findMany({where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:thirty}},select:{amount:true,paidAt:true},orderBy:{paidAt:"asc"},take:2000}),
  prisma.feePayment.findMany({where:paymentFilter,select:{id:true,amount:true,method:true,paidAt:true,status:true,receiptNumber:true,invoice:{select:{id:true,invoiceNumber:true,student:{select:{firstName:true,lastName:true,profile:{select:{admissionNumber:true}}}}}}},orderBy:{paidAt:"desc"},take:8}),
  prisma.feeInvoice.findMany({where:invoiceFilter,select:{id:true,invoiceNumber:true,title:true,amount:true,paidAmount:true,refundedAmount:true,dueDate:true,status:true,student:{select:{id:true,firstName:true,lastName:true,profile:{select:{admissionNumber:true}}}}},orderBy:{createdAt:"desc"},take:8}),
  prisma.feeRefund.count({where:{institutionId,...studentFinancialFilter(s),status:"REQUESTED"}}),
  prisma.feeConcession.count({where:{institutionId,...studentFinancialFilter(s),status:"PENDING"}}),
  prisma.feeInvoice.count({where:{...invoiceFilter,status:"PENDING"}}),
  collections(institutionId,a,{academicYearId})
 ]);
 const trendMap=new Map<string,number>();
 for(const p of trendPayments){const key=p.paidAt.toISOString().slice(0,10);trendMap.set(key,(trendMap.get(key)||0)+Number(p.amount));}
 const trend=Array.from({length:30},(_,i)=>{const d=new Date(thirty);d.setDate(thirty.getDate()+i);const key=d.toISOString().slice(0,10);return{date:key,amount:trendMap.get(key)||0};});
 const overdueCount=await prisma.feeInvoice.count({where:{...invoiceFilter,dueDate:{lt:now},status:{in:["PENDING","PARTIALLY_PAID","OVERDUE"]}}});
 const actions=[
  pendingRefunds>0?{kind:"refunds",count:pendingRefunds,label:"refunds awaiting review",href:"/accounts/refunds"}:null,
  pendingConcessions>0?{kind:"concessions",count:pendingConcessions,label:"concessions awaiting approval",href:"/accounts/concessions"}:null,
  pendingInvoices>0?{kind:"invoices",count:pendingInvoices,label:"invoices awaiting payment",href:"/accounts/invoices"}:null,
  overdueCount>0?{kind:"overdue",count:overdueCount,label:"overdue accounts",href:"/accounts/dues"}:null
 ].filter(Boolean);
 return {...base,paymentMethods:methods.map(x=>({method:x.method,amount:Number(x._sum.amount||0),count:x._count._all})),todayPaymentMethods:todayMethods.map(x=>({method:x.method,amount:Number(x._sum.amount||0),count:x._count._all})),trend,recentPayments,recentInvoices:recentInvoices.map(x=>({...x,outstanding:Math.max(0,Number(x.amount)-Number(x.paidAmount)-Number(x.refundedAmount))})),actionRequired:actions,pendingRefunds,pendingConcessions,pendingInvoices,overdueCount,departments:departments.departments.map((x:any)=>({...x,collectionPercentage:x.billed?x.collected/x.billed*100:0})),programs:departments.programs,semesters:departments.semesters};
}

export async function invoices(institutionId:string,a:AuthenticatedUser,input:{studentId?:string;status?:string;search?:string;page?:number;pageSize?:number}){
 const s=await scope(institutionId,a);if(!has(a,"fees.read")&&!has(a,"fees.invoice.read"))throw new AppError("Invoice visibility permission required",403);
 if(input.studentId&&s.studentIds&&!s.studentIds.includes(input.studentId))throw new AppError("Student is outside your scope",403);
 const page=Math.max(1,input.page||1),size=Math.min(100,Math.max(1,input.pageSize||25));
 const where:Prisma.FeeInvoiceWhereInput={...invoiceWhere(s),...(input.studentId?{studentId:input.studentId}:{}),...(input.status?{status:input.status}:{}),...(input.search?{OR:[{title:{contains:input.search,mode:"insensitive"}},{invoiceNumber:{contains:input.search,mode:"insensitive"}}]}:{})};
 const [items,total]=await Promise.all([prisma.feeInvoice.findMany({where,include:{student:{select:{id:true,firstName:true,lastName:true,email:true,profile:{select:{admissionNumber:true}}}},payments:true,items:{include:{feeHead:true}},concessions:true,refunds:true,receipts:true},orderBy:{createdAt:"desc"},skip:(page-1)*size,take:size}),prisma.feeInvoice.count({where})]);
 return{items,total,page,pageSize:size};
}
export async function invoice(institutionId:string,a:AuthenticatedUser,id:string){
 const s=await scope(institutionId,a);if(!has(a,"fees.read")&&!has(a,"fees.invoice.read"))throw new AppError("Invoice visibility permission required",403);
 const x=await prisma.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},include:{student:{select:{id:true,firstName:true,lastName:true,email:true,profile:{select:{admissionNumber:true}}}},items:{include:{feeHead:true}},payments:true,concessions:true,refunds:true,receipts:true}});
 if(!x)throw new AppError("Invoice not found in authorized scope",404);return x;
}
async function invoiceNo(){return `INV-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`}
async function receiptNo(){return `RCT-${new Date().getFullYear()}-${crypto.randomUUID().slice(0,10).toUpperCase()}`}
export async function createInvoice(institutionId:string,a:AuthenticatedUser,input:any){
 if(!has(a,"fees.invoice.manage"))throw new AppError("Invoice management permission required",403);
 const s=await scope(institutionId,a);
 if(s.studentIds&&!s.studentIds.includes(input.studentId))throw new AppError("Student is outside your financial scope",403);
 const studentWhere:Prisma.UserWhereInput={id:input.studentId,institutionId,userRoles:{some:{role:{name:"STUDENT"}}}};
 if(s.departmentIds)studentWhere.studentEnrollments={some:{status:"ACTIVE",program:{departmentId:{in:s.departmentIds}}}};
 if(s.campusIds)studentWhere.studentEnrollments={some:{status:"ACTIVE",program:{department:{campusId:{in:s.campusIds}}}}};
 const student=await prisma.user.findFirst({where:studentWhere,select:{id:true}});
 if(!student)throw new AppError("Student is outside your financial scope",403);
 const amount=dec(input.amount);
 const items=(input.items||[]).map((x:any)=>({description:String(x.description).trim(),amount:dec(x.amount),feeHeadId:x.feeHeadId||null}));
 const total=items.reduce((n:any,x:any)=>n.plus(x.amount),new Prisma.Decimal(0));
 if(items.length&&!total.eq(amount))throw new AppError("Invoice amount must equal line items",400);
 const created=await prisma.$transaction(async tx=>{
  const i=await tx.feeInvoice.create({data:{institutionId,studentId:student.id,title:String(input.title).trim(),amount:Number(amount),grossAmount:Number(amount),dueDate:input.dueDate?new Date(input.dueDate):null,status:"PENDING",feeStructureId:input.feeStructureId||null,academicYearId:input.academicYearId||null,semesterId:input.semesterId||null,createdById:a.id,invoiceNumber:await invoiceNo(),items:{create:items}}});
  await tx.feeTransaction.create({data:{institutionId,studentId:student.id,invoiceId:i.id,amount,type:"INVOICE",createdById:a.id}});
  return i;
 });
 await audit(institutionId,a.id,"finance.invoice.create","FeeInvoice",created.id,{amount:amount.toString(),studentId:student.id});
 return invoice(institutionId,a,created.id);
}
export async function payment(institutionId:string,a:AuthenticatedUser,id:string,input:any){
 if(!has(a,"fees.payment.record"))throw new AppError("Payment recording permission required",403);
 const s=await scope(institutionId,a),inv=await prisma.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{id:true,studentId:true,amount:true,paidAmount:true,refundedAmount:true}});
 if(!inv)throw new AppError("Invoice not found in authorized scope",404);const amount=dec(input.amount);
 const existing=await prisma.feePayment.findFirst({where:{institutionId,idempotencyKey:String(input.idempotencyKey)}});if(existing)return invoice(institutionId,a,id);
 const result=await prisma.$transaction(async tx=>{const fresh=await tx.feeInvoice.findUnique({where:{id},select:{studentId:true,amount:true,paidAmount:true,refundedAmount:true}});if(!fresh)throw new AppError("Invoice not found",404);const balance=new Prisma.Decimal(fresh.amount).minus(fresh.paidAmount).minus(fresh.refundedAmount);if(amount.gt(balance))throw new AppError("Payment exceeds outstanding balance",409);
  const p=await tx.feePayment.create({data:{institutionId,invoiceId:id,amount:Number(amount),reference:input.reference||null,paidAt:input.paidAt?new Date(input.paidAt):new Date(),method:String(input.method||"OFFLINE"),status:"SUCCESS",recordedById:a.id,userId:a.id,notes:input.notes||null,idempotencyKey:String(input.idempotencyKey)}});
  const paid=new Prisma.Decimal(fresh.paidAmount).plus(amount),status=paid.gte(new Prisma.Decimal(fresh.amount).minus(fresh.refundedAmount))?"PAID":"PARTIALLY_PAID";
  await tx.feeInvoice.update({where:{id},data:{paidAmount:Number(paid),status}});await tx.feeTransaction.create({data:{institutionId,studentId:fresh.studentId,invoiceId:id,paymentId:p.id,amount,type:"PAYMENT",reference:input.reference||null,createdById:a.id}});
  const r=await tx.feeReceipt.create({data:{institutionId,paymentId:p.id,invoiceId:id,studentId:fresh.studentId,receiptNumber:await receiptNo(),issuedById:a.id}});await tx.feePayment.update({where:{id:p.id},data:{receiptNumber:r.receiptNumber}});return p;});
 await audit(institutionId,a.id,"finance.payment.record","FeePayment",result.id,{invoiceId:id,amount:amount.toString(),method:input.method});return invoice(institutionId,a,id);
}
export async function listPayments(institutionId:string,a:AuthenticatedUser){const s=await scope(institutionId,a);if(!has(a,"fees.read")&&!has(a,"fees.payment.read"))throw new AppError("Payment visibility permission required",403);return prisma.feePayment.findMany({where:paymentWhere(s),include:{invoice:{select:{id:true,invoiceNumber:true,title:true,amount:true,paidAmount:true,status:true,student:{select:{firstName:true,lastName:true,profile:{select:{admissionNumber:true}}}}}}},orderBy:{paidAt:"desc"},take:500})}
export async function listReceipts(institutionId:string,a:AuthenticatedUser){
 const s=await scope(institutionId,a);
 if(!has(a,"fees.read")&&!has(a,"fees.receipt.read"))throw new AppError("Receipt visibility permission required",403);
 return prisma.feeReceipt.findMany({where:{institutionId,...studentFinancialFilter(s)},include:{payment:true,invoice:{select:{invoiceNumber:true,title:true,amount:true}},student:{select:{firstName:true,lastName:true,profile:{select:{admissionNumber:true}}}}},orderBy:{issuedAt:"desc"},take:500});
}
export async function collections(institutionId:string,a:AuthenticatedUser,filters:{academicYearId?:string}={}){
 if(!has(a,"fees.collection.read")&&!has(a,"fees.read"))throw new AppError("Collection visibility permission required",403);
 const s=await scope(institutionId,a);
 const collectionWhere:any=filters.academicYearId?{...invoiceWhere(s),academicYearId:filters.academicYearId}:invoiceWhere(s);
 const rows=await prisma.feeInvoice.findMany({where:collectionWhere,select:{amount:true,paidAmount:true,refundedAmount:true,student:{select:{studentEnrollments:{where:{status:"ACTIVE"},orderBy:{createdAt:"desc"},take:1,select:{program:{select:{id:true,name:true,department:{select:{id:true,name:true,campusId:true}}}},semester:{select:{id:true,name:true}}}}}}}});
 const departments=new Map<string,any>(),programs=new Map<string,any>(),semesters=new Map<string,any>();
 for(const x of rows)for(const e of x.student.studentEnrollments){
  const billed=Number(x.amount),collected=Number(x.paidAmount)-Number(x.refundedAmount),outstanding=Math.max(0,billed-Number(x.paidAmount)-Number(x.refundedAmount));
  const d=e.program.department; const dr=departments.get(d.id)||{departmentId:d.id,name:d.name,billed:0,collected:0,outstanding:0};dr.billed+=billed;dr.collected+=collected;dr.outstanding+=outstanding;departments.set(d.id,dr);
  const pr=e.program; const prr=programs.get(pr.id)||{programId:pr.id,name:pr.name,departmentId:d.id,departmentName:d.name,billed:0,collected:0,outstanding:0};prr.billed+=billed;prr.collected+=collected;prr.outstanding+=outstanding;programs.set(pr.id,prr);
  if(e.semester){const se=e.semester;const sr=semesters.get(se.id)||{semesterId:se.id,name:se.name,billed:0,collected:0,outstanding:0};sr.billed+=billed;sr.collected+=collected;sr.outstanding+=outstanding;semesters.set(se.id,sr);}
 }
 const decorate=(rows:any[])=>rows.map(x=>({...x,collectionPercentage:x.billed?x.collected/x.billed*100:0})).sort((a,b)=>b.collected-a.collected);
 return{departments:decorate([...departments.values()]),programs:decorate([...programs.values()]),semesters:decorate([...semesters.values()]),scope:s};
}
export async function concessions(institutionId:string,a:AuthenticatedUser){
 const s=await scope(institutionId,a);
 if(!has(a,"fees.read")&&!has(a,"fees.concession.read"))throw new AppError("Concession visibility permission required",403);
 return prisma.feeConcession.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"},take:500});
}
export async function refunds(institutionId:string,a:AuthenticatedUser){
 const s=await scope(institutionId,a);
 if(!has(a,"fees.read")&&!has(a,"fees.refund.read"))throw new AppError("Refund visibility permission required",403);
 return prisma.feeRefund.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"},take:500});
}
export async function requestRefund(institutionId:string,a:AuthenticatedUser,paymentId:string,input:any){if(!has(a,"fees.refund.request"))throw new AppError("Refund request permission required",403);const s=await scope(institutionId,a),p=await prisma.feePayment.findFirst({where:{id:paymentId,...paymentWhere(s)},select:{id:true,invoiceId:true,amount:true,refundedAmount:true,invoice:{select:{studentId:true}}}});if(!p)throw new AppError("Payment not found in authorized scope",404);const amount=dec(input.amount),used=await prisma.feeRefund.aggregate({where:{paymentId,status:{in:["REQUESTED","APPROVED","PROCESSED"]}},_sum:{amount:true}}),available=new Prisma.Decimal(p.amount).minus(p.refundedAmount).minus(used._sum.amount||0);if(amount.gt(available))throw new AppError("Refund exceeds refundable amount",409);const x=await prisma.feeRefund.create({data:{institutionId,paymentId,invoiceId:p.invoiceId,studentId:p.invoice.studentId,amount,reason:String(input.reason).trim(),status:has(a,"fees.refund.approve")?"APPROVED":"REQUESTED",requestedById:a.id,approvedById:has(a,"fees.refund.approve")?a.id:null,approvedAt:has(a,"fees.refund.approve")?new Date():null}});await audit(institutionId,a.id,"finance.refund.request","FeeRefund",x.id,{paymentId,amount:amount.toString()});return x}
export async function approveRefund(institutionId:string,a:AuthenticatedUser,id:string){if(!has(a,"fees.refund.approve"))throw new AppError("Refund approval permission required",403);const x=await prisma.feeRefund.findFirst({where:{id,institutionId,status:"REQUESTED"}});if(!x)throw new AppError("Refund request not found",404);const y=await prisma.feeRefund.update({where:{id},data:{status:"APPROVED",approvedById:a.id,approvedAt:new Date()}});await audit(institutionId,a.id,"finance.refund.approve","FeeRefund",id);return y}
export async function processRefund(institutionId:string,a:AuthenticatedUser,id:string){if(!has(a,"fees.refund.process"))throw new AppError("Refund processing permission required",403);return prisma.$transaction(async tx=>{const r=await tx.feeRefund.findFirst({where:{id,institutionId,status:"APPROVED"}});if(!r)throw new AppError("Approved refund not found",404);const p=await tx.feePayment.findUnique({where:{id:r.paymentId},select:{amount:true,refundedAmount:true,invoiceId:true}});if(!p)throw new AppError("Payment not found",404);const next=new Prisma.Decimal(p.refundedAmount).plus(r.amount);if(next.gt(p.amount))throw new AppError("Refund exceeds payment",409);await tx.feePayment.update({where:{id:r.paymentId},data:{refundedAmount:Number(next)}});const i=await tx.feeInvoice.findUnique({where:{id:r.invoiceId},select:{amount:true,paidAmount:true,refundedAmount:true}});if(!i)throw new AppError("Invoice not found",404);const paid=new Prisma.Decimal(i.paidAmount).minus(r.amount),status=paid.lte(0)?"PENDING":paid.lt(i.amount)?"PARTIALLY_PAID":"PAID";await tx.feeInvoice.update({where:{id:r.invoiceId},data:{refundedAmount:Number(new Prisma.Decimal(i.refundedAmount).plus(r.amount)),paidAmount:Number(paid),status}});await tx.feeRefund.update({where:{id},data:{status:"PROCESSED",processedById:a.id,processedAt:new Date()}});await tx.feeTransaction.create({data:{institutionId,studentId:r.studentId,invoiceId:r.invoiceId,paymentId:r.paymentId,amount:r.amount.negated(),type:"REFUND",reference:id,createdById:a.id}});const y=await tx.feeRefund.findUnique({where:{id}});return y})}
export async function transactions(institutionId:string,a:AuthenticatedUser){
 const s=await scope(institutionId,a);
 if(!has(a,"fees.read")&&!has(a,"fees.payment.read"))throw new AppError("Transaction visibility permission required",403);
 return prisma.feeTransaction.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"},take:500});
}

export async function exportFinancial(institutionId:string,a:AuthenticatedUser,type:string,format:"xlsx"|"csv"){
 if(!has(a,"fees.reports.export")&&!has(a,"fees.read"))throw new AppError("Financial export permission required",403);
 const s=await scope(institutionId,a); let rows:any[]=[];
 if(type==="invoices"){const xs=await prisma.feeInvoice.findMany({where:invoiceWhere(s),include:{student:{include:{profile:true}},payments:true},orderBy:{createdAt:"desc"}});rows=xs.map(x=>({invoiceNumber:x.invoiceNumber,title:x.title,student:x.student.email,admissionNumber:x.student.profile?.admissionNumber||null,amount:Number(x.amount),paid:Number(x.paidAmount),refunded:Number(x.refundedAmount),outstanding:Math.max(0,Number(x.amount)-Number(x.paidAmount)-Number(x.refundedAmount)),status:x.status,dueDate:x.dueDate?.toISOString()||null}));}
 else if(type==="payments"){const xs=await prisma.feePayment.findMany({where:paymentWhere(s),include:{invoice:{include:{student:{include:{profile:true}}}}},orderBy:{paidAt:"desc"}});rows=xs.map(x=>({receipt:x.receiptNumber||null,invoice:x.invoice.invoiceNumber||null,student:x.invoice.student.email,admissionNumber:x.invoice.student.profile?.admissionNumber||null,amount:Number(x.amount),method:x.method,reference:x.reference||null,status:x.status,paidAt:x.paidAt.toISOString()}));}
 else if(type==="receipts"){const xs=await prisma.feeReceipt.findMany({where:{institutionId,...studentFinancialFilter(s)},include:{payment:true,invoice:true,student:true},orderBy:{issuedAt:"desc"}});rows=xs.map(x=>({receiptNumber:x.receiptNumber,invoiceNumber:x.invoice.invoiceNumber,student:x.student.email,amount:Number(x.payment.amount),method:x.payment.method,issuedAt:x.issuedAt.toISOString()}));}
 else if(type==="transactions"){const xs=await prisma.feeTransaction.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"}});rows=xs.map(x=>({type:x.type,amount:Number(x.amount),reference:x.reference||null,invoiceId:x.invoiceId||null,studentId:x.studentId||null,createdAt:x.createdAt.toISOString()}));}
 else throw new AppError("Unsupported financial export type",400);
 return makeFile(rows,type as any,format);
}

export async function auditTrail(institutionId:string,a:AuthenticatedUser){if(!has(a,"fees.read")&&!has(a,"audit.read"))throw new AppError("Financial audit visibility permission required",403);const s=await scope(institutionId,a);const inv=await prisma.feeInvoice.findMany({where:invoiceWhere(s),select:{id:true}});const ids=inv.map(x=>x.id);const payments=ids.length?await prisma.feePayment.findMany({where:{institutionId,invoiceId:{in:ids}},select:{id:true}}):[];const entityIds=[...ids,...payments.map(x=>x.id)];return prisma.auditLog.findMany({where:{institutionId,action:{startsWith:"finance."},...(entityIds.length?{entityId:{in:entityIds}}:{entityId:"__none__"})},orderBy:{createdAt:"desc"},take:500})}

export async function requestConcession(institutionId:string,a:AuthenticatedUser,invoiceId:string,input:any){if(!has(a,"fees.concession.manage"))throw new AppError("Concession management permission required",403);const s=await scope(institutionId,a),i=await prisma.feeInvoice.findFirst({where:{id:invoiceId,...invoiceWhere(s)},select:{id:true,studentId:true,amount:true,paidAmount:true,refundedAmount:true}});if(!i)throw new AppError("Invoice not found in authorized scope",404);const amount=dec(input.amount);const balance=new Prisma.Decimal(i.amount).minus(i.paidAmount).minus(i.refundedAmount);if(amount.gt(balance))throw new AppError("Concession exceeds outstanding balance",409);const approved=has(a,"fees.concession.approve");const x=await prisma.feeConcession.create({data:{institutionId,invoiceId,studentId:i.studentId,type:String(input.type||"WAIVER"),amount,percentage:input.percentage?new Prisma.Decimal(String(input.percentage)):null,reason:String(input.reason).trim(),status:approved?"APPROVED":"PENDING",createdById:a.id,approvedById:approved?a.id:null,approvedAt:approved?new Date():null}});if(approved)await applyConcession(institutionId,a,x.id);await audit(institutionId,a.id,"finance.concession.create","FeeConcession",x.id,{invoiceId,amount:amount.toString()});return x}
async function applyConcession(institutionId:string,a:AuthenticatedUser,id:string){const x=await prisma.feeConcession.findFirst({where:{id,institutionId,status:"APPROVED"}});if(!x)return;if(!x.invoiceId)throw new AppError("Concession is not linked to an invoice",409);await prisma.$transaction(async tx=>{const i=await tx.feeInvoice.findUnique({where:{id:x.invoiceId},select:{amount:true,paidAmount:true,refundedAmount:true}});if(!i)throw new AppError("Invoice not found",404);const already=await tx.feeTransaction.findFirst({where:{invoiceId:x.invoiceId,type:"CONCESSION",reference:x.id}});if(already)return;const amount=new Prisma.Decimal(x.amount),next=new Prisma.Decimal(i.amount).minus(amount);if(next.lt(new Prisma.Decimal(i.paidAmount).plus(i.refundedAmount)))throw new AppError("Concession would invalidate settled amount",409);await tx.feeInvoice.update({where:{id:x.invoiceId},data:{amount:Number(next),discountAmount:{increment:Number(amount)}}});await tx.feeTransaction.create({data:{institutionId,studentId:x.studentId,invoiceId:x.invoiceId,amount:amount.negated(),type:"CONCESSION",reference:x.id,createdById:a.id}})})}
export async function approveConcession(institutionId:string,a:AuthenticatedUser,id:string){if(!has(a,"fees.concession.approve"))throw new AppError("Concession approval permission required",403);const x=await prisma.feeConcession.findFirst({where:{id,institutionId,status:"PENDING"}});if(!x)throw new AppError("Pending concession not found",404);const y=await prisma.feeConcession.update({where:{id},data:{status:"APPROVED",approvedById:a.id,approvedAt:new Date()}});await applyConcession(institutionId,a,id);await audit(institutionId,a.id,"finance.concession.approve","FeeConcession",id);return y}

export async function cancelInvoice(institutionId:string,a:AuthenticatedUser,id:string){if(!has(a,"fees.invoice.manage"))throw new AppError("Invoice management permission required",403);const s=await scope(institutionId,a),i=await prisma.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{id:true,status:true,paidAmount:true,studentId:true}});if(!i)throw new AppError("Invoice not found in authorized scope",404);if(Number(i.paidAmount)>0)throw new AppError("A settled invoice cannot be cancelled",409);if(i.status==="CANCELLED")return i;const x=await prisma.feeInvoice.update({where:{id},data:{status:"CANCELLED",cancelledAt:new Date()}});await audit(institutionId,a.id,"finance.invoice.cancel","FeeInvoice",id,{previousStatus:i.status});return x}
