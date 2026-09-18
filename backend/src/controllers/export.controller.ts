import { Request } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as exporter from "../services/export.service";

export const exportData = asyncHandler(async (req: Request, res) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  const type = String(req.params.type) as exporter.ExportType;
  const format = (String(req.query.format || "xlsx").toLowerCase()) as exporter.ExportFormat;
  const file = await exporter.exportData(requireInstitution(req), req.user, type, format);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
});
