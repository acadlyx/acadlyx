import { z } from "zod";

export const programmeOutcomeTypeSchema = z.enum(["PO", "PSO"]);
export const obeStatusSchema = z.enum(["DRAFT", "SUBMITTED", "APPROVED", "RETURNED"]);

export const createProgrammeOutcomeSchema = z.object({
  type: programmeOutcomeTypeSchema,
  code: z.string().trim().min(2).max(20).toUpperCase(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().min(3).max(3000),
  displayOrder: z.number().int().min(0).max(999).optional(),
});

export const updateProgrammeOutcomeSchema = createProgrammeOutcomeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createCourseOutcomeSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  statement: z.string().trim().min(3).max(2000),
  bloomLevel: z.string().trim().max(80).optional(),
  displayOrder: z.number().int().min(0).max(999).optional(),
});

export const updateCourseOutcomeSchema = createCourseOutcomeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const mappingRowSchema = z.object({
  courseOutcomeId: z.string().uuid(),
  programmeOutcomeId: z.string().uuid(),
  level: z.number().int().min(0).max(3),
  remarks: z.string().trim().max(1000).optional(),
});

export const replaceMappingSchema = z.object({
  mappings: z.array(mappingRowSchema).max(1000),
});

export const createAssessmentSchema = z.object({
  courseOfferingId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  type: z.string().trim().min(2).max(50).toUpperCase(),
  maxMarks: z.number().positive().max(100000),
  weightage: z.number().positive().max(100).optional(),
  assessmentDate: z.coerce.date().optional(),
  sourceType: z.string().trim().max(50).optional(),
  sourceId: z.string().uuid().optional(),
});

export const updateAssessmentSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "LOCKED"]),
});

export const updateAssessmentItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    itemCode: z.string().trim().min(1).max(30),
    description: z.string().trim().max(1000).optional(),
    maxMarks: z.number().positive().max(10000),
    courseOutcomeId: z.string().uuid(),
    displayOrder: z.number().int().min(0).max(999).optional(),
  })).max(500),
});

export const scoreRowSchema = z.object({
  studentId: z.string().uuid(),
  marksObtained: z.number().min(0).max(100000),
  isAbsent: z.boolean().optional(),
  remarks: z.string().trim().max(1000).optional(),
});

export const replaceScoresSchema = z.object({
  scores: z.array(scoreRowSchema).max(10000),
});

export const calculateAttainmentSchema = z.object({
  policyId: z.string().uuid().optional(),
});

export const createPolicySchema = z.object({
  name: z.string().trim().min(2).max(150),
  programId: z.string().uuid().optional(),
  scopeType: z.enum(["INSTITUTION", "PROGRAM"]).default("INSTITUTION"),
  directWeight: z.number().min(0).max(1).default(1),
  indirectWeight: z.number().min(0).max(1).default(0),
  level1Threshold: z.number().min(0).max(100).default(60),
  level2Threshold: z.number().min(0).max(100).default(70),
  level3Threshold: z.number().min(0).max(100).default(80),
  minimumPassingPercentage: z.number().min(0).max(100).default(50),
  isDefault: z.boolean().default(false),
});

export const updatePolicySchema = createPolicySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const programmeAttainmentSchema = z.object({
  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  semesterId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
});

export const createRunSchema = z.object({
  programId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  semesterId: z.string().uuid(),
  policyId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
});

export type CreateProgrammeOutcomeInput = z.infer<typeof createProgrammeOutcomeSchema>;
export type UpdateProgrammeOutcomeInput = z.infer<typeof updateProgrammeOutcomeSchema>;
export type CreateCourseOutcomeInput = z.infer<typeof createCourseOutcomeSchema>;
export type UpdateCourseOutcomeInput = z.infer<typeof updateCourseOutcomeSchema>;
export type ReplaceMappingInput = z.infer<typeof replaceMappingSchema>;
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type UpdateAssessmentItemsInput = z.infer<typeof updateAssessmentItemsSchema>;
export type ReplaceScoresInput = z.infer<typeof replaceScoresSchema>;
export type CalculateAttainmentInput = z.infer<typeof calculateAttainmentSchema>;
export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
export type ProgrammeAttainmentInput = z.infer<typeof programmeAttainmentSchema>;
export type CreateRunInput = z.infer<typeof createRunSchema>;
