import { Request } from "express";

import * as erp from "../services/erp.service";

import {
  getWorkspace,
  isLeadershipActor,
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
 * CRITICAL PERFORMANCE PATH
 *
 * Leadership users:
 *   /erp/me/workspace
 *          ↓
 *   workspace.service
 *          ↓
 *   one PostgreSQL aggregate query
 *          +
 *   one small notices query
 *
 * HOD / FACULTY / PARENT / STUDENT:
 *   existing ERP workspace implementation
 *
 * The detailed role-specific authorization logic is therefore preserved.
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
          typeof req.query
            .courseOfferingId ===
            "string"
            ? req.query
                .courseOfferingId
            : undefined
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const examDetails =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.getExamDetails(
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

export const result =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.upsertExamResult(
          requireInstitution(
            req
          ),
          actor(req),
          req.body
        );

      res.status(200).json({
        success: true,
        data,
      });
    }
  );

/*
 * ---------------------------------------------------------------------------
 * FEES
 * ---------------------------------------------------------------------------
 */

export const invoiceList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listFeeInvoices(
          requireInstitution(
            req
          ),
          actor(req),
          {
            studentId:
              typeof req.query
                .studentId ===
              "string"
                ? req.query
                    .studentId
                : undefined,

            status:
              typeof req.query
                .status ===
              "string"
                ? req.query
                    .status
                : undefined,
          }
        );

      res.json({
        success: true,
        data,
      });
    }
  );

export const invoiceDetails =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.getFeeInvoice(
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
        await erp.updateFeeInvoice(
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

export const invoiceDelete =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.deleteFeeInvoice(
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
          req.params.id,
          req.body.amount,
          req.body.reference
        );

      res.status(201).json({
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

export const parentLinkList =
  asyncHandler(
    async (
      req,
      res
    ) => {
      const data =
        await erp.listParentLinks(
          requireInstitution(
            req
          ),
          actor(req),
          typeof req.query
            .studentId ===
            "string"
            ? req.query
                .studentId
            : undefined
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
        await erp.linkParent(
          requireInstitution(
            req
          ),
          actor(req),
          req.body.parentId,
          req.body.studentId,
          req.body.relationship
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
        await erp.deleteParentLink(
          requireInstitution(
            req
          ),
          actor(req),
          req.params.parentId,
          req.params.studentId
        );

      res.json({
        success: true,
        data,
      });
    }
  );
