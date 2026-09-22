import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateParams } from "../middleware/validate";
import * as service from "../services/parentPortal.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, sendOk } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import { studentIdParams } from "../validators/coreErp.validators";

/**
 * Parent portal.
 *
 * Every route below is scoped to a `:studentId` the service re-verifies
 * against the parent-student link table on each call. There is no
 * endpoint here that can return data for an unlinked student.
 */
const router = Router();

router.use(authenticate, requireFeature("parent_portal"), authorize("parent-portal.read"));

router.get(
  "/children",
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listMyChildren(
        requireInstitution(req),
        requireAuthenticatedUser(req)
      )
    )
  )
);

router.get(
  "/children/:studentId",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildOverview(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/attendance",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildAttendance(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/results",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildResults(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/fees",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildFees(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/coursework",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildCoursework(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/calendar",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildCalendar(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

router.get(
  "/children/:studentId/notices",
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getChildNotices(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId,
        parsePagination(req)
      )
    )
  )
);

router.post(
  "/alerts/:id/acknowledge",
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.acknowledgeAlert(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

export default router;
