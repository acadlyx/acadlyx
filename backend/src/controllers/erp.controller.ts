import { Request } from "express";

import * as erp from "../services/erp.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";

function actor(req: Request) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  return req.user;
}

/**
 * GET /api/v1/erp/me/workspace
 */
export const workspace = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.getMyWorkspace(
    institutionId,
    user
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/* -------------------------------------------------------------------------- */
/* TIMETABLE                                                                   */
/* -------------------------------------------------------------------------- */

export const timetableList = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.listTimetableEntries(
    institutionId,
    user,
    {
      dayOfWeek:
        req.query.dayOfWeek === undefined
          ? undefined
          : Number(req.query.dayOfWeek),

      courseOfferingId:
        typeof req.query.courseOfferingId === "string"
          ? req.query.courseOfferingId
          : undefined,
    }
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const timetable = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.createTimetableEntry(
    institutionId,
    user,
    req.body
  );

  res.status(201).json({
    success: true,
    data,
  });
});

export const timetableUpdate = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.updateTimetableEntry(
    institutionId,
    user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const timetableDelete = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.deleteTimetableEntry(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/* -------------------------------------------------------------------------- */
/* NOTICES                                                                     */
/* -------------------------------------------------------------------------- */

export const noticeList = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.listNotices(
    institutionId,
    user,
    req.query.includeExpired !== "false"
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const notice = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.createNotice(
    institutionId,
    user,
    req.body
  );

  res.status(201).json({
    success: true,
    data,
  });
});

export const noticeUpdate = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.updateNotice(
    institutionId,
    user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const noticeDelete = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.deleteNotice(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/* -------------------------------------------------------------------------- */
/* EXAMS                                                                       */
/* -------------------------------------------------------------------------- */

export const examList = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.listExams(
    institutionId,
    user,
    typeof req.query.courseOfferingId === "string"
      ? req.query.courseOfferingId
      : undefined
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const examDetails = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.getExamDetails(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const exam = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.createExam(
    institutionId,
    user,
    req.body
  );

  res.status(201).json({
    success: true,
    data,
  });
});

export const examUpdate = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.updateExam(
    institutionId,
    user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const examDelete = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.deleteExam(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const result = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.upsertExamResult(
    institutionId,
    user,
    req.body
  );

  res.status(200).json({
    success: true,
    data,
  });
});

/* -------------------------------------------------------------------------- */
/* FEES                                                                        */
/* -------------------------------------------------------------------------- */

export const invoiceList = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.listFeeInvoices(
    institutionId,
    user,
    {
      studentId:
        typeof req.query.studentId === "string"
          ? req.query.studentId
          : undefined,

      status:
        typeof req.query.status === "string"
          ? req.query.status
          : undefined,
    }
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const invoiceDetails = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.getFeeInvoice(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const invoice = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.createInvoice(
    institutionId,
    user,
    req.body
  );

  res.status(201).json({
    success: true,
    data,
  });
});

export const invoiceUpdate = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.updateFeeInvoice(
    institutionId,
    user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const invoiceDelete = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.deleteFeeInvoice(
    institutionId,
    user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const payment = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.recordPayment(
    institutionId,
    user,
    req.params.id,
    req.body.amount,
    req.body.reference
  );

  res.status(201).json({
    success: true,
    data,
  });
});

/* -------------------------------------------------------------------------- */
/* PARENT LINKS                                                                */
/* -------------------------------------------------------------------------- */

export const parentLinkList = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.listParentLinks(
    institutionId,
    user,
    typeof req.query.studentId === "string"
      ? req.query.studentId
      : undefined
  );

  res.status(200).json({
    success: true,
    data,
  });
});

export const parentLink = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.linkParent(
    institutionId,
    user,
    req.body.parentId,
    req.body.studentId,
    req.body.relationship
  );

  res.status(201).json({
    success: true,
    data,
  });
});

export const parentLinkDelete = asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const user = actor(req);

  const data = await erp.deleteParentLink(
    institutionId,
    user,
    req.params.parentId,
    req.params.studentId
  );

  res.status(200).json({
    success: true,
    data,
  });
});
