import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { PaginationParams } from "../utils/pagination";
import { recordAuditLog } from "./audit.service";
import { deleteFile } from "./fileStorage.service";
import { getDirectorDepartmentIds, getEffectiveWorkspaceRole } from "./accessScope.service";
import { logger } from "../utils/logger";
import type { CreateEventInput, UpdateEventInput, CategoryInput, MediaInput } from "../validators/events.validators";

type Meta = { ipAddress?: string; userAgent?: string };

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "event";
}

function canManage(actor: AuthenticatedUser) {
  return actor.permissions.includes("events.manage");
}

function assertSameInstitution(actor: AuthenticatedUser, institutionId: string) {
  if (actor.roles.includes("SUPER_ADMIN")) return;
  if (actor.institutionId !== institutionId) throw new AppError("Institution context mismatch", 403);
}

function isDirectorScope(actor: AuthenticatedUser): boolean {
  return getEffectiveWorkspaceRole(actor) === "DIRECTOR";
}

async function assertDirectorDepartment(institutionId: string, actor: AuthenticatedUser, departmentId?: string | null): Promise<void> {
  if (!isDirectorScope(actor)) return;
  const allowed = await getDirectorDepartmentIds(institutionId, actor.id);
  if (!departmentId || !allowed.includes(departmentId)) {
    throw new AppError("Events managed by a Director must belong to an assigned campus department", 403);
  }
}

async function assertDirectorEvent(institutionId: string, actor: AuthenticatedUser, departmentId: string | null, publicationStatus: string, canManageRecord: boolean): Promise<void> {
  if (!isDirectorScope(actor)) return;
  if (!canManageRecord && !departmentId && publicationStatus === "PUBLISHED") return;
  await assertDirectorDepartment(institutionId, actor, departmentId);
}

