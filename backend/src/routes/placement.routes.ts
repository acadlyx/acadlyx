import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import * as placement from "../services/placement.service";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

const router = Router();
router.use(authenticate);
router.use(asyncHandler(async (req, _res, next) => {
  if (req.user?.roles.includes("SUPER_ADMIN")) {
    next();
    return;
  }
  const institutionId = req.user?.institutionId;
  if (!institutionId) {
    next(new AppError("Institution context is required for placement.", 403));
    return;
  }
  const entitlement = await prisma.tenantFeatureEntitlement.findFirst({
    where: { institutionId, featureKey: "placements" },
    select: { isEnabled: true },
  });
  if (entitlement && !entitlement.isEnabled) {
    next(new AppError("Placement is not enabled for this institution.", 403));
    return;
  }
  next();
}));

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
const companyCreate = z.object({ name: z.string().trim().min(2).max(200), logoUrl: z.string().url().optional(), industry: z.string().max(120).optional(), companyType: z.string().max(120).optional(), website: z.string().url().optional(), description: z.string().max(5000).optional(), headquarters: z.string().max(200).optional() });
const joiningVerification = z.object({ actualJoiningDate:z.string().datetime().optional(), status:z.enum(["VERIFIED","REJECTED"]), proofUrl:z.string().url().optional(), notes:z.string().max(3000).optional() });
const offerCreate = z.object({ applicationId:z.string().uuid(), role:z.string().trim().min(2).max(200), offerDate:z.string().datetime(), joiningDate:z.string().datetime().optional(), totalCtc:z.number().nonnegative().optional(), fixedCtc:z.number().nonnegative().optional(), variableCtc:z.number().nonnegative().optional(), bonus:z.number().nonnegative().optional(), currency:z.string().length(3).optional(), offerDocumentUrl:z.string().url().optional() });
const openingCreate = z.object({ companyId:z.string().uuid(), role:z.string().trim().min(2).max(200), description:z.string().max(5000).optional(), employmentType:z.string().max(80).optional(), location:z.string().max(200).optional(), totalCtc:z.number().nonnegative().optional(), fixedCtc:z.number().nonnegative().optional(), variableCtc:z.number().nonnegative().optional(), bonus:z.number().nonnegative().optional(), stipend:z.number().nonnegative().optional(), currency:z.string().length(3).optional(), packagePeriod:z.string().max(40).optional(), requiredSkills:z.array(z.string().uuid()).optional(), eligibility:z.record(z.string(),z.unknown()).optional(), hiringBatchIds:z.array(z.string().uuid()).optional(), deadline:z.string().datetime().optional(), applicationProcess:z.string().max(5000).optional() });
const driveCreate = z.object({
  companyId: z.string().uuid(), title: z.string().trim().min(2).max(200), openingId: z.string().uuid().optional(), campusId: z.string().uuid().optional(),
  applicationDeadline: z.string().datetime().optional(), driveDate: z.string().datetime().optional(), venue: z.string().max(300).optional(), onlineLink: z.string().url().optional(),
  cgpaRequirement: z.number().min(0).max(10).optional(), maxBacklogs: z.number().int().min(0).max(100).optional(), vacancies: z.number().int().min(1).max(100000).optional(),
  eligiblePrograms: z.array(z.string().uuid()).optional(), eligibleDepartments: z.array(z.string().uuid()).optional(), eligibleBatches: z.array(z.string().uuid()).optional(),
  eligibleSemesters: z.array(z.string().uuid()).optional(), requiredSkills: z.array(z.string().uuid()).optional(),
});
const statusBody = z.object({ status: z.string().trim().min(3).max(32) });
const contactCreate = z.object({ name: z.string().trim().min(2).max(160), designation: z.string().max(160).optional(), email: z.string().email().optional(), phone: z.string().max(40).optional(), isPrimary: z.boolean().optional(), notes: z.string().max(2000).optional() });
const profileUpdate = z.object({ portfolioUrl: z.string().url().nullable().optional(), githubUrl: z.string().url().nullable().optional(), linkedInUrl: z.string().url().nullable().optional(), bio: z.string().max(2000).nullable().optional() });
const interviewCreate = z.object({
  driveId: z.string().uuid(),
  roundNumber: z.number().int().min(1).max(50),
  roundType: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  venue: z.string().max(300).optional(),
  onlineLink: z.string().url().optional(),
  interviewer: z.string().max(200).optional(),
});
const interviewParticipant = z.object({ studentId: z.string().uuid() });
const interviewParticipantUpdate = z.object({
  attendanceStatus: z.string().trim().min(2).max(40).optional(),
  resultStatus: z.string().trim().min(2).max(40).optional(),
  feedback: z.string().max(5000).nullable().optional(),
});
const visitCreate = z.object({
  companyId: z.string().uuid(),
  driveId: z.string().uuid().optional(),
  type: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  venue: z.string().max(300).optional(),
  purpose: z.string().max(1000).optional(),
  representatives: z.unknown().optional(),
  participatingStudentIds: z.array(z.string().uuid()).max(10000).optional(),
  notes: z.string().max(5000).optional(),
  followUp: z.string().max(5000).optional(),
});



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


