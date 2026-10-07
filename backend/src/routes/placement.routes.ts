import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import * as placement from "../services/placement.service";

const router = Router();
router.use(authenticate);

const idParams = z.object({ id: z.string().uuid() });
const opportunityCreate = z.object({
  title: z.string().trim().min(2).max(200),
  organization: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  deadline: z.string().datetime().nullable().optional(),
  targetRoleId: z.string().uuid().nullable().optional(),
});
const opportunityUpdate = opportunityCreate.partial().extend({ isActive: z.boolean().optional() });
const transitionBody = z.object({ status: z.string().trim().min(3).max(32) });

router.get(
  "/opportunities",
  authorize("placements.read"),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const items = await placement.listOpportunities(requireInstitution(req), actor, {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      activeOnly: req.query.activeOnly !== "false",
    });
    res.json({ success: true, data: items });
  }),
);

router.post(
  "/opportunities",
  authorize("placements.manage"),
  asyncHandler(async (req, res) => {
    const input = opportunityCreate.parse(req.body);
    const item = await placement.createOpportunity(requireInstitution(req), requireAuthenticatedUser(req), input);
    res.status(201).json({ success: true, data: item });
  }),
);

router.patch(
  "/opportunities/:id",
  authorize("placements.manage"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const input = opportunityUpdate.parse(req.body);
    const item = await placement.updateOpportunity(requireInstitution(req), requireAuthenticatedUser(req), id, input);
    res.json({ success: true, data: item });
  }),
);

router.post(
  "/opportunities/:id/apply",
  authorize("placements.apply"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const item = await placement.applyToOpportunity(requireInstitution(req), requireAuthenticatedUser(req), id);
    res.status(201).json({ success: true, data: item });
  }),
);

router.get(
  "/applications",
  authorize("placements.read"),
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const items = await placement.listApplications(requireInstitution(req), actor, {
      opportunityId: typeof req.query.opportunityId === "string" ? req.query.opportunityId : undefined,
      studentId: typeof req.query.studentId === "string" ? req.query.studentId : undefined,
    });
    res.json({ success: true, data: items });
  }),
);

router.post(
  "/applications/:id/status",
  authorize("placements.manage"),
  asyncHandler(async (req, res) => {
    const { id } = idParams.parse(req.params);
    const { status } = transitionBody.parse(req.body);
    const item = await placement.transitionApplication(requireInstitution(req), requireAuthenticatedUser(req), id, status);
    res.json({ success: true, data: item });
  }),
);

router.get(
  "/metrics",
  authorize("placements.read"),
  asyncHandler(async (req, res) => {
    const data = await placement.placementMetrics(requireInstitution(req), requireAuthenticatedUser(req));
    res.json({ success: true, data });
  }),
);

export default router;
