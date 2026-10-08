/**
 * ACADLYX — permission catalogue compatibility facade.
 *
 * The canonical permission catalogue lives in ./rbac. Keep this module as a
 * compatibility import surface so older consumers cannot drift into a second
 * permission matrix.
 */
export { PERMISSIONS } from "./rbac";
export type { PermissionKey } from "./rbac";
