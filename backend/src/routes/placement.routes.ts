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
const companyCreate = z.object({ name: z.string().trim().min(2).max(200), logoUrl: z.string().url().optional(), industry: z.string().max(120).optional(), companyType: z.string().max(120).optional(), website: z.string().url().optional(), description: z.string().max(5000).optional(), headquarters: z.string().max(200).optional() });
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
router.post("/offers/:id/status", authorize("placements.apply"), asyncHandler(async (req,res) => {
  const {id}=idParams.parse(req.params);
  const item=await placement.transitionPlacementOffer(requireInstitution(req),requireAuthenticatedUser(req),id,statusBody.parse(req.body).status);
  res.json({success:true,data:item});
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
