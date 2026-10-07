import { Request, Response } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import { assertSafeImageUpload } from "../utils/imageUpload";
import { storeFile } from "../services/fileStorage.service";
import * as service from "../services/events.service";
import { validateBody, validateParams, validateQuery } from "../middleware/validate";
import { idParams } from "../validators/common";
import { eventListQuery, createEventSchema, updateEventSchema, categorySchema, mediaSchema } from "../validators/events.validators";
import { authorize } from "../middleware/authorize";
import { auditMeta, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";

const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:25*1024*1024,files:20}});

export const list=asyncHandler(async(req:Request,res:Response)=>{
  const p=parsePagination(req);
  const q=req.query as Record<string,unknown>;
  const data=await service.listEvents(requireInstitution(req),requireAuthenticatedUser(req),p,{
    search:typeof q.search==="string"?q.search:undefined,categoryId:typeof q.categoryId==="string"?q.categoryId:undefined,
    departmentId:typeof q.departmentId==="string"?q.departmentId:undefined,year:q.year?Number(q.year):undefined,
    status:typeof q.status==="string"?q.status:undefined,featured:q.featured===undefined?undefined:q.featured==="true",
  });
  sendPage(res,data.items,data.total,p);
});
export const get=asyncHandler(async(req,res)=>sendOk(res,await service.getEvent(requireInstitution(req),requireAuthenticatedUser(req),req.params.id)));
export const create=asyncHandler(async(req,res)=>sendOk(res,await service.createEvent(requireInstitution(req),requireAuthenticatedUser(req),req.body,auditMeta(req)),201));
export const update=asyncHandler(async(req,res)=>sendOk(res,await service.updateEvent(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,req.body,auditMeta(req))));
export const remove=asyncHandler(async(req,res)=>sendOk(res,await service.deleteEvent(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,auditMeta(req))));
export const categories=asyncHandler(async(req,res)=>sendOk(res,await service.listCategories(requireInstitution(req))));
export const createCategory=asyncHandler(async(req,res)=>sendOk(res,await service.createCategory(requireInstitution(req),requireAuthenticatedUser(req),req.body,auditMeta(req)),201));
export const uploadMedia=asyncHandler(async(req,res)=>{
  if(!req.file) throw new AppError("Media file is required",400);
  assertSafeImageUpload(req.file);
  const stored=await storeFile({institutionId:requireInstitution(req),module:"events-gallery",buffer:req.file.buffer,filename:req.file.originalname,mimeType:req.file.mimetype,ownerId:req.user!.id,visibility:"public",resourceType:"image"});
  sendOk(res,{id:stored.id,url:stored.secureUrl,publicId:stored.publicId},201);
});
export const addMedia=asyncHandler(async(req,res)=>sendOk(res,await service.addMedia(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,req.body,auditMeta(req)),201));
export const removeMedia=asyncHandler(async(req,res)=>sendOk(res,await service.removeMedia(requireInstitution(req),requireAuthenticatedUser(req),req.params.mediaId,auditMeta(req))));
export const reorderMedia=asyncHandler(async(req,res)=>sendOk(res,await service.reorderMedia(requireInstitution(req),requireAuthenticatedUser(req),req.params.id,req.body.ids,auditMeta(req))));
