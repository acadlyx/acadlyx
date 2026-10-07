import { Router } from "express";
import { AppError } from "../middleware/errorHandler";

import { authenticate } from "../middleware/authenticate";
import { authorize, authorizeWorkflow } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/examination.service";
import * as templateService from "../services/admitCardTemplate.service";
import * as admitCardGenerationService from "../services/admitCardGeneration.service";
import { getFileDelivery } from "../services/fileStorage.service";
import { getOwnedJob, requestCancellation } from "../services/backgroundJob.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  allocateSeatingSchema,
  admitCardHoldSchema,
  admitCardHoldResolveSchema,
  examMarkCorrectionSchema,
  examRegistrationParams,
  studentExamListQuery,
  assignInvigilatorsSchema,
  createExamRoomSchema,
  createExamScheduleSchema,
  createExamSessionSchema,
  decideIncidentSchema,
  decideRevaluationSchema,
  examAttendanceSchema,
  examSessionListQuery,
  examSessionStatusSchema,
  hallTicketStatusSchema,
  incidentListQuery,
  reportIncidentSchema,
  requestRevaluationSchema,
  revaluationListQuery,
  saveExamMarksSchema,
  studentIdParams,
  updateExamRoomSchema,
  updateExamScheduleSchema,
  updateExamSessionSchema,
} from "../validators/coreErp.validators";

/**
 * Examinations.
 *
 * Read endpoints require `exams.read`; scheduling requires
 * `exams.manage`; approval, locking and publication require
 * `exams.approve`. Permission is only the first gate — every handler
 * hands the authenticated actor to the service, which re-checks tenant,
 * offering ownership and workflow state.
 */
const router = Router();

router.use(authenticate, requireFeature("exams"));

// ---------- Admit-card templates ----------
router.get(
  "/admit-card-templates",
  authorize("exams.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await templateService.listAdmitCardTemplates(requireInstitution(req)))
  )
);

router.post(
  "/admit-card-templates",
  authorizeWorkflow("exams.manage"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await templateService.createAdmitCardTemplate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
      ),
      201,
    )
  )
);

router.get(
  "/admit-card-templates/:id",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await templateService.getAdmitCardTemplate(requireInstitution(req), req.params.id))
  )
);

router.patch(
  "/admit-card-templates/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await templateService.updateAdmitCardTemplate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
      ),
    )
  )
);

router.delete(
  "/admit-card-templates/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await templateService.deleteAdmitCardTemplate(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
      ),
    )
  )
);

// ---------- Sessions ----------

router.get(
  "/sessions",
  authorize("exams.read"),
  validateQuery(examSessionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listExamSessions(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        status: req.query.status as string | undefined,
        examType: req.query.examType as string | undefined,
        search: searchTerm(req.query.search),
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/sessions",
  authorizeWorkflow("exams.manage"),
  validateBody(createExamSessionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createExamSession(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/sessions/:id",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getExamSession(requireInstitution(req), requireAuthenticatedUser(req), req.params.id)
    )
  )
);

router.patch(
  "/sessions/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(updateExamSessionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateExamSession(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.patch(
  "/sessions/:id/status",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  validateBody(examSessionStatusSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateExamSessionStatus(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.status,
        auditMeta(req)
      )
    )
  )
);

// ---------- Rooms ----------

router.get(
  "/rooms",
  authorize("exams.read"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listExamRooms(requireInstitution(req), {
        includeInactive: req.query.includeInactive === "true",
        search: searchTerm(req.query.search),
      })
    )
  )
);

