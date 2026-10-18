import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";
import { ExportFormat, ExportType, makeFile } from "./export.service";
import { getDirectorCampusIds, getManagedDepartmentIds, isDirectorScoped, isInstitutionWideFinance, getEffectiveWorkspaceRole } from "./accessScope.service";

type Scope={institutionId:string;studentIds?:string[];departmentIds?:string[];campusIds?:string[]};
const has=(a:AuthenticatedUser,p:string)=>a.permissions.includes(p);

function assertAccountsWorkspace(actor: AuthenticatedUser, action: string): void {
 if (getEffectiveWorkspaceRole(actor) !== "ACCOUNTS") {
  throw new AppError(action + " is only available in the active Accounts workspace", 403);
 }
}

async function scope(institutionId:string,a:AuthenticatedUser):Promise<Scope>{
 const activeRole=getEffectiveWorkspaceRole(a);

 // The effective role is the authority boundary for financial access. Other
 // role bindings cannot change the meaning of this request.
 if(activeRole==="CHAIRMAN") return {institutionId};

 if(activeRole==="DIRECTOR"&&isDirectorScoped(a)) {
  const campusIds=await getDirectorCampusIds(institutionId,a.id);
  return {institutionId,campusIds};
 }

 if(activeRole==="DEAN"||activeRole==="HOD") {
  const departmentIds=await getManagedDepartmentIds(institutionId,a.id);
  return {institutionId,departmentIds};
 }

 if(activeRole==="STUDENT") return {institutionId,studentIds:[a.id]};

 if(activeRole==="PARENT") {
  const studentIds=(await prisma.parentStudentLink.findMany({
   where:{institutionId,parentId:a.id},select:{studentId:true}
  })).map(x=>x.studentId);
  return {institutionId,studentIds};
 }

 if(isInstitutionWideFinance(a)) return {institutionId};

 throw new AppError("Financial scope is not authorized",403);
}
function invoiceWhere(s:Scope):Prisma.FeeInvoiceWhereInput{
 if(s.studentIds)return{institutionId:s.institutionId,studentId:{in:s.studentIds}};
 if(s.departmentIds)return{institutionId:s.institutionId,student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,departmentId:{in:s.departmentIds}}}}}};
 if(s.campusIds)return{institutionId:s.institutionId,student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,department:{institutionId:s.institutionId,campusId:{in:s.campusIds}}}}}}};
 return{institutionId:s.institutionId};
}
function paymentWhere(s:Scope):Prisma.FeePaymentWhereInput{
 return {
  institutionId:s.institutionId,
  invoice:s.studentIds
   ? {studentId:{in:s.studentIds}}
   : s.departmentIds
    ? {student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,departmentId:{in:s.departmentIds}}}}}}
    : s.campusIds
     ? {student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,department:{institutionId:s.institutionId,campusId:{in:s.campusIds}}}}}}}
     : {},
 };
}
function studentFinancialFilter(s:Scope):Record<string,unknown>{
 if(s.studentIds)return{studentId:{in:s.studentIds}};
 if(s.departmentIds)return{invoice:{student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,departmentId:{in:s.departmentIds}}}}}}};
 if(s.campusIds)return{invoice:{student:{studentEnrollments:{some:{institutionId:s.institutionId,status:"ACTIVE",program:{institutionId:s.institutionId,department:{institutionId:s.institutionId,campusId:{in:s.campusIds}}}}}}}};
 return{};
}
function dec(v:unknown){const x=new Prisma.Decimal(String(v??"0"));if(x.lte(0))throw new AppError("Amount must be greater than zero",400);return x}
async function audit(institutionId:string,userId:string,action:string,entityType:string,entityId:string,metadata?:Prisma.InputJsonValue){await recordAuditLog({institutionId,userId,action,entityType,entityId,metadata})}

export async function overview(institutionId:string,a:AuthenticatedUser,filters:{period?:string;academicYearId?:string}={},resolvedScope?:Scope){
 if(!has(a,"fees.read")&&!has(a,"fees.collection.read"))throw new AppError("Financial visibility permission required",403);
 const s=resolvedScope ?? await scope(institutionId,a);
 const invoiceFilter:any={...invoiceWhere(s),status:{not:"CANCELLED"}}, paymentFilter:any={...paymentWhere(s)};
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
  prisma.feeInvoice.aggregate({where:invoiceFilter,_sum:{amount:true,paidAmount:true}}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS"},_sum:{amount:true}}),
  prisma.feeInvoice.aggregate({where:invoiceFilter,_sum:{refundedAmount:true}}),
  prisma.feeInvoice.aggregate({where:overdueWhere,_sum:{amount:true,paidAmount:true}}),
  prisma.feeInvoice.count({where:invoiceFilter}),
  prisma.feePayment.count({where:paymentFilter}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:today}},_sum:{amount:true}}),
  prisma.feePayment.aggregate({where:{...paymentFilter,status:"SUCCESS",paidAt:{gte:month}},_sum:{amount:true}})
 ]);
 const billed=Number(invAgg._sum.amount||0), collected=Number(paidAgg._sum.amount||0), refunded=Number(refAgg._sum.refundedAmount||0);
 const overdue=Math.max(0,Number(overdueAgg._sum.amount||0)-Number(overdueAgg._sum.paidAmount||0));
 const outstanding=Math.max(0,billed-Number(invAgg._sum.paidAmount||0));
 return {billed,collected,refunded,outstanding,overdue,collectionPercentage:billed?Math.max(0,billed-outstanding)/billed*100:0,todayCollection:Number(todayAgg._sum.amount||0),monthCollection:Number(monthAgg._sum.amount||0),invoiceCount,paymentCount,scope:s};
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
 const invoiceFilter:any=academicYearId?{...scopedInvoice,academicYearId,status:{not:"CANCELLED"}}:{...scopedInvoice,status:{not:"CANCELLED"}};
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
 const pendingExpenseMetrics=(has(a,"expenses.read")||has(a,"expenses.manage")||has(a,"expenses.approve"))?await pendingExpenseSummary(institutionId,s):{count:0,amount:0};
 const actions=[
  pendingExpenseMetrics.count>0?{kind:"expenses",count:pendingExpenseMetrics.count,label:"expenses awaiting approval",href:"/accounts/expenses"}:null,
  pendingRefunds>0?{kind:"refunds",count:pendingRefunds,label:"refunds awaiting review",href:"/accounts/refunds"}:null,
  pendingConcessions>0?{kind:"concessions",count:pendingConcessions,label:"concessions awaiting approval",href:"/accounts/concessions"}:null,
  pendingInvoices>0?{kind:"invoices",count:pendingInvoices,label:"invoices awaiting payment",href:"/accounts/invoices"}:null,
  overdueCount>0?{kind:"overdue",count:overdueCount,label:"overdue accounts",href:"/accounts/dues"}:null
 ].filter(Boolean);
 return {...base,pendingExpenses:pendingExpenseMetrics.count,pendingExpenseAmount:pendingExpenseMetrics.amount,paymentMethods:methods.map(x=>({method:x.method,amount:Number(x._sum.amount||0),count:x._count._all})),todayPaymentMethods:todayMethods.map(x=>({method:x.method,amount:Number(x._sum.amount||0),count:x._count._all})),trend,recentPayments,recentInvoices:recentInvoices.map(x=>({...x,outstanding:Math.max(0,Number(x.amount)-Number(x.paidAmount))})),actionRequired:actions,pendingRefunds,pendingConcessions,pendingInvoices,overdueCount,departments:departments.departments.map((x:any)=>({...x,collectionPercentage:x.billed?x.collected/x.billed*100:0})),programs:departments.programs,semesters:departments.semesters};
}