router.get("/openings", authorize("placements.read"), asyncHandler(async (req,res) => {
  const data=await placement.listPlacementOpenings(requireInstitution(req),requireAuthenticatedUser(req));
  res.json({success:true,data});
}));
router.post("/openings", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementOpening(requireInstitution(req),requireAuthenticatedUser(req),openingCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.get("/companies", authorize("placements.read"), asyncHandler(async (req,res) => {
  const actor=requireAuthenticatedUser(req);
  const data=await placement.listPlacementCompanies(requireInstitution(req),actor,typeof req.query.search==="string"?req.query.search:undefined);
  res.json({success:true,data});
}));
router.post("/companies", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementCompany(requireInstitution(req),requireAuthenticatedUser(req),companyCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.post("/companies/:id/contacts", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.createPlacementCompanyContact(requireInstitution(req),requireAuthenticatedUser(req),id,contactCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.get("/drives", authorize("placements.read"), asyncHandler(async (req,res) => {
  const actor=requireAuthenticatedUser(req);
  const data=await placement.listPlacementDrives(requireInstitution(req),actor,{status:typeof req.query.status==="string"?req.query.status:undefined,search:typeof req.query.search==="string"?req.query.search:undefined});
  res.json({success:true,data});
}));
router.post("/drives", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementDrive(requireInstitution(req),requireAuthenticatedUser(req),driveCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.post("/drives/:id/status", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.transitionPlacementDrive(requireInstitution(req),requireAuthenticatedUser(req),id,statusBody.parse(req.body).status);
  res.json({success:true,data:item});
}));
router.get("/drives/:id/eligibility", authorize("placements.read"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const data=await placement.checkDriveEligibility(requireInstitution(req),requireAuthenticatedUser(req),id,typeof req.query.studentId==="string"?req.query.studentId:undefined);
  res.json({success:true,data});
}));
router.post("/drives/:id/apply", authorize("placements.apply"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.applyToDrive(requireInstitution(req),requireAuthenticatedUser(req),id);
  res.status(201).json({success:true,data:item});
}));
router.post("/offers", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementOffer(requireInstitution(req),requireAuthenticatedUser(req),offerCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.post("/offers/:id/joining-verification", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.verifyPlacementJoining(requireInstitution(req),requireAuthenticatedUser(req),id,joiningVerification.parse(req.body));
  res.json({success:true,data:item});
}));
router.post("/offers/:id/status", authorize("placements.apply"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.transitionPlacementOffer(requireInstitution(req),requireAuthenticatedUser(req),id,statusBody.parse(req.body).status);
  res.json({success:true,data:item});
}));

router.get("/interviews", authorize("placements.read"), asyncHandler(async (req,res) => {
  const data=await placement.listPlacementInterviews(requireInstitution(req),requireAuthenticatedUser(req),{
    studentId:typeof req.query.studentId==="string"?req.query.studentId:undefined,
    driveId:typeof req.query.driveId==="string"?req.query.driveId:undefined,
  });
  res.json({success:true,data});
}));
router.post("/interviews", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementInterview(requireInstitution(req),requireAuthenticatedUser(req),interviewCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));
router.post("/interviews/:id/participants", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.addPlacementInterviewParticipant(requireInstitution(req),requireAuthenticatedUser(req),id,interviewParticipant.parse(req.body).studentId);
  res.status(201).json({success:true,data:item});
}));
router.patch("/interviews/:id/participants/:studentId", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const {id,studentId}=z.object({id:z.string().uuid(),studentId:z.string().uuid()}).parse(req.params);
  const item=await placement.updatePlacementInterviewParticipant(requireInstitution(req),requireAuthenticatedUser(req),id,studentId,interviewParticipantUpdate.parse(req.body));
  res.json({success:true,data:item});
}));
router.get("/visits", authorize("placements.read"), asyncHandler(async (req,res) => {
  const data=await placement.listPlacementVisits(requireInstitution(req),requireAuthenticatedUser(req));
  res.json({success:true,data});
}));
router.post("/visits", authorize("placements.manage"), asyncHandler(async (req,res) => {
  const item=await placement.createPlacementVisit(requireInstitution(req),requireAuthenticatedUser(req),visitCreate.parse(req.body));
  res.status(201).json({success:true,data:item});
}));

router.patch("/profile", authorize("placements.apply"), asyncHandler(async (req,res) => {
  const item=await placement.updatePlacementProfile(requireInstitution(req),requireAuthenticatedUser(req),profileUpdate.parse(req.body));
  res.json({success:true,data:item});
}));
router.get("/profile", authorize("placements.read"), asyncHandler(async (req,res) => {
  const data=await placement.placementProfile(requireInstitution(req),requireAuthenticatedUser(req),typeof req.query.studentId==="string"?req.query.studentId:undefined);
  res.json({success:true,data});
}));
export default router;
