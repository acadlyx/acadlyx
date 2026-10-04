import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution, requireAuthenticatedUser } from "../utils/requireInstitution";
import { getWorkflowState } from "../services/workflowState.service";

const router=Router();
router.get("/:workflow/:id",authenticate,asyncHandler(async(req,res)=>{
 const data=await getWorkflowState(requireInstitution(req),requireAuthenticatedUser(req),req.params.workflow,req.params.id);
 res.json({success:true,data});
}));
export default router;
