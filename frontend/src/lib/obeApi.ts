import { authedFetch } from "./auth";
import { buildQuery, Envelope } from "./httpShared";

export interface ObeOffering {
  id: string;
  course: { id: string; code: string; name: string };
  section: { id: string; name: string };
  semester: {
    id: string;
    number: number;
    name: string;
    programId: string;
    program: { id: string; name: string; code: string };
    academicYear: { id: string; name: string };
  };
  faculty?: { id: string; firstName: string; lastName: string } | null;
}

export interface ProgrammeOutcome {
  id: string;
  type: "PO" | "PSO";
  code: string;
  title?: string | null;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

export interface CourseOutcome {
  id: string;
  code: string;
  statement: string;
  bloomLevel?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface CourseOutcomeMapping {
  id: string;
  courseOutcomeId: string;
  programmeOutcomeId: string;
  level: number;
  remarks?: string | null;
  status: string;
}

export interface ObeAssessmentItem {
  id: string;
  itemCode: string;
  description?: string | null;
  maxMarks: number;
  displayOrder: number;
  courseOutcome: { id: string; code: string; statement: string };
  scores?: Array<{ studentId: string; marksObtained: number; isAbsent: boolean }>;
}

export interface ObeAssessment {
  id: string;
  name: string;
  type: string;
  maxMarks: number;
  weightage: number;
  assessmentDate?: string | null;
  status: "DRAFT" | "PUBLISHED" | "LOCKED";
  items: ObeAssessmentItem[];
}

export interface ObeAttainment {
  id: string;
  courseOutcome: CourseOutcome;
  directAttainment: number | null;
  indirectAttainment: number | null;
  finalAttainment: number | null;
  attainmentLevel: number | null;
  studentCount: number;
  studentsAssessed: number;
  studentsMeetingTarget: number;
}

export interface ObePolicy {
  id: string;
  name: string;
  scopeType: "INSTITUTION" | "PROGRAM";
  programId?: string | null;
  directWeight: number;
  indirectWeight: number;
  level1Threshold: number;
  level2Threshold: number;
  level3Threshold: number;
  minimumPassingPercentage: number;
  isDefault: boolean;
  isActive: boolean;
}

export async function listObeOfferings(): Promise<ObeOffering[]> {
  const res = await authedFetch<Envelope<ObeOffering[]>>("/obe/course-offerings");
  return res.data;
}

export async function listProgrammeOutcomes(programId: string): Promise<ProgrammeOutcome[]> {
  const res = await authedFetch<Envelope<ProgrammeOutcome[]>>(`/obe/programs/${programId}/outcomes`);
  return res.data;
}

export async function createProgrammeOutcome(programId: string, input: Omit<ProgrammeOutcome, "id" | "isActive">): Promise<ProgrammeOutcome> {
  const res = await authedFetch<Envelope<ProgrammeOutcome>>(`/obe/programs/${programId}/outcomes`, { method: "POST", body: JSON.stringify(input) });
  return res.data;
}

export async function listCourseOutcomes(courseId: string): Promise<CourseOutcome[]> {
  const res = await authedFetch<Envelope<CourseOutcome[]>>(`/obe/courses/${courseId}/outcomes`);
  return res.data;
}

export async function createCourseOutcome(courseId: string, input: { code: string; statement: string; bloomLevel?: string; displayOrder?: number }): Promise<CourseOutcome> {
  const res = await authedFetch<Envelope<CourseOutcome>>(`/obe/courses/${courseId}/outcomes`, { method: "POST", body: JSON.stringify(input) });
  return res.data;
}

export async function getMapping(courseOfferingId: string): Promise<{ offering: ObeOffering; outcomes: CourseOutcome[]; programmeOutcomes: ProgrammeOutcome[]; mappings: CourseOutcomeMapping[] }> {
  const res = await authedFetch<Envelope<{ offering: ObeOffering; outcomes: CourseOutcome[]; programmeOutcomes: ProgrammeOutcome[]; mappings: CourseOutcomeMapping[] }>>(`/obe/course-offerings/${courseOfferingId}/mapping`);
  return res.data;
}

export async function replaceMapping(courseOfferingId: string, mappings: Array<{ courseOutcomeId: string; programmeOutcomeId: string; level: number }>) {
  const res = await authedFetch<Envelope<unknown>>(`/obe/course-offerings/${courseOfferingId}/mapping`, { method: "PUT", body: JSON.stringify({ mappings }) });
  return res.data;
}

export async function submitMapping(courseOfferingId: string) {
  const res = await authedFetch<Envelope<unknown>>(`/obe/course-offerings/${courseOfferingId}/mapping/submit`, { method: "POST" });
  return res.data;
}

export async function reviewMapping(courseOfferingId: string, decision: "approve" | "return") {
  const path = decision === "approve" ? "approve" : "return";
  const res = await authedFetch<Envelope<unknown>>(`/obe/course-offerings/${courseOfferingId}/mapping/${path}`, { method: "POST" });
  return res.data;
}

export async function listObeAssessments(courseOfferingId: string): Promise<ObeAssessment[]> {
  const res = await authedFetch<Envelope<ObeAssessment[]>>(`/obe/course-offerings/${courseOfferingId}/assessments`);
  return res.data;
}

export async function createObeAssessment(input: { courseOfferingId: string; name: string; type: string; maxMarks: number; weightage?: number }) {
  const res = await authedFetch<Envelope<ObeAssessment>>("/obe/assessments", { method: "POST", body: JSON.stringify(input) });
  return res.data;
}

export async function updateObeAssessment(assessmentId: string, status: ObeAssessment["status"]) {
  const res = await authedFetch<Envelope<ObeAssessment>>(`/obe/assessments/${assessmentId}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return res.data;
}

export async function replaceAssessmentItems(assessmentId: string, items: Array<{ itemCode: string; description?: string; maxMarks: number; courseOutcomeId: string; displayOrder?: number }>) {
  const res = await authedFetch<Envelope<ObeAssessment>>(`/obe/assessments/${assessmentId}/items`, { method: "PUT", body: JSON.stringify({ items }) });
  return res.data;
}

export async function replaceAssessmentItemScores(assessmentItemId: string, scores: Array<{ studentId: string; marksObtained: number; isAbsent?: boolean }>) {
  const res = await authedFetch<Envelope<unknown>>(`/obe/assessment-items/${assessmentItemId}/scores`, { method: "PUT", body: JSON.stringify({ scores }) });
  return res.data;
}

export async function calculateAttainment(courseOfferingId: string, policyId?: string) {
  const res = await authedFetch<Envelope<{ offering: ObeOffering; items: ObeAttainment[] }>>(`/obe/course-offerings/${courseOfferingId}/attainment/calculate`, { method: "POST", body: JSON.stringify({ policyId }) });
  return res.data;
}

export async function getAttainment(courseOfferingId: string) {
  const res = await authedFetch<Envelope<{ offering: ObeOffering; items: ObeAttainment[] }>>(`/obe/course-offerings/${courseOfferingId}/attainment`);
  return res.data;
}

export async function calculateProgrammeAttainment(input: { programId: string; academicYearId: string; semesterId: string; policyId?: string }) {
  const res = await authedFetch<Envelope<unknown>>(`/obe/programmes/${input.programId}/attainment/calculate`, { method: "POST", body: JSON.stringify(input) });
  return res.data;
}

export async function listObePolicies() {
  const res = await authedFetch<Envelope<ObePolicy[]>>("/obe/policies");
  return res.data;
}

export async function getAssessmentItemScores(assessmentItemId: string) {
  const res = await authedFetch<Envelope<{ item: ObeAssessmentItem; roster: Array<{ studentId: string; firstName: string; lastName: string; rollNumber?: string | null }>; scores: Array<{ studentId: string; marksObtained: number; isAbsent: boolean }> }>>(`/obe/assessment-items/${assessmentItemId}/scores`);
  return res.data;
}

export const OBE_QUERY = buildQuery;
