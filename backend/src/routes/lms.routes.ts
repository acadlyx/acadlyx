import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/lms.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  courseOfferingQuery,
  createLessonSchema,
  createModuleSchema,
  createQuestionSchema,
  createQuizSchema,
  gradeAttemptSchema,
  lessonProgressSchema,
  lessonResourceSchema,
  questionListQuery,
  quizQuestionsSchema,
  quizStatusSchema,
  studentIdParams,
  submitAttemptSchema,
  updateLessonSchema,
  updateModuleSchema,
} from "../validators/coreErp.validators";

/**
 * Learning management.
 *
 * `lms.read` covers browsing, `lms.manage` authoring, `lms.attempt`
 * taking a quiz and `lms.grade` marking one. Offering-level ownership
 * and student enrolment are re-checked inside every service call.
 */
const router = Router();

router.use(authenticate, requireFeature("lms"));

// ---------- Modules ----------

router.get(
  "/modules",
  authorize("lms.read"),
  validateQuery(courseOfferingQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listModules(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.courseOfferingId as string
      )
    )
  )
);

router.post(
  "/modules",
  authorize("lms.manage"),
  validateBody(createModuleSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createModule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/modules/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  validateBody(updateModuleSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateModule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.delete(
  "/modules/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.deleteModule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

// ---------- Lessons ----------

router.post(
  "/lessons",
  authorize("lms.manage"),
  validateBody(createLessonSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createLesson(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/lessons/:id",
  authorize("lms.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getLesson(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.patch(
  "/lessons/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  validateBody(updateLessonSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateLesson(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/lessons/:id/resources",
  authorize("lms.manage"),
  validateParams(idParams),
  validateBody(lessonResourceSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.addLessonResource(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.delete(
  "/resources/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.deleteLessonResource(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/lessons/:id/progress",
  authorize("lms.attempt"),
  validateParams(idParams),
  validateBody(lessonProgressSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.recordLessonProgress(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body
      )
    )
  )
);

// ---------- Question bank ----------

router.get(
  "/questions",
  authorize("lms.manage"),
  validateQuery(questionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listQuestions(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        courseId: req.query.courseId as string | undefined,
        courseOfferingId: req.query.courseOfferingId as string | undefined,
        questionType: req.query.questionType as string | undefined,
        search: searchTerm(req.query.search),
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/questions",
  authorize("lms.manage"),
  validateBody(createQuestionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createQuestion(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/questions/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getQuestion(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.delete(
  "/questions/:id",
  authorize("lms.manage"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.deactivateQuestion(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

// ---------- Quizzes ----------

router.get(
  "/quizzes",
  authorize("lms.read"),
  validateQuery(courseOfferingQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listQuizzes(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.courseOfferingId as string
      )
    )
  )
);

router.post(
  "/quizzes",
  authorize("lms.manage"),
  validateBody(createQuizSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createQuiz(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.put(
  "/quizzes/:id/questions",
  authorize("lms.manage"),
  validateParams(idParams),
  validateBody(quizQuestionsSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.setQuizQuestions(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.questions,
        auditMeta(req)
      )
    )
  )
);

router.patch(
  "/quizzes/:id/status",
  authorize("lms.manage"),
  validateParams(idParams),
  validateBody(quizStatusSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateQuizStatus(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.status,
        auditMeta(req)
      )
    )
  )
);

// ---------- Attempts ----------

router.post(
  "/quizzes/:id/attempts",
  authorize("lms.attempt"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.startQuizAttempt(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      ),
      201
    )
  )
);

router.post(
  "/attempts/:id/submit",
  authorize("lms.attempt"),
  validateParams(idParams),
  validateBody(submitAttemptSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.submitQuizAttempt(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.answers,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/quizzes/:id/attempts",
  authorize("lms.grade"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listAttemptsForGrading(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.get(
  "/attempts/:id",
  authorize("lms.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getAttemptForGrading(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.post(
  "/attempts/:id/grade",
  authorize("lms.grade"),
  validateParams(idParams),
  validateBody(gradeAttemptSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.gradeQuizAttempt(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Progress ----------

router.get(
  "/progress/offering",
  authorize("lms.manage"),
  validateQuery(courseOfferingQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getOfferingProgress(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.courseOfferingId as string
      )
    )
  )
);

router.get(
  "/progress/students/:studentId",
  authorize("lms.read"),
  validateParams(studentIdParams),
  validateQuery(courseOfferingQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getStudentCourseProgress(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.query.courseOfferingId as string,
        req.params.studentId
      )
    )
  )
);

export default router;
