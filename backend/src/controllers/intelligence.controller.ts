import { Request } from "express";
import { AppError } from "../middleware/errorHandler";
import * as intelligence from "../services/intelligence.service";
import * as career from "../services/careerIntelligence.service";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";

const user = (req: Request) => { if (!req.user) throw new AppError("Authentication required", 401); return req.user; };
async function permittedDepartments(institutionId: string, userId: string, roles: string[]) {
  if (roles.some(r => ["MANAGEMENT", "DIRECTOR", "INSTITUTION_ADMIN", "SUPER_ADMIN"].includes(r))) return undefined;
  return (await prisma.departmentAccess.findMany({ where: { userId, department: { institutionId } }, select: { departmentId: true } })).map(x => x.departmentId);
}
function canReadOther(req: Request) { return user(req).permissions.includes("intelligence.read"); }

export const student = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req); const actor = user(req);
  const studentId = req.params.id === "me" ? actor.id : req.params.id;
  if (studentId !== actor.id && !canReadOther(req)) throw new AppError("Not authorized to view this student intelligence", 403);
  const data = await intelligence.getStudentIntelligence(institutionId, studentId);
  if (!data) throw new AppError("Student not found", 404);
  res.json({ success: true, data });
});
export const studentRisk = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req); const actor = user(req); const id = req.params.id === "me" ? actor.id : req.params.id;
  if (id !== actor.id && !canReadOther(req)) throw new AppError("Not authorized", 403);
  const data = await intelligence.getStudentIntelligence(institutionId, id); if (!data) throw new AppError("Student not found", 404);
  res.json({ success: true, data: { risk: data.risk, reasons: data.reasons, academicHealth: data.scores.academicHealth } });
});
export const recommendations = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req); const actor = user(req); const id = req.params.id === "me" ? actor.id : req.params.id;
  if (id !== actor.id && !canReadOther(req)) throw new AppError("Not authorized", 403);
  const data = await intelligence.getStudentIntelligence(institutionId, id); if (!data) throw new AppError("Student not found", 404);
  res.json({ success: true, data: { recommendations: data.recommendations } });
});
export const careerProfile = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req); const actor = user(req); const id = req.params.id === "me" ? actor.id : req.params.id;
  if (id !== actor.id && !canReadOther(req)) throw new AppError("Not authorized", 403);
  const health = await intelligence.getStudentIntelligence(institutionId, id);
  res.json({ success: true, data: await career.getCareerIntelligence(institutionId, id, health?.scores.academicHealth || 0) });
});
export const commandCenter = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req); const actor = user(req);
  const allowed = await permittedDepartments(institutionId, actor.id, actor.roles);
  const requestedDepartment = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
  if (requestedDepartment && allowed && !allowed.includes(requestedDepartment)) throw new AppError("Department not authorized", 403);
  const departmentId = requestedDepartment || (allowed?.length === 1 ? allowed[0] : undefined);
  if (allowed && !departmentId) throw new AppError("A department scope is required for this account", 403);
  const parseDate = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) throw new AppError("Invalid date filter", 400);
    return date;
  };
  const data = await intelligence.getInstitutionInsights(institutionId, { departmentId, programId: typeof req.query.programId === "string" ? req.query.programId : undefined, semesterId: typeof req.query.semesterId === "string" ? req.query.semesterId : undefined, from: parseDate(req.query.from), to: parseDate(req.query.to) });
  const atRiskStudents = await intelligence.getAtRiskStudents(institutionId, departmentId ? [departmentId] : undefined);
  res.json({ success: true, data: { ...data, atRiskStudents } });
});
