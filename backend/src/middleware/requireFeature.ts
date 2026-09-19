import { NextFunction, Request, Response } from "express";
import { TenantFeature } from "../config/features";
import { assertTenantFeature } from "../services/entitlement.service";
import { AppError } from "./errorHandler";

/** Enforces the tenant half of `entitlement + permission + data scope`. */
export function requireFeature(feature: TenantFeature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw new AppError("Authentication required", 401);
      // Platform operations do not belong to a tenant entitlement.
      if (req.user.roles.includes("SUPER_ADMIN") && !req.user.institutionId) return next();
      if (!req.user.institutionId) throw new AppError("Tenant context is required", 403);
      await assertTenantFeature(req.user.institutionId, feature);
      next();
    } catch (error) { next(error); }
  };
}