async function uniqueSlug(institutionId: string, title: string, excludeId?: string) {
  const base = slugify(title);
  let slug = base;
  let n = 2;
  while (await prisma.institutionalEvent.findFirst({ where: { institutionId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

async function assertRefs(institutionId: string, categoryId?: string | null, departmentId?: string | null) {
  if (categoryId && !(await prisma.eventCategory.findFirst({ where: { id: categoryId, institutionId }, select: { id: true } }))) {
    throw new AppError("Event category not found in this institution", 404);
  }
  if (departmentId && !(await prisma.department.findFirst({ where: { id: departmentId, institutionId }, select: { id: true } }))) {
    throw new AppError("Department not found in this institution", 404);
  }
}

const include = {
  category: { select: { id: true, name: true, slug: true } },
  department: { select: { id: true, name: true, code: true } },
  media: { orderBy: { displayOrder: "asc" as const } },
};

export async function listEvents(institutionId: string, actor: AuthenticatedUser, pagination: PaginationParams, filters: {
  search?: string; categoryId?: string; departmentId?: string; year?: number; status?: string; featured?: boolean;
}) {
  assertSameInstitution(actor, institutionId);
  const where: Prisma.InstitutionalEventWhereInput = {
    institutionId,
    ...(canManage(actor) ? (filters.status ? { publicationStatus: filters.status } : {}) : { publicationStatus: "PUBLISHED" }),
    ...(filters.search ? { OR: [
      { title: { contains: filters.search, mode: "insensitive" } },
      { shortDescription: { contains: filters.search, mode: "insensitive" } },
    ] } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.year ? { eventDate: { gte: new Date(`${filters.year}-01-01T00:00:00.000Z`), lt: new Date(`${filters.year + 1}-01-01T00:00:00.000Z`) } } : {}),
    ...(filters.featured !== undefined ? { isFeatured: filters.featured } : {}),
  };
  if (isDirectorScope(actor)) {
    const allowedDepartments = await getDirectorDepartmentIds(institutionId, actor.id);
    where.AND = [
      { OR: [
        ...(allowedDepartments.length ? [{ departmentId: { in: allowedDepartments } }] : []),
        { departmentId: null, publicationStatus: "PUBLISHED" },
      ] },
    ];
  }
  const [items,total]=await Promise.all([
    prisma.institutionalEvent.findMany({ where, include, orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }], skip: pagination.skip, take: pagination.take }),
    prisma.institutionalEvent.count({ where }),
  ]);
  return { items, total };
}

export async function getEvent(institutionId:string, actor:AuthenticatedUser,id:string) {
  assertSameInstitution(actor,institutionId);
  const event=await prisma.institutionalEvent.findFirst({where:{id,institutionId},include});
  if(!event) throw new AppError("Event not found",404);
  if(!canManage(actor) && event.publicationStatus!=="PUBLISHED") throw new AppError("Event not found",404);
  await assertDirectorEvent(institutionId, actor, event.departmentId, event.publicationStatus, false);
  return event;
}

export async function createEvent(institutionId:string,actor:AuthenticatedUser,input:CreateEventInput,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage events",403);
  assertSameInstitution(actor,institutionId);
  await assertRefs(institutionId,input.categoryId,input.departmentId);
  await assertDirectorDepartment(institutionId, actor, input.departmentId);
  const slug=await uniqueSlug(institutionId,input.title);
  const published=input.publicationStatus==="PUBLISHED";
  const event=await prisma.institutionalEvent.create({data:{
    institutionId, categoryId:input.categoryId??null, departmentId:input.departmentId??null,
    title:input.title,slug,shortDescription:input.shortDescription??null,description:input.description??null,
    eventDate:input.eventDate,startTime:input.startTime??null,endTime:input.endTime??null,venue:input.venue??null,
    organizers:input.organizers ? (input.organizers as Prisma.InputJsonValue) : undefined,speakers:input.speakers ? (input.speakers as Prisma.InputJsonValue) : undefined,highlights:input.highlights??undefined,
    videoUrls:input.videoUrls??undefined,tags:input.tags??undefined,status:input.status??"DRAFT",
    publicationStatus:input.publicationStatus??"DRAFT",isFeatured:input.isFeatured??false,
    coverImageUrl:input.coverImageUrl??null,coverFileId:input.coverFileId??null,createdById:actor.id,
    publishedAt:published?new Date():null,
  },include});
  await recordAuditLog({institutionId,userId:actor.id,action:"events.create",entityType:"InstitutionalEvent",entityId:event.id,metadata:{title:event.title,publicationStatus:event.publicationStatus},...meta});
  return event;
}

export async function updateEvent(institutionId:string,actor:AuthenticatedUser,id:string,input:UpdateEventInput,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage events",403);
  const existing=await prisma.institutionalEvent.findFirst({where:{id,institutionId}});
  if(!existing) throw new AppError("Event not found",404);
  await assertDirectorEvent(institutionId, actor, existing.departmentId, existing.publicationStatus, true);
  await assertRefs(institutionId,input.categoryId===undefined?existing.categoryId:input.categoryId,input.departmentId===undefined?existing.departmentId:input.departmentId);
  await assertDirectorDepartment(institutionId, actor, input.departmentId===undefined?existing.departmentId:input.departmentId);
  const publicationStatus=input.publicationStatus??existing.publicationStatus;
  const event=await prisma.institutionalEvent.update({where:{id},data:{
    categoryId:input.categoryId,departmentId:input.departmentId,title:input.title,shortDescription:input.shortDescription,
    description:input.description,eventDate:input.eventDate,startTime:input.startTime,endTime:input.endTime,venue:input.venue,
    organizers:input.organizers ? (input.organizers as Prisma.InputJsonValue) : undefined,speakers:input.speakers ? (input.speakers as Prisma.InputJsonValue) : undefined,highlights:input.highlights,videoUrls:input.videoUrls,tags:input.tags,
    status:input.status,publicationStatus,isFeatured:input.isFeatured,coverImageUrl:input.coverImageUrl,coverFileId:input.coverFileId,
    updatedById:actor.id,publishedAt:publicationStatus==="PUBLISHED"?(existing.publishedAt??new Date()):null,
  },include});
  await recordAuditLog({institutionId,userId:actor.id,action:"events.update",entityType:"InstitutionalEvent",entityId:id,metadata:input as Prisma.InputJsonValue,...meta});
  return event;
}

export async function deleteEvent(institutionId:string,actor:AuthenticatedUser,id:string,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage events",403);
  const existing=await prisma.institutionalEvent.findFirst({where:{id,institutionId},include:{media:{select:{fileAssetId:true}}}});
  if(!existing) throw new AppError("Event not found",404);
  await assertDirectorEvent(institutionId, actor, existing.departmentId, existing.publicationStatus, true);
  await prisma.institutionalEvent.delete({where:{id}});
  const cleanupFailures: string[] = [];
  for (const media of existing.media) {
    try { await deleteFile(media.fileAssetId, institutionId); }
    catch (error) { cleanupFailures.push(media.fileAssetId); logger.warn("Event media cleanup failed", { mediaId: media.fileAssetId, error: error instanceof Error ? error.message : String(error) }); }
  }
  if (existing.coverFileId) {
    try { await deleteFile(existing.coverFileId, institutionId); }
    catch (error) { cleanupFailures.push(existing.coverFileId); logger.warn("Event cover cleanup failed", { fileId: existing.coverFileId, error: error instanceof Error ? error.message : String(error) }); }
  }
  await recordAuditLog({institutionId,userId:actor.id,action:"events.delete",entityType:"InstitutionalEvent",entityId:id,metadata:{title:existing.title,cleanupFailures},...meta});
  return {id,deleted:true};
}

export async function listCategories(institutionId:string) {
  return prisma.eventCategory.findMany({where:{institutionId,isActive:true},orderBy:{name:"asc"}});
}
export async function createCategory(institutionId:string,actor:AuthenticatedUser,input:CategoryInput,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage event categories",403);
  const slug=slugify(input.name);
  const existing=await prisma.eventCategory.findFirst({where:{institutionId,slug}});
  if(existing) return existing;
  const item=await prisma.eventCategory.create({data:{institutionId,name:input.name,slug,description:input.description??null,isActive:input.isActive??true}});
  await recordAuditLog({institutionId,userId:actor.id,action:"events.category.create",entityType:"EventCategory",entityId:item.id,metadata:{name:item.name},...meta});
  return item;
}
export async function addMedia(institutionId:string,actor:AuthenticatedUser,eventId:string,input:MediaInput,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage galleries",403);
  const event=await prisma.institutionalEvent.findFirst({where:{id:eventId,institutionId},select:{id:true,departmentId:true,publicationStatus:true}});
  if(!event) throw new AppError("Event not found",404);
  await assertDirectorEvent(institutionId, actor, event.departmentId, event.publicationStatus, true);
  const file=await prisma.fileAsset.findFirst({where:{id:input.fileAssetId,institutionId,module:"events-gallery"},select:{id:true,url:true,publicId:true}});
  if(!file) throw new AppError("Uploaded media is not registered for Events & Gallery",404);
  const max=await prisma.eventMedia.aggregate({where:{eventId},_max:{displayOrder:true}});
  const item=await prisma.eventMedia.create({data:{eventId,institutionId,fileAssetId:file.id,url:input.url||file.url,publicId:input.publicId??file.publicId,title:input.title??null,altText:input.altText??null,displayOrder:(max._max.displayOrder??-1)+1}});
  await recordAuditLog({institutionId,userId:actor.id,action:"events.media.add",entityType:"EventMedia",entityId:item.id,metadata:{eventId},...meta});
  return item;
}
export async function removeMedia(institutionId:string,actor:AuthenticatedUser,mediaId:string,meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage galleries",403);
  const media=await prisma.eventMedia.findFirst({where:{id:mediaId,institutionId},include:{event:{select:{departmentId:true,publicationStatus:true}}}});
  if(!media) throw new AppError("Gallery image not found",404);
  await assertDirectorEvent(institutionId, actor, media.event.departmentId, media.event.publicationStatus, true);
  await prisma.eventMedia.delete({where:{id:mediaId}});
  try { await deleteFile(media.fileAssetId,institutionId); } catch (error) { logger.warn("Event media cleanup failed", { mediaId: media.fileAssetId, error: error instanceof Error ? error.message : String(error) }); }
  await recordAuditLog({institutionId,userId:actor.id,action:"events.media.remove",entityType:"EventMedia",entityId:mediaId,metadata:{eventId:media.eventId},...meta});
  return {id:mediaId,deleted:true};
}
export async function reorderMedia(institutionId:string,actor:AuthenticatedUser,eventId:string,ids:string[],meta:Meta) {
  if(!canManage(actor)) throw new AppError("You are not allowed to manage galleries",403);
  const event=await prisma.institutionalEvent.findFirst({where:{id:eventId,institutionId},select:{departmentId:true,publicationStatus:true}});
  if(!event) throw new AppError("Event not found",404);
  await assertDirectorEvent(institutionId, actor, event.departmentId, event.publicationStatus, true);
  const media=await prisma.eventMedia.findMany({where:{eventId,institutionId},select:{id:true}});
  if(media.length!==ids.length || media.some(x=>!ids.includes(x.id))) throw new AppError("Gallery order does not match this event",422);
  await prisma.$transaction(ids.map((id,index)=>prisma.eventMedia.update({where:{id},data:{displayOrder:index}})));
  await recordAuditLog({institutionId,userId:actor.id,action:"events.media.reorder",entityType:"EventMedia",entityId:eventId,metadata:{ids},...meta});
  return prisma.eventMedia.findMany({where:{eventId,institutionId},orderBy:{displayOrder:"asc"}});
}
