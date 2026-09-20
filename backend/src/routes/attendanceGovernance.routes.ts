import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/attendancePolicy.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  attendancePolicySchema,
  correctionListQuery,
  correctionRequestSchema,
  decideCorrectionSchema,
  lockSessionsSchema,
  setLockSchema,
  shortageListQuery,
  shortageScanSchema,
  studentIdParams,
} from "../validators/coreErp.validators";

/**
 * Attendance governance: policy, shortage, corrections and locking.
 * Marking itself remains on /attendance-sessions.
 */
const router = Router();

router.use(authenticate, requireFeature("attendance"));

// ---------- Policy ----------

router.get(
  "/policies",
  authorize("attendance.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.listAttendancePolicies(requireInstitution(req)))
  )
);

router.put(
  "/policies",
  authorize("attendance.policy"),
  validateBody(attendancePolicySchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.upsertAttendancePolicy(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Standing / shortage ----------

router.get(
  "/standing/:studentId",
  authorize("attendance.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) => {
    const institutionId = requireInstitution(req);
    const actor = requireAuthenticatedUser(req);
    // Visibility is enforced by the correction-history read, which uses
    // the shared student-visibility rule.
    await service.getStudentCorrectionHistory(
      institutionId,
      actor,
      req.params.studentId
    );
    sendOk(
      res,
      await service.getStudentAttendancePercentage(
        institutionId,
        req.params.studentId,
        typeof req.query.courseOfferingId === "string"
          ? req.query.courseOfferingId
          : undefined
      )
    );
  })
);

router.post(
  "/shortage/scan",
  authorize("attendance.read", "reports.read"),
  validateBody(shortageScanSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.runShortageScan(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/shortage/alerts",
  authorize("attendance.read"),
  validateQuery(shortageListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listShortageAlerts(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        level: req.query.level as string | undefined,
        studentId: req.query.studentId as string | undefined,
      }
    );
    sendPage(res, items, total, pagination);
  })
);

// ---------- Corrections ----------

router.get(
  "/corrections",
  authorize("attendance.read"),
  validateQuery(correctionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listCorrectionRequests(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        status: req.query.status as string | undefined,
        courseOfferingId: req.query.courseOfferingId as string | undefined,
        mine: req.query.mine === "true",
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/corrections",
  authorize("attendance.correct"),
  validateBody(correctionRequestSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createCorrectionRequest(
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
  "/corrections/:id",
  authorize("attendance.approve"),
  validateParams(idParams),
  validateBody(decideCorrectionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decideCorrectionRequest(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/corrections/history/:studentId",
  authorize("attendance.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getStudentCorrectionHistory(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

// ---------- Locking ----------

router.patch(
  "/sessions/:id/lock",
  authorize("attendance.lock"),
  validateParams(idParams),
  validateBody(setLockSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.setSessionLock(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.locked,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/lock-through",
  authorize("attendance.lock"),
  validateBody(lockSessionsSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.lockSessionsThrough(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body.courseOfferingId,
        req.body.through,
        auditMeta(req)
      )
    )
  )
);

export default router;