export async function invoices(institutionId:string,a:AuthenticatedUser,input:{studentId?:string;status?:string;search?:string;overdueOnly?:boolean;page?:number;pageSize?:number}){
 const s=await scope(institutionId,a);if(!has(a,"fees.read")&&!has(a,"fees.invoice.read"))throw new AppError("Invoice visibility permission required",403);
 if(input.studentId&&s.studentIds&&!s.studentIds.includes(input.studentId))throw new AppError("Student is outside your scope",403);
 const page=Math.max(1,input.page||1),size=Math.min(100,Math.max(1,input.pageSize||25));
 const where:Prisma.FeeInvoiceWhereInput={...invoiceWhere(s),...(input.studentId?{studentId:input.studentId}:{}),...(input.overdueOnly?{status:{in:["PENDING","PARTIALLY_PAID","OVERDUE"]},dueDate:{lt:new Date()}}:{}),...(input.status?{status:input.status}:{}),...(input.search?{OR:[{title:{contains:input.search,mode:"insensitive"}},{invoiceNumber:{contains:input.search,mode:"insensitive"}}]}:{})};
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
  assertAccountsWorkspace(a, "Invoice creation");
 if(!has(a,"fees.invoice.manage"))throw new AppError("Invoice management permission required",403);
 const s=await scope(institutionId,a);
 if(s.studentIds&&!s.studentIds.includes(input.studentId))throw new AppError("Student is outside your financial scope",403);
 const studentWhere:Prisma.UserWhereInput={id:input.studentId,institutionId,userRoles:{some:{role:{name:"STUDENT"}}}};
 if(s.departmentIds)studentWhere.studentEnrollments={some:{institutionId,status:"ACTIVE",program:{institutionId,departmentId:{in:s.departmentIds}}}};
 if(s.campusIds)studentWhere.studentEnrollments={some:{institutionId,status:"ACTIVE",program:{institutionId,department:{institutionId,campusId:{in:s.campusIds}}}}};
 const student=await prisma.user.findFirst({where:studentWhere,select:{id:true}});
 if(!student)throw new AppError("Student is outside your financial scope",403);
 const amount=dec(input.amount);
 const items=(input.items||[]).map((x:any)=>({description:String(x.description).trim(),amount:dec(x.amount),feeHeadId:x.feeHeadId||null}));
 const total=items.reduce((n:any,x:any)=>n.plus(x.amount),new Prisma.Decimal(0));
 if(items.length&&!total.eq(amount))throw new AppError("Invoice amount must equal line items",400);
 const created=await prisma.$transaction(async tx=>{
  // Re-check assigned enrollment inside the write transaction so a transfer
  // between initial validation and invoice insertion cannot bypass scope.
  const scopedStudent=await tx.user.findFirst({where:studentWhere,select:{id:true}});
  if(!scopedStudent)throw new AppError("Student is outside your financial scope",403);
  const i=await tx.feeInvoice.create({data:{institutionId,studentId:scopedStudent.id,title:String(input.title).trim(),amount:Number(amount),grossAmount:Number(amount),dueDate:input.dueDate?new Date(input.dueDate):null,status:"PENDING",feeStructureId:input.feeStructureId||null,academicYearId:input.academicYearId||null,semesterId:input.semesterId||null,createdById:a.id,invoiceNumber:await invoiceNo(),items:{create:items}}});
  await tx.feeTransaction.create({data:{institutionId,studentId:scopedStudent.id,invoiceId:i.id,amount,type:"INVOICE",createdById:a.id}});
  return i;
 });
 await audit(institutionId,a.id,"finance.invoice.create","FeeInvoice",created.id,{amount:amount.toString(),studentId:student.id});
 return invoice(institutionId,a,created.id);
}
export async function payment(institutionId:string,a:AuthenticatedUser,id:string,input:any){
 assertAccountsWorkspace(a, "Payment recording");
 if(!has(a,"fees.payment.record"))throw new AppError("Payment recording permission required",403);
 const idempotencyKey=String(input.idempotencyKey??"").trim();
 if(!idempotencyKey)throw new AppError("Idempotency key is required",400);
 const amount=dec(input.amount),method=String(input.method||"OFFLINE"),reference=input.reference||null;
 const s=await scope(institutionId,a),inv=await prisma.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{id:true,studentId:true,amount:true,paidAmount:true,refundedAmount:true}});
 if(!inv)throw new AppError("Invoice not found in authorized scope",404);
 const replay=(existing:{invoiceId:string;amount:number;method:string;reference:string|null})=>{
  if(existing.invoiceId!==id)throw new AppError("Idempotency key was already used for a different invoice",409);
  if(new Prisma.Decimal(existing.amount).comparedTo(amount)!==0||existing.method!==method||existing.reference!==(reference===null?null:String(reference)))throw new AppError("Idempotency key was reused with a different payment payload",409);
 };
 const existing=await prisma.feePayment.findFirst({where:{institutionId,idempotencyKey},select:{invoiceId:true,amount:true,method:true,reference:true}});
 if(existing){replay(existing);return invoice(institutionId,a,id);}
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${id} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const duplicate=await tx.feePayment.findFirst({where:{institutionId,idempotencyKey},select:{id:true,invoiceId:true,amount:true,method:true,reference:true}});
  if(duplicate){replay(duplicate);return {paymentId:duplicate.id,created:false};}
  const fresh=await tx.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{studentId:true,amount:true,paidAmount:true,refundedAmount:true}});
  if(!fresh)throw new AppError("Invoice not found",404);
  const balance=new Prisma.Decimal(fresh.amount).minus(fresh.paidAmount).minus(fresh.refundedAmount);
  if(amount.gt(balance))throw new AppError("Payment exceeds outstanding balance",409);
  const p=await tx.feePayment.create({data:{institutionId,invoiceId:id,amount:Number(amount),reference,paidAt:input.paidAt?new Date(input.paidAt):new Date(),method,status:"SUCCESS",recordedById:a.id,userId:a.id,notes:input.notes||null,idempotencyKey}});
  const paid=new Prisma.Decimal(fresh.paidAmount).plus(amount),status=paid.gte(new Prisma.Decimal(fresh.amount).minus(fresh.refundedAmount))?"PAID":"PARTIALLY_PAID";
  const invoiceUpdated=await tx.feeInvoice.updateMany({
   where:{id,...invoiceWhere(s)},
   data:{paidAmount:Number(paid),status},
  });
  if(invoiceUpdated.count!==1)throw new AppError("Invoice is outside your financial scope",403);
  await tx.feeTransaction.create({data:{institutionId,studentId:fresh.studentId,invoiceId:id,paymentId:p.id,amount,type:"PAYMENT",reference,createdById:a.id}});
  const receipt=await tx.feeReceipt.create({data:{institutionId,paymentId:p.id,invoiceId:id,studentId:fresh.studentId,receiptNumber:await receiptNo(),issuedById:a.id}});
  await tx.feePayment.update({where:{id:p.id},data:{receiptNumber:receipt.receiptNumber}});
  return {paymentId:p.id,created:true};
 });
 if(result.created)await audit(institutionId,a.id,"finance.payment.record","FeePayment",result.paymentId,{invoiceId:id,amount:amount.toString(),method});
 return invoice(institutionId,a,id);
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
 const collectionWhere:Prisma.FeeInvoiceWhereInput=filters.academicYearId
  ? {...invoiceWhere(s),academicYearId:filters.academicYearId,status:{not:"CANCELLED"}}
  : {...invoiceWhere(s),status:{not:"CANCELLED"}};

 // Invoice visibility must also scope the enrollment used to attribute the
 // amount to a department/program. Otherwise a student with historical or
 // cross-campus enrollments could make one campus's billed total appear in
 // another campus's report.
 const enrollmentProgramWhere:Prisma.ProgramWhereInput={
  institutionId,
  ...(s.departmentIds?{departmentId:{in:s.departmentIds}}:{}),
  ...(s.campusIds?{department:{institutionId,campusId:{in:s.campusIds}}}:{}),
 };
 const enrollmentScope:Prisma.StudentEnrollmentWhereInput={
  institutionId,
  status:"ACTIVE",
  ...(s.departmentIds||s.campusIds?{program:enrollmentProgramWhere}:{}),
 };
 const rows=await prisma.feeInvoice.findMany({
  where:collectionWhere,
  select:{
   amount:true,
   paidAmount:true,
   refundedAmount:true,
   student:{
    select:{
     studentEnrollments:{
      where:enrollmentScope,
      orderBy:{createdAt:"desc"},
      take:1,
      select:{
       program:{select:{id:true,name:true,department:{select:{id:true,name:true,campusId:true}}}},
       semester:{select:{id:true,name:true}},
      },
     },
    },
   },
  },
 });
 const departments=new Map<string,any>(),programs=new Map<string,any>(),semesters=new Map<string,any>();
 for(const x of rows)for(const e of x.student.studentEnrollments){
  const billed=Number(x.amount),collected=Number(x.paidAmount),outstanding=Math.max(0,billed-Number(x.paidAmount));
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
 if(!has(a,"fees.read")&&!has(a,"fees.refund.read")&&!has(a,"fees.refund.approve")&&!has(a,"fees.refund.process"))throw new AppError("Refund visibility permission required",403);
 return prisma.feeRefund.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"},take:500});
}
export async function requestRefund(institutionId:string,a:AuthenticatedUser,paymentId:string,input:any){
  assertAccountsWorkspace(a, "Refund requests");
 if(!has(a,"fees.refund.request"))throw new AppError("Refund request permission required",403);
 const s=await scope(institutionId,a);
 const p=await prisma.feePayment.findFirst({where:{id:paymentId,...paymentWhere(s)},select:{id:true,invoiceId:true,amount:true,refundedAmount:true,invoice:{select:{studentId:true}}}});
 if(!p)throw new AppError("Payment not found in authorized scope",404);
 const amount=dec(input.amount);
 const x=await prisma.$transaction(async tx=>{
  // Serialize all refund reservations for this invoice before recomputing available balance.
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${p.invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_payments" WHERE "id" = ${paymentId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const fresh=await tx.feePayment.findFirst({where:{id:paymentId,...paymentWhere(s)},select:{id:true,invoiceId:true,amount:true,refundedAmount:true,invoice:{select:{studentId:true}}}});
  if(!fresh)throw new AppError("Payment not found",404);
  // Processed refunds are already included in feePayment.refundedAmount; count only outstanding reservations here to avoid subtracting them twice.
  const used=await tx.feeRefund.aggregate({where:{paymentId,status:{in:["REQUESTED","APPROVED"]}},_sum:{amount:true}});
  const available=new Prisma.Decimal(fresh.amount).minus(fresh.refundedAmount).minus(used._sum.amount||0);
  if(amount.gt(available))throw new AppError("Refund exceeds refundable amount",409);
  return tx.feeRefund.create({data:{institutionId,paymentId,feePaymentId:paymentId,invoiceId:fresh.invoiceId,studentId:fresh.invoice.studentId,amount,reason:String(input.reason).trim(),status:has(a,"fees.refund.approve")?"APPROVED":"REQUESTED",requestedById:a.id,approvedById:has(a,"fees.refund.approve")?a.id:null,approvedAt:has(a,"fees.refund.approve")?new Date():null}});
 });
 await audit(institutionId,a.id,"finance.refund.request","FeeRefund",x.id,{paymentId,amount:amount.toString()});
 return x
}
export async function approveRefund(institutionId:string,a:AuthenticatedUser,id:string){
  assertAccountsWorkspace(a, "Refund approval");
 if(!has(a,"fees.refund.approve"))throw new AppError("Refund approval permission required",403);
 const s=await scope(institutionId,a);
 const y=await prisma.$transaction(async tx=>{
  const candidate=await tx.feeRefund.findFirst({
   where:{id,institutionId,status:"REQUESTED"},
   select:{id:true,invoiceId:true,paymentId:true},
  });
  if(!candidate)throw new AppError("Refund request not found",404);
  if(!candidate.invoiceId||!candidate.paymentId)throw new AppError("Refund request is missing its financial records",409);

  // Lock related ledger rows before the final permission-and-state recheck.
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${candidate.invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_payments" WHERE "id" = ${candidate.paymentId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const [visibleInvoice,visiblePayment,fresh] = await Promise.all([
   tx.feeInvoice.findFirst({where:{id:candidate.invoiceId,...invoiceWhere(s)},select:{id:true}}),
   tx.feePayment.findFirst({where:{id:candidate.paymentId,...paymentWhere(s)},select:{id:true,invoiceId:true}}),
   tx.feeRefund.findFirst({where:{id,institutionId,status:"REQUESTED",invoiceId:candidate.invoiceId,paymentId:candidate.paymentId},select:{id:true}}),
  ]);
  if(!visibleInvoice||!visiblePayment||visiblePayment.invoiceId!==candidate.invoiceId||!fresh) {
   throw new AppError("Refund request is outside your financial scope or is no longer pending",403);
  }
  const changed=await tx.feeRefund.updateMany({
   where:{id,institutionId,status:"REQUESTED",invoiceId:candidate.invoiceId,paymentId:candidate.paymentId},
   data:{status:"APPROVED",approvedById:a.id,approvedAt:new Date()},
  });
  if(changed.count!==1)throw new AppError("Refund request is no longer pending",409);
  const updated=await tx.feeRefund.findFirst({where:{id,institutionId,status:"APPROVED",invoiceId:candidate.invoiceId,paymentId:candidate.paymentId}});
  if(!updated)throw new AppError("Refund request not found",404);
  return updated;
 });
 await audit(institutionId,a.id,"finance.refund.approve","FeeRefund",id);
 return y;
}
export async function processRefund(institutionId:string,a:AuthenticatedUser,id:string){
  assertAccountsWorkspace(a, "Refund processing");
 if(!has(a,"fees.refund.process"))throw new AppError("Refund processing permission required",403);
 const s=await scope(institutionId,a);
 const processed = await prisma.$transaction(async tx=>{
  const candidate=await tx.feeRefund.findFirst({where:{id,institutionId,status:"APPROVED"},select:{id:true,invoiceId:true,paymentId:true}});
  if(!candidate)throw new AppError("Approved refund not found",404);
  // Lock in a consistent invoice -> payment -> refund order before the final
  // authorization read, then verify the same records still belong to scope.
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${candidate.invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_payments" WHERE "id" = ${candidate.paymentId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const visibleInvoice=await tx.feeInvoice.findFirst({where:{id:candidate.invoiceId,...invoiceWhere(s)},select:{id:true}});
  const visiblePayment=await tx.feePayment.findFirst({where:{id:candidate.paymentId,...paymentWhere(s)},select:{id:true,invoiceId:true}});
  if(!visibleInvoice||!visiblePayment||visiblePayment.invoiceId!==candidate.invoiceId)throw new AppError("Refund request is outside your financial scope",403);
  const claimed=await tx.feeRefund.updateMany({where:{id,institutionId,status:"APPROVED",invoiceId:candidate.invoiceId,paymentId:candidate.paymentId},data:{status:"PROCESSING"}});
  if(claimed.count!==1)throw new AppError("Refund is already being processed or is no longer approved",409);
  const r=await tx.feeRefund.findFirst({where:{id,institutionId,status:"PROCESSING",invoiceId:candidate.invoiceId,paymentId:candidate.paymentId}});
  if(!r)throw new AppError("Refund not found",404);
  const p=await tx.feePayment.findFirst({where:{id:r.paymentId,...paymentWhere(s)},select:{amount:true,refundedAmount:true,invoiceId:true}});
  if(!p||p.invoiceId!==r.invoiceId)throw new AppError("Payment is outside your financial scope",403);
  const next=new Prisma.Decimal(p.refundedAmount).plus(r.amount);
  if(next.gt(p.amount))throw new AppError("Refund exceeds payment",409);
  const paymentUpdated=await tx.feePayment.updateMany({where:{id:r.paymentId,...paymentWhere(s)},data:{refundedAmount:Number(next)}});
  if(paymentUpdated.count!==1)throw new AppError("Payment is outside your financial scope",403);
  const i=await tx.feeInvoice.findFirst({where:{id:r.invoiceId,...invoiceWhere(s)},select:{amount:true,paidAmount:true,refundedAmount:true}});
  if(!i)throw new AppError("Invoice is outside your financial scope",403);
  const paid=new Prisma.Decimal(i.paidAmount).minus(r.amount),status=paid.lte(0)?"PENDING":paid.lt(i.amount)?"PARTIALLY_PAID":"PAID";
  const invoiceUpdated=await tx.feeInvoice.updateMany({where:{id:r.invoiceId,...invoiceWhere(s)},data:{refundedAmount:Number(new Prisma.Decimal(i.refundedAmount).plus(r.amount)),paidAmount:Number(paid),status}});
  if(invoiceUpdated.count!==1)throw new AppError("Invoice is outside your financial scope",403);
  await tx.feeRefund.update({where:{id},data:{status:"PROCESSED",processedById:a.id,processedAt:new Date()}});
  await tx.feeTransaction.create({data:{institutionId,studentId:r.studentId,invoiceId:r.invoiceId,paymentId:r.paymentId,amount:r.amount.negated(),type:"REFUND",reference:id,createdById:a.id}});
  return tx.feeRefund.findUnique({where:{id}})
 });
 if (processed) await audit(institutionId, a.id, "finance.refund.process", "FeeRefund", id, { paymentId: processed.paymentId, amount: processed.amount.toString() });
 return processed;
}
export async function transactions(institutionId:string,a:AuthenticatedUser){
 const s=await scope(institutionId,a);
 if(!has(a,"fees.read")&&!has(a,"fees.payment.read"))throw new AppError("Transaction visibility permission required",403);
 return prisma.feeTransaction.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"},take:500});
}

export async function exportFinancial(institutionId:string,a:AuthenticatedUser,type:"invoices"|"payments"|"receipts"|"transactions",format:ExportFormat){
 if(!has(a,"fees.reports.export")&&!has(a,"fees.read"))throw new AppError("Financial export permission required",403);
 const s=await scope(institutionId,a); let rows:any[]=[];
 if(type==="invoices"){const xs=await prisma.feeInvoice.findMany({where:invoiceWhere(s),include:{student:{include:{profile:true}},payments:true},orderBy:{createdAt:"desc"}});rows=xs.map(x=>({invoiceNumber:x.invoiceNumber,title:x.title,student:x.student.email,admissionNumber:x.student.profile?.admissionNumber||null,amount:Number(x.amount),paid:Number(x.paidAmount),refunded:Number(x.refundedAmount),outstanding:Math.max(0,Number(x.amount)-Number(x.paidAmount)-Number(x.refundedAmount)),status:x.status,dueDate:x.dueDate?.toISOString()||null}));}
 else if(type==="payments"){const xs=await prisma.feePayment.findMany({where:paymentWhere(s),include:{invoice:{include:{student:{include:{profile:true}}}}},orderBy:{paidAt:"desc"}});rows=xs.map(x=>({receipt:x.receiptNumber||null,invoice:x.invoice.invoiceNumber||null,student:x.invoice.student.email,admissionNumber:x.invoice.student.profile?.admissionNumber||null,amount:Number(x.amount),method:x.method,reference:x.reference||null,status:x.status,paidAt:x.paidAt.toISOString()}));}
 else if(type==="receipts"){const xs=await prisma.feeReceipt.findMany({where:{institutionId,...studentFinancialFilter(s)},include:{payment:true,invoice:true,student:true},orderBy:{issuedAt:"desc"}});rows=xs.map(x=>({receiptNumber:x.receiptNumber,invoiceNumber:x.invoice.invoiceNumber,student:x.student.email,amount:Number(x.payment.amount),method:x.payment.method,issuedAt:x.issuedAt.toISOString()}));}
 else if(type==="transactions"){const xs=await prisma.feeTransaction.findMany({where:{institutionId,...studentFinancialFilter(s)},orderBy:{createdAt:"desc"}});rows=xs.map(x=>({type:x.type,amount:Number(x.amount),reference:x.reference||null,invoiceId:x.invoiceId||null,studentId:x.studentId||null,createdAt:x.createdAt.toISOString()}));}
 else throw new AppError("Unsupported financial export type",400);
 const fileType: Record<typeof type, ExportType> = { invoices: "fees", payments: "fee-payments", receipts: "fee-receipts", transactions: "fee-transactions" };
 return makeFile(rows,fileType[type],format);
}

export async function auditTrail(institutionId:string,a:AuthenticatedUser){if(!has(a,"fees.read")&&!has(a,"audit.read"))throw new AppError("Financial audit visibility permission required",403);const s=await scope(institutionId,a);const inv=await prisma.feeInvoice.findMany({where:invoiceWhere(s),select:{id:true}});const ids=inv.map(x=>x.id);const payments=ids.length?await prisma.feePayment.findMany({where:{institutionId,invoiceId:{in:ids}},select:{id:true}}):[];const entityIds=[...ids,...payments.map(x=>x.id)];return prisma.auditLog.findMany({where:{institutionId,action:{startsWith:"finance."},...(entityIds.length?{entityId:{in:entityIds}}:{entityId:"__none__"})},orderBy:{createdAt:"desc"},take:500})}

async function applyConcessionInTransaction(tx: Prisma.TransactionClient, institutionId: string, a: AuthenticatedUser, id: string, s: Scope) {
  const x = await tx.feeConcession.findFirst({ where: { id, institutionId, status: "APPROVED" } });
  if (!x) return;
  if (!x.invoiceId) throw new AppError("Concession is not linked to an invoice", 409);

  const invoiceId = x.invoiceId;
  // Lock the invoice before checking prior postings or deriving its next balance.
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const already = await tx.feeTransaction.findFirst({
    where: { institutionId, invoiceId, type: "CONCESSION", reference: x.id },
    select: { id: true },
  });
  if (already) return;

  const i = await tx.feeInvoice.findFirst({
    where: { id: invoiceId, ...invoiceWhere(s) },
    select: { amount: true, paidAmount: true, refundedAmount: true, discountAmount: true },
  });
  if (!i) throw new AppError("Invoice not found", 404);
  const amount = new Prisma.Decimal(x.amount);
  const next = new Prisma.Decimal(i.amount).minus(amount);
  const settled = new Prisma.Decimal(i.paidAmount).plus(i.refundedAmount);
  if (next.lt(settled)) throw new AppError("Concession would invalidate settled amount", 409);

  const updatedInvoice = await tx.feeInvoice.updateMany({
    where: { id: invoiceId, ...invoiceWhere(s) },
    data: {
      amount: Number(next),
      discountAmount: Number(new Prisma.Decimal(i.discountAmount).plus(amount)),
    },
  });
  if (updatedInvoice.count !== 1) throw new AppError("Invoice is outside your financial scope", 403);
  await tx.feeTransaction.create({
    data: { institutionId, studentId: x.studentId, invoiceId, amount: amount.negated(), type: "CONCESSION", reference: x.id, createdById: a.id },
  });
}

export async function requestConcession(institutionId: string, a: AuthenticatedUser, invoiceId: string, input: any) {
  assertAccountsWorkspace(a, "Concession requests");
  if (!has(a, "fees.concession.manage")) throw new AppError("Concession management permission required", 403);
  const s = await scope(institutionId, a);
  const visible = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, ...invoiceWhere(s) }, select: { id: true, studentId: true } });
  if (!visible) throw new AppError("Invoice not found in authorized scope", 404);
  const amount = dec(input.amount);
  const approved = has(a, "fees.concession.approve");

  const x = await prisma.$transaction(async tx => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
    const i = await tx.feeInvoice.findFirst({
      where: { id: invoiceId, ...invoiceWhere(s) },
      select: { id: true, studentId: true, amount: true, paidAmount: true, refundedAmount: true },
    });
    if (!i) throw new AppError("Invoice not found in authorized scope", 404);
    const balance = new Prisma.Decimal(i.amount).minus(i.paidAmount).minus(i.refundedAmount);
    if (amount.gt(balance)) throw new AppError("Concession exceeds outstanding balance", 409);
    const concession = await tx.feeConcession.create({
      data: {
        institutionId, invoiceId, studentId: i.studentId,
        type: String(input.type || "WAIVER"),
        name: String(input.name || input.type || "WAIVER"),
        concessionType: String(input.concessionType || input.type || "WAIVER"),
        amount,
        percentage: input.percentage ? new Prisma.Decimal(String(input.percentage)) : null,
        reason: String(input.reason).trim(),
        requestedById: a.id,
        status: approved ? "APPROVED" : "PENDING",
        createdById: a.id, approvedById: approved ? a.id : null,
        approvedAt: approved ? new Date() : null,
      },
    });
    if (approved) await applyConcessionInTransaction(tx, institutionId, a, concession.id, s);
    return concession;
  });
  await audit(institutionId, a.id, "finance.concession.create", "FeeConcession", x.id, { invoiceId, amount: amount.toString() });
  return x;
}
export async function approveConcession(institutionId: string, a: AuthenticatedUser, id: string) {
  assertAccountsWorkspace(a, "Concession approval");
  if (!has(a, "fees.concession.approve")) throw new AppError("Concession approval permission required", 403);
  const s = await scope(institutionId, a);
  const y = await prisma.$transaction(async tx => {
    const candidate = await tx.feeConcession.findFirst({ where: { id, institutionId, status: "PENDING" }, select: { id: true, invoiceId: true } });
    if (!candidate) throw new AppError("Pending concession not found", 404);
    if (!candidate.invoiceId) throw new AppError("Concession is not linked to an invoice", 409);
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${candidate.invoiceId} AND "institutionId" = ${institutionId} FOR UPDATE`);
    const [visibleInvoice, freshCandidate] = await Promise.all([
      tx.feeInvoice.findFirst({ where: { id: candidate.invoiceId, ...invoiceWhere(s) }, select: { id: true } }),
      tx.feeConcession.findFirst({ where: { id, institutionId, status: "PENDING", invoiceId: candidate.invoiceId }, select: { id: true } }),
    ]);
    if (!visibleInvoice || !freshCandidate) throw new AppError("Concession is outside your financial scope or is no longer pending", 403);
    const claimed = await tx.feeConcession.updateMany({
      where: { id, institutionId, status: "PENDING", invoiceId: candidate.invoiceId },
      data: { status: "APPROVED", approvedById: a.id, approvedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError("Concession is already approved or is no longer pending", 409);
    await applyConcessionInTransaction(tx, institutionId, a, id, s);
    const updated = await tx.feeConcession.findFirst({ where: { id, institutionId } });
    if (!updated) throw new AppError("Concession not found after approval", 404);
    return updated;
  });
  await audit(institutionId, a.id, "finance.concession.approve", "FeeConcession", id);
  return y;
}

export async function cancelInvoice(institutionId:string,a:AuthenticatedUser,id:string){
 assertAccountsWorkspace(a, "Invoice cancellation");
 if(!has(a,"fees.invoice.manage"))throw new AppError("Invoice management permission required",403);
 const s=await scope(institutionId,a);
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT "id" FROM "fee_invoices" WHERE "id" = ${id} AND "institutionId" = ${institutionId} FOR UPDATE`);
  const current=await tx.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{id:true,status:true,paidAmount:true,studentId:true}});
  if(!current)throw new AppError("Invoice not found in authorized scope",404);
  if(Number(current.paidAmount)>0)throw new AppError("A settled invoice cannot be cancelled",409);
  if(current.status==="CANCELLED")return {invoice:current,changed:false,previousStatus:current.status};
  const previousStatus=current.status;
  const changed=await tx.feeInvoice.updateMany({
   where:{id,...invoiceWhere(s),status:previousStatus,paidAmount:0},
   data:{status:"CANCELLED",cancelledAt:new Date()},
  });
  if(changed.count!==1)throw new AppError("Invoice changed while cancellation was being processed; reload and retry",409);
  const invoice=await tx.feeInvoice.findFirst({where:{id,...invoiceWhere(s)},select:{id:true,status:true,paidAmount:true,studentId:true}});
  if(!invoice)throw new AppError("Invoice not found in authorized scope",404);
  return {invoice,changed:true,previousStatus};
 });
 if(result.changed)await audit(institutionId,a.id,"finance.invoice.cancel","FeeInvoice",id,{previousStatus:result.previousStatus});
 return result.invoice;
}


