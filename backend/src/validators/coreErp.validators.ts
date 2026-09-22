import { z } from "zod";

import {
  dateInput,
  optionalDate,
  optionalText,
  optionalUuid,
  pageQuery,
  uuid,
} from "./common";

/**
 * Validators for the modules added in the core-ERP completion phase.
 *
 * These are the outermost gate only: every service re-checks tenant
 * ownership, role authority and business state regardless of what got
 * through here.
 */

const HH_MM = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour HH:MM time");

const shortText = (max: number) => z.string().trim().min(1).max(max);

// ==========================================================
// EXAMINATIONS
// ==========================================================

export const examSessionListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "PUBLISHED", "CANCELLED"])
    .optional(),
  examType: z
    .enum(["REGULAR", "SUPPLEMENTARY", "REVALUATION", "IMPROVEMENT"])
    .optional(),
});

export const createExamSessionSchema = z.object({
  name: shortText(150),
  code: shortText(40),
  examType: z.enum(["REGULAR", "SUPPLEMENTARY", "REVALUATION", "IMPROVEMENT"]),
  startDate: dateInput,
  endDate: dateInput,
  academicYearId: optionalUuid,
  semesterId: optionalUuid,
  hallTicketReleaseAt: optionalDate,
  instructions: optionalText(2000),
});

export const updateExamSessionSchema = z.object({
  name: optionalText(150),
  startDate: optionalDate,
  endDate: optionalDate,
  hallTicketReleaseAt: optionalDate,
  instructions: optionalText(2000),
});

export const examSessionStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SCHEDULED",
    "ONGOING",
    "COMPLETED",
    "PUBLISHED",
    "CANCELLED",
  ]),
});

export const createExamRoomSchema = z.object({
  name: shortText(120),
  code: shortText(30),
  capacity: z.coerce.number().int().min(1).max(2000),
  campusId: optionalUuid,
  building: optionalText(120),
  floor: optionalText(30),
  rowCount: z.coerce.number().int().min(1).max(100).optional(),
  columnCount: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateExamRoomSchema = z.object({
  name: optionalText(120),
  capacity: z.coerce.number().int().min(1).max(2000).optional(),
  building: optionalText(120),
  floor: optionalText(30),
  isActive: z.coerce.boolean().optional(),
});

export const createExamScheduleSchema = z.object({
  examSessionId: uuid,
  courseOfferingId: uuid,
  examDate: dateInput,
  startTime: HH_MM,
  endTime: HH_MM,
  maxMarks: z.coerce.number().positive().max(1000),
  passMarks: z.coerce.number().min(0).max(1000),
  instructions: optionalText(2000),
});

export const updateExamScheduleSchema = z.object({
  examDate: optionalDate,
  startTime: HH_MM.optional(),
  endTime: HH_MM.optional(),
  maxMarks: z.coerce.number().positive().max(1000).optional(),
  passMarks: z.coerce.number().min(0).max(1000).optional(),
  instructions: optionalText(2000),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
});

export const allocateSeatingSchema = z.object({
  roomIds: z.array(uuid).min(1).max(50),
});

export const assignInvigilatorsSchema = z.object({
  assignments: z
    .array(
      z.object({
        facultyId: uuid,
        examRoomId: uuid,
        dutyRole: z.enum(["CHIEF", "ASSISTANT"]).optional(),
      })
    )
    .min(1)
    .max(100),
});

export const examAttendanceSchema = z.object({
  entries: z
    .array(
      z.object({
        studentId: uuid,
        status: z.enum(["PRESENT", "ABSENT", "DEBARRED", "MALPRACTICE"]),
        bookletNumber: optionalText(50),
        remarks: optionalText(500),
      })
    )
    .min(1)
    .max(500),
});

export const saveExamMarksSchema = z.object({
  submit: z.coerce.boolean().optional().default(false),
  entries: z
    .array(
      z.object({
        studentId: uuid,
        marksObtained: z.coerce.number().min(0).max(1000).nullable().optional(),
        isAbsent: z.coerce.boolean().optional(),
        remarks: optionalText(500),
      })
    )
    .min(1)
    .max(500),
});

export const hallTicketStatusSchema = z.object({
  status: z.enum(["ISSUED", "BLOCKED", "REVOKED"]),
  reason: optionalText(500),
});

export const requestRevaluationSchema = z.object({
  examScheduleId: uuid,
  studentId: optionalUuid,
  reason: shortText(1000),
  feeAmount: z.coerce.number().min(0).max(100000).optional(),
});

export const decideRevaluationSchema = z.object({
  status: z.enum(["IN_REVIEW", "COMPLETED", "REJECTED"]),
  revisedMarks: z.coerce.number().min(0).max(1000).optional(),
  decisionNote: optionalText(1000),
});

export const revaluationListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["REQUESTED", "PAID", "IN_REVIEW", "COMPLETED", "REJECTED"])
    .optional(),
  examScheduleId: optionalUuid,
  mine: z.coerce.boolean().optional(),
});

