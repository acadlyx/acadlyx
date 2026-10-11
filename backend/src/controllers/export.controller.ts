import { Request, Response } from "express";

import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as exporter from "../services/export.service";
import { recordAuditLog } from "../services/audit.service";
import * as attendanceReport from "../services/attendanceReport.service";
import { attendanceReportQuery } from "../validators/attendanceReport.validators";

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const type = String(req.params.type) as exporter.ExportType;
  const format = String(req.query.format || "xlsx").toLowerCase() as exporter.ExportFormat;
  const readText = (key: string): string | undefined => {
    const value = req.query[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw new AppError("Invalid export option: " + key, 400);
    return value;
  };
  const readInt = (key: string): number | undefined => {
    const value = readText(key);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new AppError("Invalid integer export option: " + key, 400);
    return parsed;
  };
  const rawIds = req.query.ids;
  let ids: string[] | undefined;
  if (rawIds !== undefined) {
    if (typeof rawIds === "string") ids = rawIds.split(",").filter(Boolean);
    else if (Array.isArray(rawIds) && rawIds.every((value) => typeof value === "string")) ids = rawIds as string[];
    else throw new AppError("Invalid selected row IDs", 400);
  }
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (!key.startsWith("filter_")) continue;
    if (typeof value !== "string") throw new AppError("Invalid export filter: " + key.slice(7), 400);
    filters[key.slice(7)] = value;
  }
  const options: exporter.ExportRequestOptions = {
    selection: (readText("selection") || "all-filtered") as exporter.ExportRequestOptions["selection"],
    ids,
    page: readInt("page"),
    pageSize: readInt("pageSize"),
    filters,
  };
  const file = await exporter.exportData(
    requireInstitution(req),
    req.user,
    type,
    format,
    options,
  );

  await recordAuditLog({
    institutionId: requireInstitution(req),
    userId: req.user.id,
    action: "DATA_EXPORT",
    entityType: type,
    metadata: {
      format,
      rowCount: file.rowCount,
      selection: options.selection || "all-filtered",
      page: options.page ?? null,
      pageSize: options.pageSize ?? null,
      selectedCount: options.ids?.length ?? 0,
      filterKeys: Object.keys(options.filters || {}),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || undefined,
  });

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("X-Acadlyx-Export-Rows", String(file.rowCount));
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
