import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { asyncHandler } from "../utils/asyncHandler";
import { parsePagination, buildPaginationMeta } from "../utils/pagination";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { sendOk } from "../utils/http";
import * as service from "../services/lmsProduction.service";

const router = Router();
router.use(authenticate, requireFeature("lms"));

router.get("/filter-options", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.filterOptions(requireInstitution(req),requireAuthenticatedUser(req)))));

router.get("/catalog", authorize("lms.read"), asyncHandler(async (req,res)=>{
  const p=parsePagination(req);
  const result=await service.listCatalog(requireInstitution(req),requireAuthenticatedUser(req),p,{
    departmentId: typeof req.query.departmentId==="string"?req.query.departmentId:undefined,
    programId: typeof req.query.programId==="string"?req.query.programId:undefined,
    academicYearId: typeof req.query.academicYearId==="string"?req.query.academicYearId:undefined,
    semesterId: typeof req.query.semesterId==="string"?req.query.semesterId:undefined,
    sectionId: typeof req.query.sectionId==="string"?req.query.sectionId:undefined,
    search: typeof req.query.search==="string"?req.query.search.trim():undefined
  });
  res.json({success:true,data:result.items,meta:buildPaginationMeta(result.total,p)});
}));

router.get("/offerings/:id/workspace", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.getWorkspace(requireInstitution(req),requireAuthenticatedUser(req),req.params.id))));
router.post("/offerings/:id/workflow", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.transitionCourse(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,String(req.body?.action||""),typeof req.body?.reason==="string"?req.body.reason:undefined))));

router.get("/offerings/:id/analytics", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.getAnalytics(requireInstitution(req),requireAuthenticatedUser(req),req.params.id))));
router.get("/reports", authorize("lms.manage"), asyncHandler(async(req,res)=>{
  const p=parsePagination(req);
  const result=await service.listReport(requireInstitution(req),requireAuthenticatedUser(req),p,{departmentId:req.query.departmentId,programId:req.query.programId,academicYearId:req.query.academicYearId,semesterId:req.query.semesterId,sectionId:req.query.sectionId,search:req.query.search});
  res.json({success:true,data:result.items,meta:buildPaginationMeta(result.total,p)});
}));
router.get("/offerings/:id/gradebook", authorize("lms.grade"), asyncHandler(async(req,res)=>{
  const p=parsePagination(req); const result=await service.getGradebook(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,p);
  res.json({success:true,data:result.items,meta:buildPaginationMeta(result.total,p)});
}));

router.get("/offerings/:id/discussions", authorize("lms.read"), asyncHandler(async(req,res)=>{
  const p=parsePagination(req); const result=await service.listDiscussions(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,p);
  res.json({success:true,data:result.items,meta:buildPaginationMeta(result.total,p)});
}));
router.post("/offerings/:id/discussions", authorize("lms.attempt"), asyncHandler(async(req,res)=>sendOk(res,await service.postDiscussion(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,String(req.body?.body||""),typeof req.body?.parentId==="string"?req.body.parentId:undefined),201)));
router.patch("/discussions/:id", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.manageDiscussion(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,req.body||{}))));

router.post("/live-classes", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.scheduleLive(requireInstitution(req),requireAuthenticatedUser(req),req.body),201)));
router.patch("/live-classes/:id", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.updateLive(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,req.body||{}))));

router.post("/announcements", authorize("notices.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.announce(requireInstitution(req),requireAuthenticatedUser(req),req.body),201)));

router.get("/settings", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.getSettings(requireInstitution(req),requireAuthenticatedUser(req)))));
router.patch("/settings", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.updateSettings(requireInstitution(req),requireAuthenticatedUser(req),req.body||{}))));

router.post("/resources/:id/file", authorize("lms.manage"), asyncHandler(async(req,res)=>sendOk(res,await service.uploadLink(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,String(req.body?.fileAssetId||"")))));
router.post("/submissions/:id/files", authorize("lms.attempt"), asyncHandler(async(req,res)=>sendOk(res,await service.linkSubmissionFile(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,String(req.body?.fileAssetId||"")))));
router.get("/submissions/:id/files", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.getSubmissionFiles(requireInstitution(req),requireAuthenticatedUser(req),req.params.id))));

router.get("/parent/students", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.linkedStudents(requireInstitution(req),requireAuthenticatedUser(req)))));
router.get("/parent/students/:studentId", authorize("lms.read"), asyncHandler(async(req,res)=>sendOk(res,await service.getParentStudentOverview(requireInstitution(req),requireAuthenticatedUser(req),req.params.studentId))));

router.get("/students/:studentId/offerings/:offeringId/certificate-eligibility", authorize("certificates.read"), asyncHandler(async(req,res)=>sendOk(res,await service.certificateEligibility(requireInstitution(req),requireAuthenticatedUser(req),req.params.studentId,req.params.offeringId))));

export default router;
