import { Router } from "express";

import * as controller from "../controllers/portal.controller";
import { authenticate } from "../middleware/authenticate";
import {
  authorize,
  authorizeRoles,
} from "../middleware/authorize";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";

import {
  bulkNotificationSchema,
  createDocumentSchema,
  createNotificationSchema,
  documentIdParamSchema,
  notificationIdParamSchema,
  notificationReadSchema,
  portalPaginationSchema,
  studentIdParamSchema,
} from "../validators/portal.validators";

const router = Router();

router.use(authenticate);

/*
 * PARENT PORTAL
 */

router.get(
  "/parent/children",
  authorizeRoles(
    "PARENT",
    "SUPER_ADMIN",
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "MANAGEMENT",
    "HOD",
    "STAFF"
  ),
  controller.parentChildren
);

router.get(
  "/parent/dashboard",
  authorizeRoles(
    "PARENT",
    "SUPER_ADMIN",
    "INSTITUTION_ADMIN",
    "DIRECTOR",
    "MANAGEMENT",
    "HOD",
    "STAFF"
  ),
  controller.parentDashboard
);

/*
 * STUDENT / PARENT SHARED STUDENT VIEW
 *
 * Service-level authorization determines whether:
 * - a student is viewing themselves,
 * - a parent is viewing a linked child,
 * - or a management role is viewing institution data.
 */
router.get(
  "/students/:studentId",
  authorize(
    "students.read"
  ),
  validateParams(studentIdParamSchema),
  controller.studentPortal
);

/*
 * NOTIFICATIONS
 */

router.get(
  "/notifications",
  authorize(
    "attendance.read"
  ),
  validateQuery(
    portalPaginationSchema
  ),
  controller.notifications
);

router.patch(
  "/notifications/:id",
  authorize(
    "attendance.read"
  ),
  validateParams(
    notificationIdParamSchema
  ),
  validateBody(
    notificationReadSchema
  ),
  controller.markNotification
);

router.post(
  "/notifications/read-all",
  authorize(
    "attendance.read"
  ),
  controller.markAllNotificationsRead
);

router.post(
  "/notifications",
  authorize(
    "notices.manage"
  ),
  validateBody(
    createNotificationSchema
  ),
  controller.createNotification
);

router.post(
  "/notifications/bulk",
  authorize(
    "notices.manage"
  ),
  validateBody(
    bulkNotificationSchema
  ),
  controller.createBulkNotifications
);

/*
 * DOCUMENTS
 */

router.get(
  "/documents/me",
  authorize(
    "students.read"
  ),
  controller.myDocuments
);

router.get(
  "/documents/students/:studentId",
  authorize(
    "students.read"
  ),
  validateParams(
    studentIdParamSchema
  ),
  controller.studentDocuments
);

router.post(
  "/documents",
  authorize(
    "students.update"
  ),
  validateBody(
    createDocumentSchema
  ),
  controller.createDocument
);

router.delete(
  "/documents/:id",
  authorize(
    "students.update"
  ),
  validateParams(
    documentIdParamSchema
  ),
  controller.deleteDocument
);

export default router;
