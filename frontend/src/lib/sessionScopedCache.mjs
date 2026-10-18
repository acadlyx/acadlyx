/**
 * Pure session-bound cache helpers shared by workspace cache logic and tests.
 * Session scopes are local monotonic identifiers; raw access tokens are never
 * part of cache keys or retained as cache metadata.
 */
export function sessionScopedCacheKey(sessionScope, params) {
  const selectorKey = Object.entries(params)
    .filter(([, value]) => Boolean(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `${sessionScope}:${selectorKey}`;
}

export function isSessionCurrent(requestedScope, currentScope) {
  return requestedScope === currentScope;
}

export function canApplySessionResponse(
  requestedScope,
  currentScope,
  requestedGeneration,
  currentGeneration,
) {
  return isSessionCurrent(requestedScope, currentScope)
    && requestedGeneration === currentGeneration;
}

/**
 * Stable signature of authority-relevant /auth/me fields. Order differences
 * in role/permission arrays do not represent an authority change.
 */
export function authorizationContextKey(user) {
  if (!user) return null;
  return JSON.stringify({
    id: user.id,
    institutionId: user.institutionId,
    roles: [...user.roles].sort(),
    permissions: [...user.permissions].sort(),
    tenantFeatures: [...(user.tenantFeatures ?? [])].sort(),
  });
}

export function isWorkspaceResultCurrent(resultRequestKey, currentRequestKey) {
  return resultRequestKey === currentRequestKey;
}
