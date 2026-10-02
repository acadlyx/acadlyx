import { Router } from "express";
import * as controller from "../controllers/intelligence.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateQuery } from "../middleware/validate";
import { z } from "zod";
const router = Router();
router.use(authenticate);

const commandCenterQuerySchema = z.object({
  departmentId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  semesterId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
router.get("/students/:id", controller.student);
router.get("/students/:id/risk", controller.studentRisk);
router.get("/students/:id/recommendations", controller.recommendations);
router.get("/students/:id/career", controller.careerProfile);
router.get("/command-center", authorize("intelligence.read"), validateQuery(commandCenterQuerySchema), controller.commandCenter);
export default router;
