export function sessionScopedCacheKey(
  sessionScope: number,
  params: Record<string, string | undefined>,
): string;

export function isSessionCurrent(
  requestedScope: number,
  currentScope: number,
): boolean;

export function canApplySessionResponse(
  requestedScope: number,
  currentScope: number,
  requestedGeneration: number,
  currentGeneration: number,
): boolean;

export type AuthorizationContext = {
  id: string;
  institutionId: string | null;
  roles: readonly string[];
  permissions: readonly string[];
  tenantFeatures?: readonly string[];
};

export function authorizationContextKey(
  user: AuthorizationContext | null,
): string | null;

export function isWorkspaceResultCurrent(
  resultRequestKey: string | undefined,
  currentRequestKey: string,
): boolean;
