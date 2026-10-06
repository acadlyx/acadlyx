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
  if (enrollment.institutionId && profile && (profile as any).institutionId && enrollment.institutionId !== (profile as any).institutionId) return "INVALID";
  if (enrollment.program?.institutionId && profile && (profile as any).institutionId && enrollment.program.institutionId !== (profile as any).institutionId) return "INVALID";
  if (enrollment.academicYear?.institutionId && profile && (profile as any).institutionId && enrollment.academicYear.institutionId !== (profile as any).institutionId) return "INVALID";
  if (enrollment.semester?.institutionId && profile && (profile as any).institutionId && enrollment.semester.institutionId !== (profile as any).institutionId) return "INVALID";
  if (enrollment.section?.institutionId && profile && (profile as any).institutionId && enrollment.section.institutionId !== (profile as any).institutionId) return "INVALID";
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