router.post(
  "/rooms",
  authorizeWorkflow("exams.manage"),
  validateBody(createExamRoomSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createExamRoom(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/rooms/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(updateExamRoomSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateExamRoom(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Schedules ----------

router.post(
  "/schedules",
  authorizeWorkflow("exams.manage"),
  validateBody(createExamScheduleSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createExamSchedule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/schedules/:id",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getExamScheduleDetail(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.patch(
  "/schedules/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(updateExamScheduleSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateExamSchedule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/seating",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(allocateSeatingSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.allocateSeating(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.roomIds,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/invigilators",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(assignInvigilatorsSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.assignInvigilators(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.assignments,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/attendance",
  authorizeWorkflow("exams.invigilate"),
  validateParams(idParams),
  validateBody(examAttendanceSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.recordExamAttendance(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.entries,
        auditMeta(req)
      )
    )
  )
);

// ---------- Marks ----------

router.get(
  "/schedules/:id/marks",
  authorize("marks.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getMarksSheet(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.put(
  "/schedules/:id/marks",
  authorizeWorkflow("marks.enter"),
  validateParams(idParams),
  validateBody(saveExamMarksSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.saveExamMarks(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.entries,
        req.body.submit,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/marks/approve",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.approveExamMarks(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/lock",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.lockExamSchedule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/schedules/:id/publish",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.enqueuePublishExamResults(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.get(
  "/marks/:id/history",
  authorize("marks.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getExamMarkHistory(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

// ---------- Background jobs ----------
router.get(
  "/jobs/:id",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const job = await getOwnedJob(requireInstitution(req), requireAuthenticatedUser(req), req.params.id);
    if (![ "ADMIT_CARD_GENERATION", "RESULT_PROCESSING" ].includes(job.type)) {
      throw new AppError("Examination job not found.", 404);
    }
    sendOk(res, job);
  })
);

router.post(
  "/jobs/:id/cancel",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const institutionId = requireInstitution(req);
    const job = await getOwnedJob(institutionId, actor, req.params.id);
    if (![ "ADMIT_CARD_GENERATION", "RESULT_PROCESSING" ].includes(job.type)) {
      throw new AppError("Examination job not found.", 404);
    }
    sendOk(res, await requestCancellation(institutionId, actor, req.params.id));
  })
);

// ---------- Hall tickets ----------

router.post(
  "/sessions/:id/hall-tickets",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.generateHallTickets(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/sessions/:id/hall-tickets/bulk.zip",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await admitCardGenerationService.enqueueBulkAdmitCardsZip(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      req.params.id,
    ), 202)
  )
);

router.get(
  "/admit-card-generation-jobs/:id",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await admitCardGenerationService.getAdmitCardGenerationJob(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      req.params.id,
    ))
  )
);

router.post(
  "/admit-card-generation-jobs/:id/cancel",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await admitCardGenerationService.cancelAdmitCardGenerationJob(
      requireInstitution(req), requireAuthenticatedUser(req), req.params.id
    ))
  )
);

router.get(
  "/admit-card-generation-jobs/:id/download",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const job = await admitCardGenerationService.getAdmitCardGenerationJob(
      requireInstitution(req), requireAuthenticatedUser(req), req.params.id
    );
    const fileId = job.result && typeof job.result === "object" && job.result !== null
      ? (job.result as { fileId?: unknown }).fileId
      : undefined;
    if (job.status !== "COMPLETED" || typeof fileId !== "string") {
      return res.status(409).json({ success: false, error: { code: "JOB_NOT_COMPLETE", message: "The admit-card package is not ready yet." }});
    }
    const delivery = await getFileDelivery(fileId, requireInstitution(req), true);
    res.setHeader("Cache-Control", "private, no-store");
    return res.redirect(delivery.url);
  })
);

router.patch(
  "/hall-tickets/:id",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(hallTicketStatusSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateHallTicketStatus(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.status,
        req.body.reason,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/sessions/:id/hall-ticket.pdf",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const studentId =
      typeof req.query.studentId === "string" ? req.query.studentId : actor.id;
    const file = await service.generateStudentHallTicketPdf(
      requireInstitution(req),
      actor,
      req.params.id,
      studentId
    );
    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.setHeader("Content-Length", String(file.buffer.length));
    res.setHeader("Cache-Control", "private, no-store");
    res.send(file.buffer);
  })
);

router.get(
  "/sessions/:id/hall-ticket",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const studentId =
      typeof req.query.studentId === "string" ? req.query.studentId : actor.id;
    sendOk(
      res,
      await service.getStudentHallTicket(
        requireInstitution(req),
        actor,
        req.params.id,
        studentId
      )
    );
  })
);

// ---------- Invigilation duties ----------

router.get(
  "/my/invigilation",
  authorizeWorkflow("exams.invigilate"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listMyInvigilationDuties(
        requireInstitution(req),
        requireAuthenticatedUser(req)
      )
    )
  )
);

// ---------- Revaluation ----------

