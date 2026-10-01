import { Request } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../middleware/errorHandler";
import * as importer from "../services/peopleImport.service";
import { requireInstitution } from "../utils/requireInstitution";

function getType(req: Request): importer.PeopleImportType {
  const type = String(req.params.type) as importer.PeopleImportType;
  if (!importer.PEOPLE_IMPORT_TYPES.includes(type)) throw new AppError(`Unsupported people import type: ${type}`, 400);
  return type;
}
function file(req: Request): Buffer { if (!req.file) throw new AppError("Attach an .xlsx, .xls or .csv file as field 'file'", 400); return req.file.buffer; }

export const preview = asyncHandler(async (req, res) => res.json({ success: true, data: await importer.preview(file(req), getType(req), requireInstitution(req), req.user!) }));
export const commit = asyncHandler(async (req, res) => res.json({ success: true, data: await importer.commit(file(req), getType(req), requireInstitution(req), req.user!) }));