type FinanceExpenseRow = {
 id:string; institutionId:string; category:string; description:string; amount:Prisma.Decimal|number|string;
 vendor:string|null; reference:string|null; spentAt:Date; supportDetails:string|null; supportingDocumentUrl:string|null;
 campusId:string|null; departmentId:string|null; status:string; createdById:string; updatedById:string|null;
 approvedById:string|null; decisionComment:string|null; approvedAt:Date|null; createdAt:Date; updatedAt:Date;
};
type ExpenseScopeFilter = Scope & { actor: AuthenticatedUser };
function assertExpenseScope(s:Scope):void {
 if(s.studentIds) throw new AppError("Expense management is not available in student or parent scope",403);
}
function expenseWhere(institutionId:string,s:Scope):Prisma.Sql {
 const parts:Prisma.Sql[]=[Prisma.sql`"institutionId" = ${institutionId}`];
 if(s.departmentIds) parts.push(s.departmentIds.length?Prisma.sql`"departmentId" IN (${Prisma.join(s.departmentIds)})`:Prisma.sql`FALSE`);
 if(s.campusIds) parts.push(s.campusIds.length?Prisma.sql`"campusId" IN (${Prisma.join(s.campusIds)})`:Prisma.sql`FALSE`);
 return Prisma.join(parts," AND ");
}
async function assertExpenseContext(institutionId:string,s:Scope,input:any):Promise<{campusId:string|null;departmentId:string|null}> {
 const campusId=input.campusId ? String(input.campusId) : null;
 const departmentId=input.departmentId ? String(input.departmentId) : null;
 if(s.campusIds && (!campusId || !s.campusIds.includes(campusId))) throw new AppError("Choose a campus in your authorized campus scope",403);
 if(s.departmentIds && (!departmentId || !s.departmentIds.includes(departmentId))) throw new AppError("Choose a department in your authorized department scope",403);
 if(campusId) {
  const campus=await prisma.campus.findFirst({where:{id:campusId,institutionId},select:{id:true}});
  if(!campus) throw new AppError("Campus is outside this institution",403);
  if(s.campusIds && !s.campusIds.includes(campus.id)) throw new AppError("Campus is outside your authorized scope",403);
 }
 if(departmentId) {
  const where:any={id:departmentId,institutionId};
  if(campusId) where.campusId=campusId;
  if(s.departmentIds) where.id={in: s.departmentIds.filter(id=>id===departmentId)};
  if(s.campusIds) where.campusId={in:s.campusIds};
  const department=await prisma.department.findFirst({where,select:{id:true,campusId:true}});
  if(!department) throw new AppError("Department is outside this institution or authorized scope",403);
  if(campusId && department.campusId!==campusId) throw new AppError("The selected department does not belong to the selected campus",400);
 }
 return {campusId,departmentId};
}
async function visibleExpense(institutionId:string,s:Scope,id:string,forUpdate=false):Promise<FinanceExpenseRow> {
 const rows=await prisma.$queryRaw<FinanceExpenseRow[]>(Prisma.sql`SELECT * FROM "finance_expenses" WHERE "id" = ${id} AND ${expenseWhere(institutionId,s)} ${forUpdate?Prisma.sql`FOR UPDATE`:Prisma.empty}`);
 if(!rows.length) throw new AppError("Expense not found in authorized scope",404);
 return rows[0];
}
function expenseInput(input:any,context:{campusId:string|null;departmentId:string|null}) {
 return {
  category:String(input.category).trim(),
  description:String(input.description).trim(),
  amount:dec(input.amount),
  vendor:input.vendor?.trim()?String(input.vendor).trim():null,
  reference:input.reference?.trim()?String(input.reference).trim():null,
  spentAt:new Date(input.spentAt),
  supportDetails:input.supportDetails?.trim()?String(input.supportDetails).trim():null,
  supportingDocumentUrl:input.supportingDocumentUrl?.trim()?String(input.supportingDocumentUrl).trim():null,
  campusId:context.campusId,
  departmentId:context.departmentId,
 };
}
export async function listExpenses(institutionId:string,a:AuthenticatedUser,input:{status?:string;category?:string;search?:string}={}) {
 if(!has(a,"expenses.read")&&!has(a,"expenses.manage")&&!has(a,"expenses.approve")) throw new AppError("Expense visibility permission required",403);
 const s=await scope(institutionId,a); assertExpenseScope(s);
 const parts:Prisma.Sql[]=[expenseWhere(institutionId,s)];
 if(input.status) parts.push(Prisma.sql`"status" = ${input.status}`);
 if(input.category) parts.push(Prisma.sql`"category" = ${input.category}`);
 if(input.search) { const q=`%${input.search}%`; parts.push(Prisma.sql`("description" ILIKE ${q} OR COALESCE("vendor",'') ILIKE ${q} OR "category" ILIKE ${q} OR COALESCE("reference",'') ILIKE ${q})`); }
 return prisma.$queryRaw<FinanceExpenseRow[]>(Prisma.sql`SELECT * FROM "finance_expenses" WHERE ${Prisma.join(parts," AND ")} ORDER BY CASE "status" WHEN 'PENDING' THEN 0 WHEN 'REJECTED' THEN 1 ELSE 2 END, "spentAt" DESC, "createdAt" DESC LIMIT 500`);
}
export async function createExpense(institutionId:string,a:AuthenticatedUser,input:any) {
 assertAccountsWorkspace(a,"Expense creation");
 if(!has(a,"expenses.manage")) throw new AppError("Expense management permission required",403);
 const s=await scope(institutionId,a); assertExpenseScope(s);
 const context=await assertExpenseContext(institutionId,s,input);
 const x=expenseInput(input,context); const id=crypto.randomUUID();
 const created=await prisma.$transaction(async tx=>{
  const rows=await tx.$queryRaw<FinanceExpenseRow[]>(Prisma.sql`INSERT INTO "finance_expenses" ("id","institutionId","category","description","amount","vendor","reference","spentAt","supportDetails","supportingDocumentUrl","campusId","departmentId","status","createdById","updatedById","createdAt","updatedAt") VALUES (${id},${institutionId},${x.category},${x.description},${x.amount},${x.vendor},${x.reference},${x.spentAt},${x.supportDetails},${x.supportingDocumentUrl},${x.campusId},${x.departmentId},'PENDING',${a.id},${a.id},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`);
  await tx.$executeRaw(Prisma.sql`INSERT INTO "finance_expense_status_history" ("id","institutionId","expenseId","fromStatus","toStatus","comment","changedById","createdAt") VALUES (${crypto.randomUUID()},${institutionId},${id},NULL,'PENDING','Expense submitted for approval',${a.id},CURRENT_TIMESTAMP)`);
  return rows[0];
 });
 await audit(institutionId,a.id,"finance.expense.create","FinanceExpense",id,{amount:String(x.amount),category:x.category});
 return created;
}
export async function updateExpense(institutionId:string,a:AuthenticatedUser,id:string,input:any) {
 assertAccountsWorkspace(a,"Expense update");
 if(!has(a,"expenses.manage")) throw new AppError("Expense management permission required",403);
 const s=await scope(institutionId,a); assertExpenseScope(s);
 const context=await assertExpenseContext(institutionId,s,input); const x=expenseInput(input,context);
 const updated=await prisma.$transaction(async tx=>{
  const current=await visibleExpense(institutionId,s,id,true);
  if(!["PENDING","REJECTED"].includes(current.status)) throw new AppError("Approved expenses cannot be edited",409);
  const status=current.status==="REJECTED"?"PENDING":current.status;
  const rows=await tx.$queryRaw<FinanceExpenseRow[]>(Prisma.sql`UPDATE "finance_expenses" SET "category"=${x.category},"description"=${x.description},"amount"=${x.amount},"vendor"=${x.vendor},"reference"=${x.reference},"spentAt"=${x.spentAt},"supportDetails"=${x.supportDetails},"supportingDocumentUrl"=${x.supportingDocumentUrl},"campusId"=${x.campusId},"departmentId"=${x.departmentId},"status"=${status},"updatedById"=${a.id},"decisionComment"=NULL,"approvedById"=NULL,"approvedAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "institutionId"=${institutionId} RETURNING *`);
  if(current.status==="REJECTED") await tx.$executeRaw(Prisma.sql`INSERT INTO "finance_expense_status_history" ("id","institutionId","expenseId","fromStatus","toStatus","comment","changedById","createdAt") VALUES (${crypto.randomUUID()},${institutionId},${id},'REJECTED','PENDING','Edited and resubmitted for approval',${a.id},CURRENT_TIMESTAMP)`);
  return rows[0];
 });
 await audit(institutionId,a.id,"finance.expense.update","FinanceExpense",id,{status:updated.status});
 return updated;
}
export async function decideExpense(institutionId:string,a:AuthenticatedUser,id:string,input:{decision:"APPROVED"|"REJECTED";comment?:string}) {
 if(!has(a,"expenses.approve")) throw new AppError("Expense approval permission required",403);
 const s=await scope(institutionId,a); assertExpenseScope(s);
 const comment=String(input.comment||"").trim();
 if(input.decision==="REJECTED"&&comment.length<3) throw new AppError("A rejection reason is required",400);
 const updated=await prisma.$transaction(async tx=>{
  const current=await visibleExpense(institutionId,s,id,true);
  if(current.status!=="PENDING") throw new AppError("Only pending expenses can be approved or rejected",409);
  const rows=await tx.$queryRaw<FinanceExpenseRow[]>(Prisma.sql`UPDATE "finance_expenses" SET "status"=${input.decision},"decisionComment"=${comment||null},"approvedById"=${input.decision==="APPROVED"?a.id:null},"approvedAt"=${input.decision==="APPROVED"?new Date():null},"updatedById"=${a.id},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "institutionId"=${institutionId} AND "status"='PENDING' RETURNING *`);
  if(!rows.length) throw new AppError("Expense was already reviewed; reload and try again",409);
  await tx.$executeRaw(Prisma.sql`INSERT INTO "finance_expense_status_history" ("id","institutionId","expenseId","fromStatus","toStatus","comment","changedById","createdAt") VALUES (${crypto.randomUUID()},${institutionId},${id},'PENDING',${input.decision},${comment||null},${a.id},CURRENT_TIMESTAMP)`);
  return rows[0];
 });
 await audit(institutionId,a.id,input.decision==="APPROVED"?"finance.expense.approve":"finance.expense.reject","FinanceExpense",id,{comment});
 return updated;
}
export async function expenseHistory(institutionId:string,a:AuthenticatedUser,id:string) {
 if(!has(a,"expenses.read")&&!has(a,"expenses.manage")&&!has(a,"expenses.approve")) throw new AppError("Expense history permission required",403);
 const s=await scope(institutionId,a); assertExpenseScope(s);
 await visibleExpense(institutionId,s,id);
 return prisma.$queryRaw<Array<{id:string;fromStatus:string|null;toStatus:string;comment:string|null;changedById:string;createdAt:Date}>>(Prisma.sql`SELECT "id","fromStatus","toStatus","comment","changedById","createdAt" FROM "finance_expense_status_history" WHERE "institutionId"=${institutionId} AND "expenseId"=${id} ORDER BY "createdAt" DESC`);
}

