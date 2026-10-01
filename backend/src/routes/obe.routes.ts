import { Router } from "express";
import * as controller from "../controllers/obe.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody } from "../middleware/validate";
import {
  calculateAttainmentSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  createCourseOutcomeSchema,
  createPolicySchema,
  createProgrammeOutcomeSchema,
  createRunSchema,
  replaceMappingSchema,
  replaceScoresSchema,
  programmeAttainmentSchema,
  updateAssessmentItemsSchema,
  updateCourseOutcomeSchema,
  updatePolicySchema,
  updateProgrammeOutcomeSchema,
} from "../validators/obe.validators";

const router = Router();
router.use(authenticate, requireFeature("obe"));

router.get("/course-offerings", authorize("obe.read"), controller.courseOfferings);

router.get("/programs/:programId/outcomes", authorize("obe.read"), controller.programmeOutcomes);
router.post("/programs/:programId/outcomes", authorize("obe.manage"), validateBody(createProgrammeOutcomeSchema), controller.createProgrammeOutcome);
router.patch("/outcomes/:id", authorize("obe.manage"), validateBody(updateProgrammeOutcomeSchema), controller.updateProgrammeOutcome);

router.get("/courses/:courseId/outcomes", authorize("obe.read"), controller.courseOutcomes);
router.post("/courses/:courseId/outcomes", authorize("obe.mapping.manage"), validateBody(createCourseOutcomeSchema), controller.createCourseOutcome);
router.patch("/course-outcomes/:id", authorize("obe.mapping.manage"), validateBody(updateCourseOutcomeSchema), controller.updateCourseOutcome);

router.get("/course-offerings/:courseOfferingId/mapping", authorize("obe.read"), controller.mapping);
router.put("/course-offerings/:courseOfferingId/mapping", authorize("obe.mapping.manage"), validateBody(replaceMappingSchema), controller.replaceMapping);
router.post("/course-offerings/:courseOfferingId/mapping/submit", authorize("obe.mapping.manage"), controller.submitMapping);
router.post("/course-offerings/:courseOfferingId/mapping/approve", authorize("obe.attainment.approve"), controller.approveMapping);
router.post("/course-offerings/:courseOfferingId/mapping/return", authorize("obe.attainment.approve"), controller.returnMapping);

router.get("/course-offerings/:courseOfferingId/assessments", authorize("obe.read"), controller.assessments);
router.post("/assessments", authorize("obe.assessment.manage"), validateBody(createAssessmentSchema), controller.createAssessment);
router.patch("/assessments/:assessmentId", authorize("obe.assessment.manage"), validateBody(updateAssessmentSchema), controller.updateAssessment);
router.put("/assessments/:assessmentId/items", authorize("obe.assessment.manage"), validateBody(updateAssessmentItemsSchema), controller.replaceAssessmentItems);
router.get("/assessment-items/:assessmentItemId/scores", authorize("obe.read"), controller.assessmentItemScores);
router.put("/assessment-items/:assessmentItemId/scores", authorize("obe.assessment.manage"), validateBody(replaceScoresSchema), controller.replaceItemScores);

router.post("/course-offerings/:courseOfferingId/attainment/calculate", authorize("obe.attainment.calculate"), validateBody(calculateAttainmentSchema), controller.calculateAttainment);
router.get("/course-offerings/:courseOfferingId/attainment", authorize("obe.read"), controller.attainment);

router.get("/policies", authorize("obe.read"), controller.policies);
router.post("/policies", authorize("obe.policy.manage"), validateBody(createPolicySchema), controller.createPolicy);
router.patch("/policies/:id", authorize("obe.policy.manage"), validateBody(updatePolicySchema), controller.updatePolicy);
router.post("/programmes/:programId/attainment/calculate", authorize("obe.attainment.calculate"), validateBody(programmeAttainmentSchema), controller.calculateProgrammeAttainment);
router.post("/runs", authorize("obe.attainment.calculate"), validateBody(createRunSchema), controller.createRun);

export default router;
