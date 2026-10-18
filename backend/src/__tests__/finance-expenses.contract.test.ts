import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(process.cwd());
function read(relativePath:string){return fs.readFileSync(path.join(root,relativePath),"utf8")}

test("finance expense persistence is tenant-bound and indexed for pending queues",()=>{
 const migration=read("prisma/migrations/20261018100000_finance_expense_management/migration.sql");
 assert.match(migration,/"institutionId" TEXT NOT NULL REFERENCES "institutions"\("id"\) ON DELETE CASCADE/);
 assert.match(migration,/"amount" DECIMAL\(14,2\) NOT NULL CHECK \("amount" > 0\)/);
 assert.match(migration,/"finance_expenses_institution_status_spentAt_idx"/);
 assert.match(migration,/"finance_expense_status_history_expense_createdAt_idx"/);
});

test("expense reads and decisions retain tenant/scope checks and immutable transition history",()=>{
 const service=read("src/services/finance.service.ts");
 assert.match(service,/function expenseWhere\(institutionId:string,s:Scope\)/);
 assert.match(service,/"institutionId" = \$\{institutionId\}/);
 assert.match(service,/visibleExpense\(institutionId,s,id,true,tx\)/);
 assert.match(service,/Only pending expenses can be approved or rejected/);
 assert.match(service,/UPDATE "finance_expenses"[\s\S]*?AND "status"='PENDING' RETURNING \*/);
 assert.match(service,/INSERT INTO "finance_expense_status_history"/);
 assert.match(service,/Approved expenses cannot be edited/);
});

test("expense approval has separate catalog permissions and authenticated routes",()=>{
 const rbac=read("src/config/rbac.ts");
 const routes=read("src/routes/finance.routes.ts");
 for(const permission of ["expenses.read","expenses.manage","expenses.approve","expenses.export"]) assert.ok(rbac.includes('"'+permission+'"'),"Missing permission "+permission);
 assert.match(routes,/router\.post\("\/expenses",authorize\("expenses\.manage"\)/);
 assert.match(routes,/router\.post\("\/expenses\/:id\/decision",authorize\("expenses\.approve"\)/);
 assert.match(routes,/router\.get\("\/expenses\/export",authorize\("expenses\.export"\)/);
});

test("financial summaries and invoice exports use net paid balances after refunds",()=>{
 const service=read("src/services/finance.service.ts");
 assert.match(service,/outstanding=Math\.max\(0,billed-Number\(invAgg\._sum\.paidAmount\|\|0\)\)/);
 assert.match(service,/const billed=Number\(x\.amount\),collected=Number\(x\.paidAmount\),outstanding=Math\.max\(0,billed-Number\(x\.paidAmount\)\)/);
 assert.match(service,/outstanding:x\.status==="CANCELLED"\?0:Math\.max\(0,Number\(x\.amount\)-Number\(x\.paidAmount\)\)/);
 assert.doesNotMatch(service,/Number\(x\.paidAmount\)-Number\(x\.refundedAmount\)/);
});

test("expense updates and decisions read FOR UPDATE inside the same transaction",()=>{
 const service=read("src/services/finance.service.ts");
 assert.match(service,/visibleExpense\(institutionId,s,id,true,tx\)/);
});

test("invoice overdue filter parses textual false as false",()=>{
 const validators=read("src/validators/finance.validators.ts");
 assert.match(validators,/overdueOnly:z\.enum\(\["true","false"\]\)\.transform\(value=>value==="true"\)\.optional\(\)/);
});

test("expense attachments and payment/refund integrations require provider-backed settlement",()=>{
 const storage=read("src/services/fileStorage.service.ts");
 const controller=read("src/controllers/fileStorage.controller.ts");
 const schema=read("src/validators/finance.validators.ts");
 const finance=read("src/services/finance.service.ts");
 const migration=read("prisma/migrations/20261019100000_finance_expense_supporting_files/migration.sql");
 const student=read("../frontend/src/components/student/StudentFinancePage.tsx");
 const gateway=read("src/services/payments/gateway.ts");
 const legacyBilling=read("src/services/feeBilling.service.ts");
 assert.match(storage,/expenses: \["application\/pdf"/);
 assert.match(controller,/module === "expenses" \? "expenses\.manage"/);
 assert.match(schema,/supportingDocumentFileId: z\.string\(\)\.uuid\(\)/);
 assert.match(finance,/module:"expenses",ownerId:a\.id,referenceId:null/);
 assert.match(migration,/"supportingDocumentFileId" TEXT/);
 assert.match(student,/startCheckout\(invoice\.id\)/);
 assert.match(student,/confirmPayment\(/);
 assert.match(gateway,/payment\.status === "captured"/);
 assert.match(gateway,/body\.event !== "payment\.captured"/);
 assert.match(finance,/gateway\.createRefund\(/);
 assert.match(finance,/gateway\.getRefund\(/);
 assert.match(finance,/confirmExternalSettlement/);
 assert.match(legacyBilling,/Direct PROCESSED transitions are disabled/);
});

test("attached expense files resolve through the authorized expense scope",()=>{\n const finance=read("src/services/finance.service.ts");\n const controller=read("src/controllers/fileStorage.controller.ts");\n assert.match(finance,/assertExpenseAttachmentAccessible/);\n assert.match(finance,/visibleExpense\(institutionId,s,file\.referenceId\)/);\n assert.match(finance,/expense\.supportingDocumentFileId!==file\.id/);\n assert.match(controller,/await assertExpenseAttachmentAccessible\(institutionId, actor, result\.file\.id\)/);\n assert.match(controller,/attached expense document must be replaced/);\n});