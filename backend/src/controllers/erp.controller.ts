import { Request } from "express";

import * as erp from "../services/erp.service";

import {
  getWorkspace,
} from "../services/workspace.service";

import {
  asyncHandler,
} from "../utils/asyncHandler";

import {
  requireInstitution,
} from "../utils/requireInstitution";

import {
  AppError,
} from "../middleware/errorHandler";

const actor = (
  req: Request
) => {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
};

/*
 * ---------------------------------------------------------------------------
 * WORKSPACE
 * ---------------------------------------------------------------------------
 *
 * Leadership users:
 *
 *   /erp/me/workspace
 *          ↓
 *   workspace.service
 *          ↓
 *   one PostgreSQL aggregate query
 *          +
 *   one small notices query
 *
 * HOD / FACULTY / PARENT / STUDENT:
 *
 *   existing ERP workspace implementation
 *
 * The detailed role-specific authorization logic remains inside
 * erp.service and the underlying module services.
 */

export const workspace =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const currentActor =
        actor(req);

      const institutionId =
        requireInstitution(
          req
        );

      const data =
        await getWorkspace(
          institutionId,
          currentActor
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * TIMETABLE
 * ---------------------------------------------------------------------------
 */

export const timetableList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listTimetableEntries(
          requireInstitution(
            req
          ),
          actor(req),
          {
            dayOfWeek:
              req.query
                .dayOfWeek ===
              undefined
                ? undefined
                : Number(
                    req.query
                      .dayOfWeek
                  ),

            courseOfferingId:
              typeof req.query
                .courseOfferingId ===
              "string"
                ? req.query
                    .courseOfferingId
                : undefined,
          }
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const timetable =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createTimetableEntry(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const timetableUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateTimetableEntry(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const timetableDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteTimetableEntry(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * NOTICES
 * ---------------------------------------------------------------------------
 */

export const noticeList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listNotices(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
            .includeExpired !==
            "false"
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const notice =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createNotice(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const noticeUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateNotice(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const noticeDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteNotice(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * EXAMS
 * ---------------------------------------------------------------------------
 */

export const examList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listExams(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const exam =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createExam(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const examUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateExam(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const examDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteExam(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * INTERNAL MARKS
 * ---------------------------------------------------------------------------
 */

export const internalMarks =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listInternalMarks(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const internalMark =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createInternalMark(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const internalMarkUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateInternalMark(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const internalMarkDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteInternalMark(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * ATTENDANCE
 * ---------------------------------------------------------------------------
 */

export const attendanceList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listAttendanceSessions(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const attendance =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createAttendanceSession(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const attendanceUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateAttendanceSession(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * PARENT LINKS
 * ---------------------------------------------------------------------------
 */

export const parentLinks =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listParentStudentLinks(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const parentLink =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createParentStudentLink(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const parentLinkDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteParentStudentLink(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * FEE OPERATIONS
 * ---------------------------------------------------------------------------
 */

export const invoiceList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listInvoices(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const invoice =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.createInvoice(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

export const invoiceUpdate =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.updateInvoice(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.id,
          req.body
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const payment =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.recordPayment(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(201).json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * DOCUMENTS
 * ---------------------------------------------------------------------------
 */

export const documentList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listDocuments(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * NOTIFICATIONS
 * ---------------------------------------------------------------------------
 */

export const notificationList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listNotifications(
          requireInstitution(
            req
          ),
          actor(req),
          req.query
        );

      res.json({
        success: true,
        data,
      });
    }
  );
