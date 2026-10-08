# ACADLYX — Placement Authorization & Authentication Audit

Date: 2026-10-09
Branch: `production-upgrade-2026-09-20`

## Status legend

- **FIXED** — confirmed source defect corrected.
- **VERIFIED** — directly verified from repository/code or test evidence.
- **PARTIALLY VERIFIED** — the relevant path is implemented and source-audited, but complete live execution is not proven.
- **UNVERIFIED** — not proven against a live authenticated workflow.
- **BLOCKED** — verification requires unavailable browser/session/deployment access.

## 1. Confirmed root cause

**FIXED:** The active Placement Team workspace already used the authenticated client (`authedFetch`), but the shared `PlacementDashboard` component used the generic `apiFetch` client.

`apiFetch` does not attach an Authorization header. Protected Placement endpoints require authentication.

The affected component made these protected requests without credentials:

- `GET /placements/opportunities?activeOnly=false`
- `GET /placements/applications`
- `GET /placements/metrics`
- `POST /placements/opportunities`
- `POST /placements/applications/:id/status`

This directly explains the browser error:

`Missing or malformed Authorization header`

The backend authentication middleware correctly returns HTTP 401 for that condition. The issue was therefore a frontend client-selection defect, not a reason to weaken backend authentication.

## 2. Authentication architecture audit

### VERIFIED

The canonical authenticated request path is `frontend/src/lib/auth.ts::authedFetch`.

It:

1. Reads the current access token from the current browser session.
2. Sends `Authorization: Bearer <access-token>`.
3. Preserves caller-provided headers.
4. Adds idempotency keys to mutations.
5. On HTTP 401, performs the existing single-flight refresh flow.
6. Retries the request once with the refreshed access token.
7. Throws `AuthRequiredError` when authentication cannot be recovered.
8. Does not retry mutations indefinitely.

The Placement router uses:

`authenticate → requireFeature("placements") → authorize(permission) → service-level scope checks`.

The backend therefore remains the final authentication and authorization boundary.

## 3. Backend error handling

### VERIFIED

`backend/src/middleware/authenticate.ts` explicitly returns:

- 401 for missing/malformed Authorization headers.
- 401 for invalid/expired access tokens.
- 401 for missing/inactive users.
- 403 for invalid tenant/institution context and inactive/suspended tenant conditions.

The middleware does not convert unexpected exceptions into 401. Unexpected authentication verification failures return 503.

Placement authorization separately returns 403 when the authenticated user lacks the required permission.

No authentication bypass or JWT-validation weakening was introduced.

## 4. Placement authorization audit

### VERIFIED

Placement routes are protected by authentication and the `placements` feature entitlement.

Representative protected operations include:

- metrics
- opportunities
- companies
- company contacts
- openings
- drives
- drive eligibility
- applications
- interviews
- offers
- joining verification
- visits
- placement students
- placement tests
- placement profile
- skills/certifications/projects/resumes

Mutation endpoints use `placements.manage` or `placements.apply` as appropriate.

Services receive the authenticated actor and institution resolved by the backend. Client-supplied entity IDs are validated as UUIDs and are subsequently checked by service-level ownership/scope logic.

The previously identified Placement student scope hardening remains in force: Placement access to complete student records is relationship-qualified rather than an unrestricted institution-wide student read.

## 5. Files changed

### FIXED

`frontend/src/components/dashboard/PlacementDashboard.tsx`

Changed protected Placement requests from the unauthenticated generic `apiFetch` client to `authedFetch`.

The error handling was also changed to the authenticated client's `HttpRequestError` type.

No tokens are logged or persisted by this fix.

## 6. Other Placement frontend requests

### VERIFIED

The dedicated Placement Team workspace at:

`frontend/src/app/placements/page.tsx`

already uses `authedFetch` for metrics, companies, drives, applications, and mutations.

The Placement sub-pages use the dedicated authenticated architecture rather than adding a second token-storage system.

A repository search did not identify another Placement-specific raw `apiFetch` usage requiring migration after the fix.

## 7. Authentication regression posture

### VERIFIED

The backend already has the expected authentication distinctions:

| Scenario | Expected |
|---|---|
| Valid access token | Authenticated request proceeds to authorization |
| Missing Authorization header | 401 |
| Malformed Authorization header | 401 |
| Invalid/expired token | 401 |
| Authenticated but missing permission | 403 |
| Missing institution context | 403 |
| Disabled/inactive institution | 403 |
| Unexpected authentication verification failure | 503 |

The existing refresh mechanism is single-flight, preventing several concurrent 401s from starting independent refresh operations.

## 8. Tests and verification

### VERIFIED

Existing Placement RBAC regression test:

`backend/src/__tests__/placement-rbac.test.ts`

covers separation between Placement operational authority and scoped placement read access for institutional roles.

The source audit also verified the Placement router's authentication and permission chain.

### UNVERIFIED / BLOCKED

A live authenticated browser/API smoke test using a real Placement account could not be executed from the available repository tooling in this pass. Therefore the following are **not** claimed as passed:

- browser request-header inspection
- real Placement login → dashboard load
- real company creation
- real drive creation
- real student directory/profile access
- real interview/offer workflow
- real export workflow
- deployed frontend-to-backend smoke test after this commit

No token or credential was fabricated or exposed to compensate for this limitation.

## 9. Required final runtime verification

After deployment of the fix, verify with an actual Placement account:

1. Login.
2. Open Placement Command Center.
3. Confirm all protected GET requests carry an Authorization header without recording its value.
4. Confirm metrics, companies, drives, applications and students load.
5. Create/update one authorized test record if permitted.
6. Confirm an expired token follows the existing refresh flow.
7. Send a deliberately unauthenticated request and confirm 401.
8. Send an authenticated request without the required permission and confirm 403.
9. Attempt a cross-institution entity identifier and confirm denial.
10. Confirm no duplicate mutation occurs after an authentication refresh.

## 10. Final posture

**PARTIALLY VERIFIED.**

The concrete source-level root cause has been identified and fixed: a protected Placement workspace component was using an API client that intentionally did not attach credentials.

The backend authentication contract was already correct and remains strict. The dedicated Placement Team workspace already used the correct authenticated client.

The remaining acceptance blocker is fresh runtime verification with a real authenticated Placement session against the deployed final commit. No authentication or authorization weakening was used.
