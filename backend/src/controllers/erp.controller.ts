import { Request } from "express";
import * as erp from "../services/erp.service";
import {
  getManagementWorkspace,
  isLeadershipActor,
} from "../services/managementWorkspace.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";

const actor = (req: Request) => {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
};

export const workspace = asyncHandler(
  async (req, res) => {
    const currentActor = actor(req);
    const institutionId =
      requireInstitution(req);

    /*
     * Leadership dashboards use the optimized
     * PostgreSQL aggregation service.
     *
     * HOD / FACULTY / PARENT / STUDENT continue
     * through the existing ERP service so their
     * existing authority and scope logic remains
     * untouched.
     */
    const data =
      isLeadershipActor(currentActor)
        ? await getManagementWorkspace(
            institutionId,
            currentActor
          )
        : await erp.getMyWorkspace(
            institutionId,
            currentActor
          );

    res.json({
      success: true,
      data,
    });
  }
);

export const timetableList =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.listTimetableEntries(
          requireInstitution(req),
          actor(req),
          {
            dayOfWeek:
              req.query.dayOfWeek ===
              undefined
                ? undefined
                : Number(
                    req.query.dayOfWeek
                  ),

            courseOfferingId:
              typeof req.query
                .courseOfferingId ===
              "string"
                ? req.query
                    .courseOfferingId
                : undefined,
          }
        ),
    })
  );

export const timetable =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data:
        await erp.createTimetableEntry(
          requireInstitution(req),
          actor(req),
          req.body
        ),
    })
  );

export const timetableUpdate =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.updateTimetableEntry(
          requireInstitution(req),
          actor(req),
          req.params.id,
          req.body
        ),
    })
  );

export const timetableDelete =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.deleteTimetableEntry(
          requireInstitution(req),
          actor(req),
          req.params.id
        ),
    })
  );

export const noticeList =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.listNotices(
        requireInstitution(req),
        actor(req),
        req.query.includeExpired !==
          "false"
      ),
    })
  );

export const notice =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: await erp.createNotice(
        requireInstitution(req),
        actor(req),
        req.body
      ),
    })
  );

export const noticeUpdate =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.updateNotice(
        requireInstitution(req),
        actor(req),
        req.params.id,
        req.body
      ),
    })
  );

export const noticeDelete =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.deleteNotice(
        requireInstitution(req),
        actor(req),
        req.params.id
      ),
    })
  );

export const examList =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.listExams(
        requireInstitution(req),
        actor(req),
        typeof req.query
          .courseOfferingId ===
          "string"
          ? req.query.courseOfferingId
          : undefined
      ),
    })
  );

export const examDetails =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.getExamDetails(
        requireInstitution(req),
        actor(req),
        req.params.id
      ),
    })
  );

export const exam =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: await erp.createExam(
        requireInstitution(req),
        actor(req),
        req.body
      ),
    })
  );

export const examUpdate =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.updateExam(
        requireInstitution(req),
        actor(req),
        req.params.id,
        req.body
      ),
    })
  );

export const examDelete =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data: await erp.deleteExam(
        requireInstitution(req),
        actor(req),
        req.params.id
      ),
    })
  );

export const result =
  asyncHandler(async (req, res) =>
    res.status(200).json({
      success: true,
      data:
        await erp.upsertExamResult(
          requireInstitution(req),
          actor(req),
          req.body
        ),
    })
  );

export const invoiceList =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.listFeeInvoices(
          requireInstitution(req),
          actor(req),
          {
            studentId:
              typeof req.query
                .studentId ===
              "string"
                ? req.query.studentId
                : undefined,

            status:
              typeof req.query.status ===
              "string"
                ? req.query.status
                : undefined,
          }
        ),
    })
  );

export const invoiceDetails =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.getFeeInvoice(
          requireInstitution(req),
          actor(req),
          req.params.id
        ),
    })
  );

export const invoice =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: await erp.createInvoice(
        requireInstitution(req),
        actor(req),
        req.body
      ),
    })
  );

export const invoiceUpdate =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.updateFeeInvoice(
          requireInstitution(req),
          actor(req),
          req.params.id,
          req.body
        ),
    })
  );

export const invoiceDelete =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.deleteFeeInvoice(
          requireInstitution(req),
          actor(req),
          req.params.id
        ),
    })
  );

export const payment =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: await erp.recordPayment(
        requireInstitution(req),
        actor(req),
        req.params.id,
        req.body.amount,
        req.body.reference
      ),
    })
  );

export const parentLinkList =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.listParentLinks(
          requireInstitution(req),
          actor(req),
          typeof req.query.studentId ===
            "string"
            ? req.query.studentId
            : undefined
        ),
    })
  );

export const parentLink =
  asyncHandler(async (req, res) =>
    res.status(201).json({
      success: true,
      data: await erp.linkParent(
        requireInstitution(req),
        actor(req),
        req.body.parentId,
        req.body.studentId,
        req.body.relationship
      ),
    })
  );

export const parentLinkDelete =
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      data:
        await erp.deleteParentLink(
          requireInstitution(req),
          actor(req),
          req.params.parentId,
          req.params.studentId
        ),
    })
  );
