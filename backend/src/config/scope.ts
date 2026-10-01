/**
 * Backwards-compatible scope helpers.
 *
 * Resource-level scope logic lives in accessScope.service.ts.  OBE and
 * other domain services may import these helpers from config/scope.ts so
 * scope rules have one implementation.
 */
export {
  INSTITUTION_WIDE_ROLES,
  isInstitutionWide,
  getManagedDepartmentIds,
} from "../services/accessScope.service";
