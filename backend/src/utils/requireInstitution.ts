import { Request } from "express";
import { AppError } from "../middleware/errorHandler";

/**
 * Every academic-structure route is institution-scoped. This pulls
 * the tenant id from the verified access token (req.user), never
 * from anything client-supplied, and 403s if the caller has no
 * institution context (e.g. a platform-level SUPER_ADMIN hitting a
 * tenant-scoped route without impersonation — out of scope for now).
 */
export function requireInstitution(req: Request): string {
  const institutionId = req.user?.institutionId;
  if (!institutionId) {
    throw new AppError(
      "This action requires a user scoped to an institution",
      403
    );
  }
  return institutionId;
}
