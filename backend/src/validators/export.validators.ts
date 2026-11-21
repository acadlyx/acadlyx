import { z } from "zod";

export const exportJobSchema = z.object({
  format: z.enum(["xlsx", "csv", "docx", "pdf", "json"]).default("xlsx"),
  selection: z.enum(["all-filtered", "current-page", "selected"]).default("all-filtered"),
  ids: z.array(z.string().trim().min(1).max(128)).max(500).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(1000).optional(),
  filters: z.record(z.string(), z.string().max(200)).optional(),
}).strict().superRefine((value, context) => {
  if (value.selection === "selected" && (!value.ids || value.ids.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ids"], message: "Choose at least one row for a selected-row export." });
  }
  if (value.selection !== "selected" && value.ids?.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ids"], message: "Row IDs are only accepted for selected-row exports." });
  }
});