export const reportIncidentSchema = z.object({
  examScheduleId: uuid,
  studentId: uuid,
  category: shortText(80),
  description: shortText(2000),
  severity: z.enum(["MINOR", "MAJOR"]).optional(),
});

export const decideIncidentSchema = z.object({
  status: z.enum(["REPORTED", "UNDER_REVIEW", "UPHELD", "DISMISSED"]),
  actionTaken: optionalText(1000),
});

export const incidentListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["REPORTED", "UNDER_REVIEW", "UPHELD", "DISMISSED"])
    .optional(),
  examScheduleId: optionalUuid,
});

// ==========================================================
// ATTENDANCE GOVERNANCE
// ==========================================================

export const attendancePolicySchema = z.object({
  name: shortText(120),
  scope: z.enum(["INSTITUTION", "DEPARTMENT", "PROGRAM"]),
  departmentId: optionalUuid,
  programId: optionalUuid,
  minPercentage: z.coerce.number().min(0).max(100),
  warnPercentage: z.coerce.number().min(0).max(100),
  condonationPercentage: z.coerce.number().min(0).max(100).optional(),
  countExcusedAsPresent: z.coerce.boolean().optional(),
  blockHallTicket: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
});

export const correctionRequestSchema = z.object({
  attendanceSessionId: uuid,
  studentId: optionalUuid,
  requestedStatus: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
  reason: shortText(1000),
  evidenceUrl: optionalText(500),
  leaveRequestId: optionalUuid,
});

export const decideCorrectionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: optionalText(1000),
});

export const correctionListQuery = z.object({
  ...pageQuery,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  courseOfferingId: optionalUuid,
  mine: z.coerce.boolean().optional(),
});

export const shortageScanSchema = z.object({
  courseOfferingId: optionalUuid,
  departmentId: optionalUuid,
});

export const shortageListQuery = z.object({
  ...pageQuery,
  level: z.enum(["WARNING", "SHORTAGE"]).optional(),
  studentId: optionalUuid,
});

export const lockSessionsSchema = z.object({
  courseOfferingId: uuid,
  through: dateInput,
});

export const setLockSchema = z.object({
  locked: z.coerce.boolean(),
});

// ==========================================================
// LMS
// ==========================================================

export const createModuleSchema = z.object({
  courseOfferingId: uuid,
  title: shortText(200),
  description: optionalText(2000),
  sequence: z.coerce.number().int().min(1).max(500).optional(),
  availableFrom: optionalDate,
});

export const updateModuleSchema = z.object({
  title: optionalText(200),
  description: optionalText(2000),
  sequence: z.coerce.number().int().min(1).max(500).optional(),
  isPublished: z.coerce.boolean().optional(),
  availableFrom: optionalDate,
});

export const createLessonSchema = z.object({
  courseModuleId: uuid,
  title: shortText(200),
  summary: optionalText(1000),
  content: optionalText(50000),
  contentType: z.enum(["TEXT", "VIDEO", "LINK", "FILE", "EMBED"]).optional(),
  sequence: z.coerce.number().int().min(1).max(500).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1000).optional(),
});

export const updateLessonSchema = z.object({
  title: optionalText(200),
  summary: optionalText(1000),
  content: optionalText(50000),
  contentType: z.enum(["TEXT", "VIDEO", "LINK", "FILE", "EMBED"]).optional(),
  sequence: z.coerce.number().int().min(1).max(500).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1000).optional(),
  isPublished: z.coerce.boolean().optional(),
});

export const lessonResourceSchema = z.object({
  title: shortText(200),
  url: z.string().url().max(1000),
  resourceType: z.enum(["LINK", "PDF", "SLIDES", "VIDEO", "DATASET", "OTHER"]).optional(),
  sizeKb: z.coerce.number().int().min(0).max(5_000_000).optional(),
});

export const lessonProgressSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  secondsSpent: z.coerce.number().int().min(0).max(86_400).optional(),
});

export const questionListQuery = z.object({
  ...pageQuery,
  courseId: optionalUuid,
  courseOfferingId: optionalUuid,
  questionType: z
    .enum([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "TRUE_FALSE",
      "SHORT_ANSWER",
      "LONG_ANSWER",
    ])
    .optional(),
});

