import { Router } from "express";
import { z } from "zod";

import { authenticate } from "../middleware/authenticate";
import { validateQuery } from "../middleware/validate";
import * as service from "../services/directory.service";
import * as libraryDirectory from "../services/libraryDirectory.service";
import { asyncHandler } from "../utils/asyncHandler";
import { sendOk } from "../utils/http";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";

const router = Router();

const lookupQuery = z.object({
  search: z.string().trim().min(2).max(100),
  roles: z.string().trim().max(200).optional(),
});

const libraryStudentQuery = z.object({
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  program: z.string().trim().max(100).optional(),
  session: z.string().trim().max(50).optional(),
  semester: z.string().trim().max(30).optional(),
  section: z.string().trim().max(50).optional(),
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
  "/library-students",
  validateQuery(libraryStudentQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await libraryDirectory.searchLibraryStudents(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        {
          search: typeof req.query.search === "string" ? req.query.search : undefined,
          department: typeof req.query.department === "string" ? req.query.department : undefined,
          program: typeof req.query.program === "string" ? req.query.program : undefined,
          session: typeof req.query.session === "string" ? req.query.session : undefined,
          semester: typeof req.query.semester === "string" ? req.query.semester : undefined,
          section: typeof req.query.section === "string" ? req.query.section : undefined,
        }
      )
    )
  })
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
  })
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
  })
);

export default router;
