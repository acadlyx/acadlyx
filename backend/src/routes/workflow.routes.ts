import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution, requireAuthenticatedUser } from "../utils/requireInstitution";
import { getWorkflowState, getWorkflowStates } from "../services/workflowState.service";

const router=Router();

router.post("/batch",authenticate,asyncHandler(async(req,res)=>{
 const institutionId=requireInstitution(req);
 const actor=requireAuthenticatedUser(req);
 const items=Array.isArray(req.body?.items)?req.body.items:[];
 if(items.length===0 || items.length>100) return res.status(400).json({success:false,error:{message:"items must contain between 1 and 100 workflow records."}});
 const normalized=items.map((item:unknown)=>{
  if(!item || typeof item!=="object") throw new Error("Each workflow item must be an object.");
  const value=item as {workflow?:unknown;entityId?:unknown};
  if(typeof value.workflow!=="string" || !value.workflow.trim() || typeof value.entityId!=="string" || !value.entityId.trim()) throw new Error("Each workflow item requires workflow and entityId.");
  return {workflow:value.workflow.trim(),entityId:value.entityId.trim()};
 });
 const data=await getWorkflowStates(institutionId,actor,normalized);
 res.json({success:true,data});
}));
\nrouter.get("/:workflow/:id",authenticate,asyncHandler(async(req,res)=>{
 const data=await getWorkflowState(requireInstitution(req),requireAuthenticatedUser(req),req.params.workflow,req.params.id);
 res.json({success:true,data});
}));
export default router;
