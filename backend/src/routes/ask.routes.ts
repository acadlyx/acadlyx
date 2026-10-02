import { Router } from "express";
import { ask } from "../controllers/ask.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
const router = Router();
router.use(authenticate);
router.post("/", authorize("intelligence.read"), ask);
export default router;
