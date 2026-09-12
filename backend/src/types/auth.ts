/**
 * Shape of the authenticated context attached to every request
 * once it has passed through the `authenticate` middleware.
 * institutionId/roles/permissions come from the verified JWT —
 * never from anything the client sends directly.
 */
export interface AuthenticatedUser {
  id: string;
  institutionId: string | null;
  email: string;
  roles: string[];
  permissions: string[];
}

/** Claims embedded in a signed access token. */
export interface AccessTokenPayload {
  sub: string; // userId
  institutionId: string | null;
  email: string;
  roles: string[];
  permissions: string[];
}
