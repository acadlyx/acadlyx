import { z } from "zod";

import { optionalUuid } from "./common";

const optionalDate = z.coerce.date().optional();

export const attendanceReportQuery = z
  .object({
    format: z.enum(["xlsx", "csv"]).default("xlsx"),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    departmentId: optionalUuid,
    programId: optionalUuid,
    courseId: optionalUuid,
    academicYearId: optionalUuid,
    semesterId: optionalUuid,
    sectionId: optionalUuid,
    courseOfferingId: optionalUuid,
    facultyId: optionalUuid,
    status: z.enum(["PRESENT", "ABSENT", "LATE"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "dateTo must be on or after dateFrom",
      });
    }
  });

export type AttendanceReportQuery = z.infer<
  typeof attendanceReportQuery
>;
