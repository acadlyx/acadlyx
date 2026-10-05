export type StudentEnrollmentState =
  | "PROFILE_MISSING"
  | "MISSING"
  | "INVALID"
  | "ENROLLED";

export function classifyStudentEnrollmentState(
  profile: unknown,
  enrollment: any
): StudentEnrollmentState {
  if (!profile) return "PROFILE_MISSING";
  if (!enrollment) return "MISSING";
  if (enrollment.status !== "ACTIVE") return "INVALID";
  if (!enrollment.program?.isActive || !enrollment.program?.department?.isActive) return "INVALID";
  if (!enrollment.academicYear?.isCurrent) return "INVALID";
  if (!enrollment.semester?.isActive) return "INVALID";
  if (
    enrollment.semester.programId !== enrollment.program.id ||
    enrollment.semester.academicYearId !== enrollment.academicYear.id
  ) return "INVALID";
  if (
    enrollment.section &&
    (!enrollment.section.isActive || enrollment.section.semesterId !== enrollment.semester.id)
  ) return "INVALID";
  return "ENROLLED";
}