export const createQuestionSchema = z.object({
  questionType: z.enum([
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
    "TRUE_FALSE",
    "SHORT_ANSWER",
    "LONG_ANSWER",
  ]),
  prompt: shortText(4000),
  defaultMarks: z.coerce.number().positive().max(100).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  explanation: optionalText(2000),
  topic: optionalText(120),
  courseId: optionalUuid,
  courseOfferingId: optionalUuid,
  options: z
    .array(
      z.object({
        label: shortText(1000),
        isCorrect: z.coerce.boolean(),
      })
    )
    .max(10)
    .optional(),
});

export const createQuizSchema = z.object({
  courseOfferingId: uuid,
  courseModuleId: optionalUuid,
  title: shortText(200),
  description: optionalText(2000),
  passMarks: z.coerce.number().min(0).max(1000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).optional(),
  attemptsAllowed: z.coerce.number().int().min(1).max(10).optional(),
  opensAt: optionalDate,
  closesAt: optionalDate,
  shuffleQuestions: z.coerce.boolean().optional(),
  showResultsImmediately: z.coerce.boolean().optional(),
  gradingMode: z.enum(["AUTO", "MANUAL"]).optional(),
});

export const quizQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        questionBankItemId: uuid,
        marks: z.coerce.number().positive().max(100).optional(),
      })
    )
    .min(1)
    .max(200),
});

export const quizStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});

export const submitAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionBankItemId: uuid,
        selectedOptionIds: z.array(uuid).max(10).optional(),
        textAnswer: optionalText(20000),
      })
    )
    .min(1)
    .max(200),
});

export const gradeAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        answerId: uuid,
        awardedMarks: z.coerce.number().min(0).max(100),
        feedback: optionalText(2000),
      })
    )
    .min(1)
    .max(200),
  feedback: optionalText(2000),
});

export const courseOfferingQuery = z.object({
  courseOfferingId: uuid,
});

// ==========================================================
// FEES
// ==========================================================

export const concessionListQuery = z.object({
  ...pageQuery,
  studentId: optionalUuid,
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const createConcessionSchema = z.object({
  studentId: uuid,
  name: shortText(150),
  concessionType: z.enum(["SCHOLARSHIP", "CONCESSION", "WAIVER", "SPONSORSHIP"]),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  percentage: z.coerce.number().positive().max(100).optional(),
  feeStructureId: optionalUuid,
  academicYearId: optionalUuid,
  reason: optionalText(1000),
});

export const decideConcessionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

export const generateInvoicesSchema = z.object({
  feeStructureId: uuid,
  studentIds: z.array(uuid).max(2000).optional(),
  firstDueDate: dateInput,
  installmentGapDays: z.coerce.number().int().min(1).max(365).optional(),
});

export const invoiceListQuery = z.object({
  ...pageQuery,
  studentId: optionalUuid,
  status: z
    .enum(["PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"])
    .optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export const cancelInvoiceSchema = z.object({
  reason: shortText(500),
});

export const offlinePaymentSchema = z.object({
  invoiceId: uuid,
  amount: z.coerce.number().positive().max(10_000_000),
  method: z.enum(["CASH", "CHEQUE", "NEFT", "DD", "UPI", "CARD", "OFFLINE"]),
  reference: optionalText(120),
  notes: optionalText(500),
});

export const confirmPaymentSchema = z.object({
  invoiceId: uuid,
  orderId: shortText(200),
  paymentId: shortText(200),
  signature: shortText(500),
  amount: z.coerce.number().positive().max(10_000_000),
});

export const lateFeeRuleSchema = z.object({
  name: shortText(120),
  graceDays: z.coerce.number().int().min(0).max(365).optional(),
  chargeType: z.enum(["FLAT", "PERCENT"]),
  chargeValue: z.coerce.number().min(0).max(1_000_000),
  perDay: z.coerce.boolean().optional(),
  maxAmount: z.coerce.number().min(0).max(1_000_000).optional(),
});

export const refundRequestSchema = z.object({
  feePaymentId: uuid,
  amount: z.coerce.number().positive().max(10_000_000),
  reason: shortText(1000),
});

export const decideRefundSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PROCESSED"]),
  reference: optionalText(120),
});

export const refundListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["REQUESTED", "APPROVED", "REJECTED", "PROCESSED"])
    .optional(),
});

export const reconciliationSchema = z.object({
  provider: shortText(60),
  statementReference: shortText(120),
  periodStart: dateInput,
  periodEnd: dateInput,
  entries: z
    .array(
      z.object({
        externalReference: shortText(200),
        amount: z.coerce.number().min(0).max(10_000_000),
        valueDate: optionalDate,
      })
    )
    .min(1)
    .max(5000),
});

// ==========================================================
// OPERATIONS
// ==========================================================

export const assetListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "RETIRED", "LOST"])
    .optional(),
  assetCategoryId: optionalUuid,
  departmentId: optionalUuid,
});