router.get(
  "/revaluations",
  authorize("exams.revaluate"),
  validateQuery(revaluationListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listRevaluationRequests(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        status: req.query.status as string | undefined,
        examScheduleId: req.query.examScheduleId as string | undefined,
        mine: req.query.mine === "true",
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/revaluations",
  authorize("exams.revaluate"),
  validateBody(requestRevaluationSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.requestRevaluation(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/revaluations/:id",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  validateBody(decideRevaluationSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decideRevaluation(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Incidents / malpractice ----------

router.get(
  "/incidents",
  authorize("exams.read"),
  validateQuery(incidentListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listExamIncidents(
      requireInstitution(req),
      pagination,
      {
        status: req.query.status as string | undefined,
        examScheduleId: req.query.examScheduleId as string | undefined,
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/incidents",
  authorizeWorkflow("exams.invigilate"),
  validateBody(reportIncidentSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.reportExamIncident(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/incidents/:id",
  authorizeWorkflow("exams.approve"),
  validateParams(idParams),
  validateBody(decideIncidentSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decideExamIncident(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);


/* ---------- Student examination lifecycle ---------- */

router.get(
  "/students/:studentId/eligibility",
  authorize("exams.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) => sendOk(res, await service.listStudentExamEligibility(
    requireInstitution(req), requireAuthenticatedUser(req), req.params.studentId
  )))
);

router.get(
  "/students/:studentId/performance",
  authorize("exams.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) => sendOk(res, await service.getStudentExamPerformance(
    requireInstitution(req), requireAuthenticatedUser(req), req.params.studentId
  )))
);

router.get(
  "/sessions/:id/marksheet.pdf",
  authorize("results.read"),
  validateParams(idParams),
  asyncHandler(async (req,res)=>{
    const actor=requireAuthenticatedUser(req);
    const studentId=typeof req.query.studentId==="string" ? req.query.studentId : actor.id;
    const file=await service.generateStudentMarksheetPdf(requireInstitution(req),actor,req.params.id,studentId);
    res.status(200);
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",'attachment; filename="'+file.filename+'"');
    res.setHeader("Content-Length",String(file.buffer.length));
    res.setHeader("Cache-Control","private, no-store");
    return res.send(file.buffer);
  })
);

router.get(
  "/students/:studentId/results",
  authorize("results.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) => sendOk(res, await service.getStudentPublishedResults(
    requireInstitution(req), requireAuthenticatedUser(req), req.params.studentId
  )))
);

router.post(
  "/sessions/:id/registration",
  authorize("exams.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    sendOk(res, await service.registerStudentForExam(
      requireInstitution(req), actor, req.params.id, actor.id, auditMeta(req)
    ), 201);
  })
);

router.post(
  "/sessions/:id/admit-card-holds",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(admitCardHoldSchema),
  asyncHandler(async (req, res) => sendOk(res, await service.createAdmitCardHold(
    requireInstitution(req), requireAuthenticatedUser(req), req.params.id, req.body, auditMeta(req)
  ), 201))
);

router.patch(
  "/admit-card-holds/:id/resolve",
  authorizeWorkflow("exams.manage"),
  validateParams(idParams),
  validateBody(admitCardHoldResolveSchema),
  asyncHandler(async (req, res) => sendOk(res, await service.resolveAdmitCardHold(
    requireInstitution(req), requireAuthenticatedUser(req), req.params.id, req.body.resolution, auditMeta(req)
  )))
);

router.post(
  "/mark-correction-requests",
  authorize("marks.enter"),
  validateBody(examMarkCorrectionSchema),
  asyncHandler(async (req, res) => sendOk(res, await service.requestExamMarkCorrection(
    requireInstitution(req), requireAuthenticatedUser(req), req.body, auditMeta(req)
  ), 201))
);

router.get(
  "/mark-correction-requests",
  authorize("exams.approve"),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const result = await service.listExamMarkCorrectionRequests(
      requireInstitution(req), requireAuthenticatedUser(req), pagination
    );
    sendPage(res, result.items, result.total, pagination);
  })
);

// ---------- Student view ----------

router.get(
  "/students/:studentId/hall-tickets",
  authorize("exams.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listStudentHallTickets(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/students/:studentId",
  authorize("exams.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getStudentExaminations(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

export default router;
