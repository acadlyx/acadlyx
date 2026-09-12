import { z } from "zod";

export const createSectionSchema = z.object({
  semesterId: z.string().uuid(),
  name: z.string().trim().min(1).max(50),
  capacity: z.number().int().min(1).max(1000).optional(),
});

export const updateSectionSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    capacity: z.number().int().min(1).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const listSectionsQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().trim().optional(),
  semesterId: z.string().uuid().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
