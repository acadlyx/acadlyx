/**
 * Shape of the authenticated context attached to every request
 * once it has passed through the `authenticate` middleware.
 * institutionId/roles/permissions are resolved from current database
 * state after the verified JWT identifies the authenticated subject —
 * never from anything the client sends directly.
 */
export interface AuthenticatedUser {
  id: string;
  institutionId: string | null;
  email: string;
  idNumber?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  permissions: string[];
}

/** Claims embedded in a signed access token. Runtime auth does not trust
 * these tenant/RBAC claims after token verification. */
export interface AccessTokenPayload {
  sub: string; // userId
  institutionId: string | null;
  email: string;
  roles: string[];
  permissions: string[];
}
