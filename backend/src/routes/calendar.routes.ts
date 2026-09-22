import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/calendar.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  calendarListQuery,
  createEventSchema,
  updateEventSchema,
} from "../validators/calendar.validators";

const router = Router();

router.use(authenticate, requireFeature("calendar"));

const asDate = (value: unknown): Date | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

router.get(
  "/events",
  authorize("calendar.read"),
  validateQuery(calendarListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listEvents(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        from: asDate(req.query.from),
        to: asDate(req.query.to),
        eventType:
          typeof req.query.eventType === "string" ? req.query.eventType : undefined,
        academicYearId:
          typeof req.query.academicYearId === "string"
            ? req.query.academicYearId
            : undefined,
        audience:
          typeof req.query.audience === "string" ? req.query.audience : undefined,
        search: searchTerm(req.query.search),
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.get(
  "/events/upcoming",
  authorize("calendar.read"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getUpcoming(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        Number(req.query.limit) || 10
      )
    )
  )
);

router.post(
  "/events",
  authorize("calendar.manage"),
  validateBody(createEventSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createEvent(
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
  "/events/:id",
  authorize("calendar.manage"),
  validateParams(idParams),
  validateBody(updateEventSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateEvent(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.delete(
  "/events/:id",
  authorize("calendar.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.deleteEvent(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

export default router;
