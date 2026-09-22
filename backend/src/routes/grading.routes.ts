import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateParams } from "../middleware/validate";
import * as service from "../services/grading.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendOk } from "../utils/http";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";

const router = Router();

router.use(authenticate, requireFeature("results"));

router.get(
  "/scale",
  authorize("results.read"),
  asyncHandler(async (_req, res) => sendOk(res, service.getGradeScale()))
);

router.get(
  "/me",
  authorize("results.read"),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    sendOk(
      res,
      await service.getTranscript(requireInstitution(req), actor, actor.id)
    );
  })
);

router.get(
  "/students/:id",
  authorize("results.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getTranscript(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.get(
  "/course-offerings/:id",
  authorize("results.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getCourseGradeSheet(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

export default router;
