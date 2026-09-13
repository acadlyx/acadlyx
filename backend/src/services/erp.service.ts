import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

const ADMIN_ROLES = ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD", "STAFF"];
const weekday = new Date().getDay();

function assertRole(user: AuthenticatedUser, allowed: string[]) {
  if (!user.roles.some((role) => allowed.includes(role))) throw new AppError("Not authorized for this ERP operation", 403);
}

async function assertStudentScope(institutionId: string, actor: AuthenticatedUser, studentId: string) {
  if (actor.id === studentId || actor.roles.some((role) => ADMIN_ROLES.includes(role))) return;
  if (actor.roles.includes("PARENT")) {
    const linked = await prisma.parentStudentLink.findFirst({ where: { institutionId, parentId: actor.id, studentId } });
    if (linked) return;
  }
  throw new AppError("Student data is outside your authorized scope", 403);
}

export async function getMyWorkspace(institutionId: string, actor: AuthenticatedUser) {
  const enrollment = await prisma.studentEnrollment.findFirst({ where: { institutionId, userId: actor.id }, select: { sectionId: true } });
  const facultyOfferings = await prisma.courseOffering.findMany({ where: { institutionId, facultyId: actor.id, isActive: true }, select: { id: true } });
  const sectionIds = enrollment?.sectionId ? [enrollment.sectionId] : [];
  const offeringIds = facultyOfferings.map((offering) => offering.id);
  const [timetable, notices, notifications, documents, fees, exams] = await Promise.all([
    prisma.timetableEntry.findMany({ where: { institutionId, dayOfWeek: weekday, OR: [{ courseOffering: { sectionId: { in: sectionIds } } }, { courseOfferingId: { in: offeringIds } }] }, include: { courseOffering: { include: { course: { select: { code: true, name: true } }, section: { select: { name: true } } } } }, orderBy: { startTime: "asc" } }),
    prisma.notice.findMany({ where: { institutionId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], audience: { in: ["ALL", ...actor.roles] } }, orderBy: { publishedAt: "desc" }, take: 10 }),
    prisma.notification.findMany({ where: { institutionId, userId: actor.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.document.findMany({ where: { institutionId, ownerId: actor.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.feeInvoice.findMany({ where: { institutionId, studentId: actor.id }, include: { payments: true }, orderBy: { createdAt: "desc" } }),
    prisma.examResult.findMany({ where: { institutionId, studentId: actor.id }, include: { exam: { include: { courseOffering: { include: { course: { select: { code: true, name: true } } } } } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { timetable, notices, notifications, documents, fees, exams };
}

export async function createTimetableEntry(institutionId: string, actor: AuthenticatedUser, input: { courseOfferingId: string; dayOfWeek: number; startTime: string; endTime: string; room?: string }) {
  assertRole(actor, ["INSTITUTION_ADMIN", "HOD", "STAFF"]);
  const offering = await prisma.courseOffering.findFirst({ where: { id: input.courseOfferingId, institutionId } });
  if (!offering) throw new AppError("Course offering not found in this institution", 404);
  const row = await prisma.timetableEntry.upsert({ where: { courseOfferingId_dayOfWeek_startTime: { courseOfferingId: input.courseOfferingId, dayOfWeek: input.dayOfWeek, startTime: input.startTime } }, update: { endTime: input.endTime, room: input.room || null }, create: { institutionId, ...input, room: input.room || null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "timetable.upsert", entityType: "TimetableEntry", entityId: row.id });
  return row;
}

export async function createNotice(institutionId: string, actor: AuthenticatedUser, input: { title: string; body: string; audience?: string; departmentId?: string; expiresAt?: string }) {
  assertRole(actor, ["INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD", "STAFF"]);
  const row = await prisma.notice.create({ data: { institutionId, createdById: actor.id, title: input.title, body: input.body, audience: input.audience || "ALL", departmentId: input.departmentId || null, expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } });
  await recordAuditLog({ institutionId, userId: actor.id, action: "notice.create", entityType: "Notice", entityId: row.id });
  return row;
}

export async function createExam(institutionId: string, actor: AuthenticatedUser, input: { courseOfferingId: string; title: string; examDate: string; maxMarks: number }) {
  assertRole(actor, ["INSTITUTION_ADMIN", "HOD", "FACULTY"]);
  const offering = await prisma.courseOffering.findFirst({ where: { id: input.courseOfferingId, institutionId, OR: actor.roles.includes("FACULTY") ? [{ facultyId: actor.id }] : undefined } });
  if (!offering) throw new AppError("Course offering is not authorized", 403);
  return prisma.exam.create({ data: { institutionId, createdById: actor.id, ...input, examDate: new Date(input.examDate) } });
}

export async function upsertExamResult(institutionId: string, actor: AuthenticatedUser, input: { examId: string; studentId: string; marks: number; remarks?: string }) {
  assertRole(actor, ["INSTITUTION_ADMIN", "HOD", "FACULTY"]);
  const exam = await prisma.exam.findFirst({ where: { id: input.examId, institutionId, OR: actor.roles.includes("FACULTY") ? [{ courseOffering: { facultyId: actor.id } }] : undefined } });
  if (!exam) throw new AppError("Exam is not authorized", 403);
  if (input.marks < 0 || input.marks > exam.maxMarks) throw new AppError("Marks must be within the exam maximum", 400);
  await assertStudentScope(institutionId, { ...actor, roles: ["INSTITUTION_ADMIN"] }, input.studentId);
  return prisma.examResult.upsert({ where: { examId_studentId: { examId: input.examId, studentId: input.studentId } }, update: { marks: input.marks, remarks: input.remarks || null, enteredById: actor.id }, create: { institutionId, examId: input.examId, studentId: input.studentId, marks: input.marks, remarks: input.remarks || null, enteredById: actor.id } });
}

export async function createInvoice(institutionId: string, actor: AuthenticatedUser, input: { studentId: string; title: string; amount: number; dueDate?: string }) {
  assertRole(actor, ["INSTITUTION_ADMIN", "STAFF"]);
  await assertStudentScope(institutionId, { ...actor, roles: ["INSTITUTION_ADMIN"] }, input.studentId);
  return prisma.feeInvoice.create({ data: { institutionId, studentId: input.studentId, title: input.title, amount: input.amount, dueDate: input.dueDate ? new Date(input.dueDate) : null } });
}

export async function recordPayment(institutionId: string, actor: AuthenticatedUser, invoiceId: string, amount: number, reference?: string) {
  const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, institutionId } });
  if (!invoice) throw new AppError("Invoice not found", 404);
  await assertStudentScope(institutionId, actor, invoice.studentId);
  if (actor.id !== invoice.studentId) assertRole(actor, ["INSTITUTION_ADMIN", "STAFF", "PARENT"]);
  const payment = await prisma.feePayment.create({ data: { institutionId, invoiceId, amount, reference: reference || null, userId: actor.id } });
  const paid = await prisma.feePayment.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  await prisma.feeInvoice.update({ where: { id: invoiceId }, data: { status: (paid._sum.amount || 0) >= invoice.amount ? "PAID" : "PARTIAL" } });
  return payment;
}

export async function linkParent(institutionId: string, actor: AuthenticatedUser, parentId: string, studentId: string, relationship?: string) {
  assertRole(actor, ["INSTITUTION_ADMIN", "STAFF"]);
  const count = await prisma.user.count({ where: { institutionId, id: { in: [parentId, studentId] } } });
  if (count !== 2) throw new AppError("Parent and student must belong to this institution", 400);
  return prisma.parentStudentLink.upsert({ where: { parentId_studentId: { parentId, studentId } }, update: { relationship: relationship || null }, create: { institutionId, parentId, studentId, relationship: relationship || null } });
}
