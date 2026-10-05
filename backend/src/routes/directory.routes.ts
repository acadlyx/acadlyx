import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../middleware/authenticate";
import { validateQuery } from "../middleware/validate";
import * as service from "../services/directory.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendOk } from "../utils/http";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";

/**
 * Typeahead lookups that back the searchable selectors in the UI.
 * Scope is enforced in the service, identically to the endpoints these
 * ids are eventually used against.
 */
const router = Router();

const lookupQuery = z.object({
  search: z.string().trim().min(2).max(100),
  roles: z.string().trim().max(200).optional(),
});

router.use(authenticate);

router.get(
  "/students",
  validateQuery(lookupQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.searchStudents(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.search as string
      )
    )
  )
);

router.get(
  "/users",
  validateQuery(lookupQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.searchUsers(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.search as string,
        typeof req.query.roles === "string"
          ? req.query.roles.split(",").map((role) => role.trim()).filter(Boolean)
          : undefined
      )
    )
  )
);

router.get(
  "/course-offerings",
  validateQuery(lookupQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.searchCourseOfferings(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.search as string
      )
    )
  )
);

export default router;
