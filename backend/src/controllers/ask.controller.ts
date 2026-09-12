import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as intelligence from "../services/intelligence.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";

const intents: Array<[RegExp, string]> = [
  [/students?.*(immediate|intervention|risk)|immediate.*students?/i, "AT_RISK_STUDENTS"],
  [/departments?.*(attention|this month)|attention.*departments?/i, "DEPARTMENTS_NEEDING_ATTENTION"],
  [/attendance.*decline|largest.*attendance/i, "ATTENDANCE_DECLINE"],
  [/placement.*skill gaps?|skill gaps?/i, "PLACEMENT_SKILL_GAPS"],
  [/placement ready/i, "PLACEMENT_READY"],
  [/subjects?.*attendance risk|attendance risk.*subjects?/i, "SUBJECT_ATTENDANCE_RISK"],
];
export const ask = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req); if (!req.user?.permissions.includes("intelligence.read")) throw new AppError("Missing intelligence.read permission", 403);
  const question = typeof req.body.question === "string" ? req.body.question.trim().slice(0, 300) : "";
  const intent = intents.find(([pattern]) => pattern.test(question))?.[1];
  if (!intent) throw new AppError("Ask ACADLYX supports the suggested institutional intelligence questions only.", 400);
  if (intent === "AT_RISK_STUDENTS") {
    const students = await intelligence.getAtRiskStudents(institutionId);
    return res.json({ success: true, data: { intent, answer: `${students.length} students require immediate academic intervention.`, evidence: students.map(s => ({ student: `${s.student.firstName} ${s.student.lastName}`, risk: s.risk, academicHealth: s.scores.academicHealth, reasons: s.reasons })), actions: ["Assign faculty mentor follow-up", "Review attendance and overdue coursework"] } });
  }
  const dashboard = await intelligence.getInstitutionInsights(institutionId);
  const attendance = dashboard.kpis.attendance;
  const answer = intent === "DEPARTMENTS_NEEDING_ATTENTION" ? (attendance < 75 ? "Attendance is below the 75% institutional target; departments need attendance recovery plans." : "No institution-wide attendance target breach is currently detected.") : `Current institution attendance is ${attendance}%. Detailed ${intent.toLowerCase().replaceAll("_", " ")} data will appear as career and historical analytics are populated.`;
  res.json({ success: true, data: { intent, answer, evidence: dashboard.kpis, actions: dashboard.recommendedActions } });
});
