import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/examination.service";
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

// ---------- Sessions ----------

router.get(
  "/sessions",
  authorize("exams.read"),
  validateQuery(examSessionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listExamSessions(
      requireInstitution(req),
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
  authorize("exams.manage"),
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
      await service.getExamSession(requireInstitution(req), req.params.id)
    )
  )
);

router.patch(
  "/sessions/:id",
  authorize("exams.manage"),
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
  authorize("exams.approve"),
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
  authorize("exams.manage"),
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
  authorize("exams.manage"),
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
  authorize("exams.manage"),
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
  authorize("exams.manage"),
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
  authorize("exams.manage"),
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
  authorize("exams.manage"),
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
  authorize("exams.invigilate"),
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
  authorize("marks.enter"),
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
  authorize("exams.approve"),
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
  authorize("exams.approve"),
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
  authorize("exams.approve"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.publishExamResults(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
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

// ---------- Hall tickets ----------

router.post(
  "/sessions/:id/hall-tickets",
  authorize("exams.manage"),
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

router.patch(
  "/hall-tickets/:id",
  authorize("exams.manage"),
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
  authorize("exams.invigilate"),
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
  authorize("exams.approve"),
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
  authorize("exams.invigilate"),
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
  authorize("exams.approve"),
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

// ---------- Student view ----------

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
