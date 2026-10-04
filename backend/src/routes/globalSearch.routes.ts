import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { requireInstitution } from "../utils/requireInstitution";
import { asyncHandler } from "../utils/asyncHandler";
import { sendOk } from "../utils/http";
import { globalSearch } from "../services/globalSearch.service";
import { requireAuthenticatedUser } from "../utils/requireInstitution";

const router=Router();
router.get("/",authenticate,asyncHandler(async(req,res)=>{
 const q=typeof req.query.q==="string"?req.query.q:"";
 sendOk(res,await globalSearch(requireInstitution(req),requireAuthenticatedUser(req),q));
}));
export default router;
