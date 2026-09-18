import { z } from "zod";

export const portalPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const studentIdParamSchema = z.object({
  studentId: z.string().uuid(),
});

export const createDocumentSchema = z.object({
  ownerId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
  type: z.string().trim().min(1).max(100),
});

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const bulkNotificationSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(500),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export const notificationReadSchema = z.object({
  read: z.boolean().default(true),
});
