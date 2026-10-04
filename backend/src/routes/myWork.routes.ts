import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { getMyWork } from "../services/myWork.service";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);
    const data = await getMyWork(requireInstitution(req), actor);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ success: true, data });
  }),
);

export default router;
