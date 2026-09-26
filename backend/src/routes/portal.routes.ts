import { Router } from "express";

import * as controller from "../controllers/portal.controller";
import { authenticate } from "../middleware/authenticate";
import {
  authorize,
  authorizeAnyPermission,
  authorizeRoles,
} from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
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
  requireFeature("parent_portal"),
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
  requireFeature("parent_portal"),
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
  requireFeature("parent_portal"),
  authorizeAnyPermission(
    "students.read",
    "parent-portal.read"
  ),
  validateParams(studentIdParamSchema),
  controller.studentPortal
);

router.get(
  "/me",
  requireFeature("students"),
  authorizeRoles("STUDENT"),
  controller.myStudentPortal
);

/*
 * NOTIFICATIONS
 */

router.get(
  "/notifications",
  requireFeature("notifications"),
  authorize(
    "notifications.read"
  ),
  validateQuery(
    portalPaginationSchema
  ),
  controller.notifications
);

router.patch(
  "/notifications/:id",
  requireFeature("notifications"),
  authorize(
    "notifications.read"
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
  requireFeature("notifications"),
  authorize(
    "notifications.read"
  ),
  controller.markAllNotificationsRead
);

router.post(
  "/notifications",
  requireFeature("notifications"),
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
  requireFeature("notifications"),
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
  requireFeature("documents"),
  authorize(
    "documents.read"
  ),
  controller.myDocuments
);

router.get(
  "/documents/students/:studentId",
  requireFeature("documents"),
  authorizeAnyPermission(
    "students.read",
    "parent-portal.read"
  ),
  validateParams(
    studentIdParamSchema
  ),
  controller.studentDocuments
);

router.post(
  "/documents",
  requireFeature("documents"),
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
  requireFeature("documents"),
  authorize(
    "students.update"
  ),
  validateParams(
    documentIdParamSchema
  ),
  controller.deleteDocument
);

export default router;