async function pendingExpenseSummary(institutionId:string,s:Scope):Promise<{count:number;amount:number}> {
 assertExpenseScope(s);
 const rows=await prisma.$queryRaw<Array<{count:number;amount:number}>>(Prisma.sql`SELECT COUNT(*)::int AS count, COALESCE(SUM("amount"),0)::float8 AS amount FROM "finance_expenses" WHERE ${expenseWhere(institutionId,s)} AND "status"='PENDING'`);
 return {count:Number(rows[0]?.count||0),amount:Number(rows[0]?.amount||0)};
}
export async function exportExpenses(institutionId:string,a:AuthenticatedUser,format:ExportFormat) {
 if(!has(a,"expenses.export")) throw new AppError("Expense export permission required",403);
 const items=await listExpenses(institutionId,a,{});
 const rows=items.map(x=>({category:x.category,description:x.description,amount:Number(x.amount),vendor:x.vendor,reference:x.reference,spentAt:new Date(x.spentAt).toISOString(),campusId:x.campusId,departmentId:x.departmentId,status:x.status,supportDetails:x.supportDetails,supportingDocumentUrl:x.supportingDocumentUrl,decisionComment:x.decisionComment,createdAt:new Date(x.createdAt).toISOString(),approvedAt:x.approvedAt?new Date(x.approvedAt).toISOString():null}));
 const file=makeFile(rows,"fees",format);
 return {...file,filename:file.filename.replace("acadlyx-fees-","acadlyx-finance-expenses-")};
}
