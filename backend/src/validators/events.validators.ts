import { z } from "zod";

const jsonList = z.array(z.string().trim().min(1).max(500)).max(50).optional();
const jsonObjects = z.array(z.record(z.unknown())).max(30).optional();

export const eventListQuery = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  status: z.string().trim().max(40).optional(),
  featured: z.coerce.boolean().optional(),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(2).max(180),
  categoryId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  shortDescription: z.string().trim().max(5000).nullable().optional(),
  description: z.string().trim().max(30000).nullable().optional(),
  eventDate: z.coerce.date(),
  startTime: z.string().trim().max(20).nullable().optional(),
  endTime: z.string().trim().max(20).nullable().optional(),
  venue: z.string().trim().max(300).nullable().optional(),
  organizers: jsonObjects,
  speakers: jsonObjects,
  highlights: jsonList,
  videoUrls: z.array(z.string().url().max(1000)).max(20).optional(),
  tags: jsonList,
  status: z.string().trim().max(40).optional(),
  publicationStatus: z.enum(["DRAFT","PUBLISHED","ARCHIVED"]).optional(),
  isFeatured: z.boolean().optional(),
  coverImageUrl: z.string().url().max(2000).nullable().optional(),
  coverFileId: z.string().uuid().nullable().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const mediaSchema = z.object({
  fileAssetId: z.string().uuid(),
  url: z.string().url().max(2000),
  publicId: z.string().max(1000).nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  altText: z.string().trim().max(300).nullable().optional(),
});
