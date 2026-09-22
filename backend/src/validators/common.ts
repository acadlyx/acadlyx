import { z } from "zod";

export const uuid = z.string().uuid();

export const idParams = z.object({ id: z.string().uuid() });

/** Optional value that treats "" and null as "not provided". */
export const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional()
  );

export const optionalText = (max: number) =>
  emptyToUndefined(z.string().trim().max(max));

export const optionalUuid = emptyToUndefined(z.string().uuid());

/** YYYY-MM-DD or a full ISO timestamp, converted to a Date. */
export const dateInput = z.coerce.date();

export const optionalDate = emptyToUndefined(z.coerce.date());

export const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
};
