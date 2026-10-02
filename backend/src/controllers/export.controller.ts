import { Request, Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as exporter from "../services/export.service";
import * as attendanceReport from "../services/attendanceReport.service";
import { attendanceReportQuery } from "../validators/attendanceReport.validators";

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const type = String(req.params.type) as exporter.ExportType;
  const format = String(req.query.format || "xlsx").toLowerCase() as exporter.ExportFormat;
  const file = await exporter.exportData(
    requireInstitution(req),
    req.user,
    type,
    format,
  );

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
});

export const attendanceOptions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const data = await attendanceReport.getAttendanceReportOptions(
    requireInstitution(req),
    req.user,
  );

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, data });
});

export const attendanceExport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const parsed = attendanceReportQuery.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || "Invalid attendance export filters",
      400,
    );
  }

  const file = await attendanceReport.exportAttendance(
    requireInstitution(req),
    req.user,
    parsed.data,
  );

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Acadlyx-Export-Rows", String(file.rowCount));
  res.send(file.buffer);
});
