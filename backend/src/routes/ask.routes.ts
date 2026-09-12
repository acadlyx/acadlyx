import { Router } from "express";
import { ask } from "../controllers/ask.controller";
import { authenticate } from "../middleware/authenticate";
const router = Router(); router.use(authenticate); router.post("/", ask); export default router;