export const assetCategorySchema = z.object({
  name: shortText(120),
  code: shortText(30),
});

export const createAssetSchema = z.object({
  name: shortText(200),
  assetTag: shortText(60),
  assetCategoryId: optionalUuid,
  campusId: optionalUuid,
  departmentId: optionalUuid,
  serialNumber: optionalText(120),
  location: optionalText(200),
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
  unitCost: z.coerce.number().min(0).max(100_000_000).optional(),
  purchaseDate: optionalDate,
  warrantyEndsAt: optionalDate,
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).optional(),
  status: z
    .enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "RETIRED", "LOST"])
    .optional(),
  assignedToId: optionalUuid,
  notes: optionalText(1000),
});

export const updateAssetSchema = z.object({
  name: optionalText(200),
  location: optionalText(200),
  quantity: z.coerce.number().int().min(1).max(100000).optional(),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).optional(),
  status: z
    .enum(["IN_USE", "IN_STORE", "UNDER_REPAIR", "RETIRED", "LOST"])
    .optional(),
  departmentId: optionalUuid,
  assignedToId: z.union([uuid, z.null()]).optional(),
  notes: optionalText(1000),
});

export const facilityListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  includeInactive: z.coerce.boolean().optional(),
  facilityType: optionalText(60),
});

export const createFacilitySchema = z.object({
  name: shortText(200),
  code: shortText(30),
  facilityType: z
    .enum(["CLASSROOM", "LAB", "AUDITORIUM", "LIBRARY", "HOSTEL", "SPORTS", "OTHER"])
    .optional(),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  campusId: optionalUuid,
  location: optionalText(200),
});

export const updateFacilitySchema = z.object({
  name: optionalText(200),
  facilityType: z
    .enum(["CLASSROOM", "LAB", "AUDITORIUM", "LIBRARY", "HOSTEL", "SPORTS", "OTHER"])
    .optional(),
  capacity: z.coerce.number().int().min(1).max(100000).optional(),
  location: optionalText(200),
  isActive: z.coerce.boolean().optional(),
});

export const createMaintenanceSchema = z.object({
  facilityId: optionalUuid,
  assetId: optionalUuid,
  title: shortText(200),
  description: shortText(4000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const updateMaintenanceSchema = z.object({
  status: z
    .enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"])
    .optional(),
  assignedToId: optionalUuid,
  resolutionNote: optionalText(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const maintenanceListQuery = z.object({
  ...pageQuery,
  status: z
    .enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "REJECTED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  mine: z.coerce.boolean().optional(),
  assignedToMe: z.coerce.boolean().optional(),
});

// ==========================================================
// SECURITY
// ==========================================================

export const verifyMfaSchema = z.object({
  challengeToken: z.string().min(32).max(200),
  code: z.string().trim().min(6).max(20),
});

export const confirmMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "must be a 6-digit code"),
});

export const disableMfaSchema = z.object({
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(32).max(200),
  newPassword: z
    .string()
    .min(10, "must be at least 10 characters")
    .max(200)
    .regex(/[a-z]/, "must contain a lowercase letter")
    .regex(/[A-Z]/, "must contain an uppercase letter")
    .regex(/\d/, "must contain a digit"),
});

// ==========================================================
// SaaS
// ==========================================================

export const planSchema = z.object({
  code: shortText(40),
  name: shortText(120),
  description: optionalText(1000),
  monthlyPrice: z.coerce.number().min(0).max(10_000_000).optional(),
  annualPrice: z.coerce.number().min(0).max(100_000_000).optional(),
  currency: optionalText(10),
  trialDays: z.coerce.number().int().min(0).max(365).optional(),
  studentLimit: z.coerce.number().int().min(0).nullable().optional(),
  userLimit: z.coerce.number().int().min(0).nullable().optional(),
  facultyLimit: z.coerce.number().int().min(0).nullable().optional(),
  storageLimitMb: z.coerce.number().int().min(0).nullable().optional(),
  features: z.array(z.string().trim().max(60)).max(100),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const assignPlanSchema = z.object({
  institutionId: uuid,
  planCode: shortText(40),
  status: z
    .enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"])
    .optional(),
  startTrial: z.coerce.boolean().optional(),
  expiresAt: optionalDate,
  renewsAt: optionalDate,
  reason: shortText(500),
});

export const tenantStatusSchema = z.object({
  institutionId: uuid,
  status: z.enum([
    "TRIAL",
    "ACTIVE",
    "PAST_DUE",
    "SUSPENDED",
    "CANCELLED",
    "EXPIRED",
  ]),
  reason: shortText(500),
});

export const institutionIdParams = z.object({ institutionId: uuid });
export const studentIdParams = z.object({ studentId: uuid });
