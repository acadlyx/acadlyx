# ACADLYX API, Data Fetching and Backend Reliability Audit — Milestone 4

Date: 2026-10-09  
Repository: acadlyx/acadlyx  
Working branch: stabilization-platform-2026-10-09  
Protected base: production-upgrade-2026-09-20  
Scope: source-level reliability review and one focused cache-correctness fix. No production deployment, base-branch write, database mutation, authenticated runtime call or secret access was performed.

## Executive status

**Overall: PARTIALLY VERIFIED; runtime/build verification BLOCKED.** One API cache race was confirmed from source and fixed. No live endpoint failure was reproduced because this environment has no ACADLYX checkout, test database, credentials, running backend or browser runner. Reported generic symptoms such as 500, malformed authorization, stale metrics and indefinite loading are not recorded as reproduced defects without request/response evidence.

The remote GitHub connector allowed source retrieval and commits on the working branch. It does not provide an executable local checkout for npm/Prisma/browser commands. Therefore no command below is represented as passing unless actually executed.

## Baseline and prior milestone evidence

- Milestones 1–3 were source changes and audit reports on the working branch; their build/runtime checks were not executed in this environment.
- Milestone 3 added a check binding protected access JWTs to a live refresh-token record and authored refresh-session unit tests. Those tests remain unexecuted; do not treat the session patch as runtime verified.
- The package manifests are separate: frontend uses Next.js 15.5.25 and declares Node 24.x; backend uses Express 4 and Prisma 5 and declares Node 20.x.
- No test database, authenticated test accounts, API base URL suitable for a controlled test, or browser runtime was available in this execution context. No secrets were requested or printed.
- Existing conventions observed: JSON envelope with success/data for successful API calls; failures generally use success:false and error.message/code/requestId; authenticated UI requests use auth.ts helpers; backend request IDs are attached by requestContext.ts; errorHandler.ts returns safe generic messages for unexpected production errors.
- Current endpoint failures: **none reproduced**. This means environment-blocked, not that endpoints are known-good.

## Status definitions

- **FIXED** — source changed for a confirmed defect; execution may remain pending.
- **VERIFIED** — relevant behavior executed and passed.
- **PARTIALLY VERIFIED** — source or a subset inspected, but required runtime evidence is missing.
- **UNVERIFIED** — insufficient evidence to determine correctness.
- **BLOCKED** — missing runtime, checkout, database, credentials, or browser prevents verification.

## Confirmed finding M4-001 — invalidation did not invalidate in-flight GET deduplication

**Status: FIXED in source; PARTIALLY VERIFIED by inspection; runtime regression test UNVERIFIED. Severity: Medium (potential stale reads after mutations).**

### Evidence and root cause

In frontend/src/lib/api.ts, GET responses are cached briefly and identical in-flight GETs are deduplicated. Successful mutations call invalidateApiCache(). Before this fix, invalidation cleared completed cached responses but left pending GET promises in getInflight. A GET issued after a mutation could therefore join an older request and receive its pre-mutation response. In addition, an older request's finally handler unconditionally deleted the in-flight map key; after introducing in-flight invalidation, that could erase a newer request's deduplication entry for the same key.

### Fix

- invalidateApiCache() now removes matching entries from both the completed response cache and the in-flight deduplication map.
- A request already underway may still complete for its original caller, but later callers no longer reuse it after invalidation.
- The finally handler removes a key only when that key still points to the same promise, so an older request cannot delete a newer replacement request.
- Existing cache-generation protection continues to prevent a pre-invalidation response from being stored as a fresh cache entry.

### Changed file

- frontend/src/lib/api.ts

### Verification limitation

This was a source-traced race; it was not reproduced against a running browser/API and no frontend test runner is configured in the frontend package manifest. No performance claim is made. A deterministic test with deferred fetch promises should be added when the frontend test harness is available.

## API and request-client inventory

| Path | Current contract observed | Reliability status |
|---|---|---|
| frontend/src/lib/auth.ts — authedFetch | Uses configured apiUrl, attaches current tab's bearer token, refreshes once on 401, parses error message, applies timeout, and deduplicates eligible GETs within authCacheScope | PARTIALLY VERIFIED; no runtime test |
| frontend/src/lib/auth.ts — authedBlobFetch/authedDownload | Authenticated file requests with refresh handling; errors parsed or summarized | PARTIALLY VERIFIED; download retry and filename/file-type behavior not exercised |
| frontend/src/lib/api.ts — apiFetch | Configured API URL, timeout, JSON error parsing, request ID extraction, brief GET cache/deduplication, idempotency key on mutations, mutation cache invalidation | FIXED for in-flight invalidation race; callers/correct auth usage not exhaustively enumerated |
| frontend/src/lib/httpShared.ts | Shared response envelope/page metadata and query-string builder | PARTIALLY VERIFIED; no contract tests run |
| frontend/src/lib/dataTransferApi.ts | Import preview/commit/job polling use authedFetch; exports use authedBlobFetch; checks empty export and expected MIME type | PARTIALLY VERIFIED; job failure/polling and real export not exercised |
| Domain clients: academicsApi, admissionsApi, examinationsApi, financeApi, libraryApi, studentApi, parentApi, placement-related clients, hrApi, lmsApi, etc. | Typed domain functions primarily use authedFetch and shared query/envelope helpers in inspected examples | PARTIALLY VERIFIED; each endpoint and caller not fully traced |
| frontend/src/app/login/page.tsx | Direct fetch for public recovery-institution discovery; public login/recovery flows may use direct fetch | PARTIALLY VERIFIED; public calls must remain unauthenticated where designed |
| frontend/src/lib/auth.ts login/logout/refresh | Direct calls are part of auth lifecycle and use configured apiUrl | PARTIALLY VERIFIED; full lifecycle integration not run |
| backend/src/app.ts | Express route registration, middleware and global error handler | PARTIALLY VERIFIED by source only |
| backend/src/middleware/requestContext.ts | Adds safe request ID to response and request context | PARTIALLY VERIFIED; correlation propagation not exercised |
| backend/src/middleware/errorHandler.ts | Maps operational AppError, common Prisma errors, malformed JSON and upload failures; hides unexpected details in production | PARTIALLY VERIFIED; no simulated backend/DB failures |
| backend/src/middleware/notFound.ts | Returns JSON 404 envelope for unmatched routes | PARTIALLY VERIFIED; response lacks an explicit error code, but this alone has not been shown to cause a user-visible failure |
| Backend route/controller/service/Prisma paths | Large modular route surface across academics, admissions, attendance, exams, fees, library, placement, HR, CMS, exports and more | UNVERIFIED endpoint-by-endpoint |

### Shared API client contract

- API URLs should be generated through apiUrl() from the configured API base and API version.
- Authenticated data requests should use auth.ts helpers, except public auth/bootstrap flows and documented server-to-server mechanisms.
- Authorization headers must only be attached to the configured ACADLYX API origin. The inspected helpers derive URLs through apiUrl(path), but a complete raw-fetch and URL-origin scan remains UNVERIFIED.
- GET deduplication must be scoped to the current auth context and must not survive mutations that can change returned data.
- Mutations must not be automatically retried after uncertain completion unless idempotency behavior is supported end-to-end. The clients attach idempotency keys in relevant paths, but server-side persistence/replay coverage was not fully verified.
- Errors must preserve status and safe request ID context; an error must not be represented as an empty successful data set.

## Critical module request-path map (representative, not exhaustive)

| Workflow | Page/component → client | API/service/data path | Status |
|---|---|---|---|
| Authentication/session | Login, protected route boundary → auth.ts | /auth login, me, refresh, logout; auth routes/service; Prisma user and refresh-token records | PARTIALLY VERIFIED source; runtime BLOCKED |
| Student dashboard/self-service | Student workspace → studentApi.ts | /students/me/dashboard, /students/me/timetable → student routes/services → scoped student/enrollment/course records | UNVERIFIED runtime/scope tests |
| Student administration | Admin/Student Management → studentApi.ts and auth.ts | /students list/detail/create/update/status → student routes/controllers/services → Prisma users/profiles/enrollments | UNVERIFIED runtime; tenant and role-scope tests blocked |
| Finance | Accounts FinancePage → financeApi.ts; legacy ERP uses ERP client | /finance and /erp/fee-structures, invoice/payment workflows → permission/feature middleware → finance/fee services and canonical ledger/invoice/payment records | PARTIALLY VERIFIED permission source in Milestone 1; live workflow BLOCKED |
| Library | Library workspace → libraryApi.ts | /library summary/books/loans/returns/fines → library routes/services → copy/loan/fine and canonical financial obligation records | UNVERIFIED live request and downstream ledger propagation |
| Import/export | Data transfer UI → dataTransferApi.ts | /imports preview/commit/jobs and /exports → auth, permission and entitlement middleware → import/export service and scoped records | PARTIALLY VERIFIED client source; runtime BLOCKED |
| Examinations/admit cards/results | Examination/student pages → examinationsApi.ts and related clients | Exam sessions, eligibility, registration, admit card, marks, verification and results routes/services → Prisma examination records and document generation | UNVERIFIED runtime |
| Admissions/enrollment | Admissions UI → admissionsApi.ts / enrollmentRequestApi.ts | Admissions and enrollment routes/services → applicant, student, enrollment and academic structure | UNVERIFIED runtime |
| Attendance/timetable/LMS | Role workspaces → attendanceReportApi.ts, timetableApi.ts, lmsApi.ts and academic clients | Feature/permission-protected routes → course offering, class, attendance, LMS data | UNVERIFIED runtime |
| Placement | Placement workspace → domain client(s) | Company/opening/drive/application/offer endpoints → placement service and scoped student/company records | UNVERIFIED runtime |
| HR/leave | HR workspace → hrApi.ts / leaveApi.ts | HR/leave endpoints → employee, leave and approval services | UNVERIFIED runtime |
| CMS/site content | CMS page → auth.ts in inspected page | /site-content GET/PUT → CMS routes/service and tenant content | PARTIALLY VERIFIED client source; API execution blocked |
| Dashboards/analytics | Role-specific dashboards and dashboard clients | Dashboard metrics/aggregates → route/controller/service/Prisma queries | UNVERIFIED freshness, row-level scope and performance |
| Documents/downloads | Export and document clients | Export routes, PDF/ZIP generation, file storage and download response | UNVERIFIED ownership, MIME, size, timeout and failure behavior |
| Background processing | Import-job polling and backend worker/startup paths | Job creation/status/worker and domain-event outbox | UNVERIFIED worker availability, retries and idempotency |

## Backend error handling review

- **PARTIALLY VERIFIED:** requestContext.ts assigns an X-Request-ID and stores it in response locals.
- **PARTIALLY VERIFIED:** errorHandler.ts maps known Prisma constraint/not-found cases, malformed JSON and Multer errors to non-500 statuses; unexpected production failures return a generic internal-server-error message.
- **PARTIALLY VERIFIED:** frontend apiFetch parses response error fields and uses body/header request ID; authedFetch parses the server error message but does not currently expose request ID on HttpRequestError.
- **UNVERIFIED:** actual status-code behavior for invalid input, auth, permission, missing relation, unique conflicts, DB outages, timeout, file generation and external integration failures.
- **UNVERIFIED:** full route/controller scan for swallowed errors, empty-array fallbacks, invalid date/number coercions and unbounded Prisma queries.
- **No confirmed endpoint failure** was reproduced in this environment; no error was suppressed or converted to fake success.

## Loading, empty-state, cache and cross-module behavior

- **FIXED in source:** pre-mutation in-flight GETs are no longer reusable after apiFetch cache invalidation.
- **UNVERIFIED:** all data pages correctly distinguish initial loading, empty results, recoverable error, authentication-required, access-denied and technical failure.
- **UNVERIFIED:** component cancellation/unmount handling and stale response protection across every search/filter/pagination hook.
- **UNVERIFIED:** all mutations invalidate the correct dependent caches and update finance/library/examination/placement dashboards.
- **UNVERIFIED:** finance/library canonical obligation idempotency and student Accounts propagation in a live DB.
- **UNVERIFIED:** examination registration/admit-card/result state transitions and duplicate prevention.
- **UNVERIFIED:** student lifecycle propagation from admissions to enrollment, academics, exams and placement eligibility.
- **UNVERIFIED:** worker startup, job retries, outbox delivery and job-status polling against actual worker infrastructure.

## Performance

No runtime latency or query-count measurements were available. No claims of speedup are made.

| Metric | Before | After | Status |
|---|---|---|---|
| Endpoint latency / p95 | Not measured | Not measured | BLOCKED |
| Duplicate GET count | Not measured | Not measured | BLOCKED |
| Prisma query count / N+1 | Not measured | Not measured | BLOCKED |
| Dashboard render/fetch waterfall | Not measured | Not measured | BLOCKED |
| DB pool pressure | Not measured | Not measured | BLOCKED |

The cache correction is a correctness fix, not a measured performance optimization.

## Exact verification ledger

| Check | Command/evidence | Result |
|---|---|---|
| Read branch tree and critical source files | GitHub tree and file reads at stabilization-platform-2026-10-09 | PASS for source retrieval only |
| API cache invalidation fix | Reviewed changed invalidateApiCache and promise-finalizer source | PARTIALLY VERIFIED; no executed test |
| Frontend TypeScript | cd frontend && npm run typecheck | BLOCKED — no local checkout; not executed |
| Frontend lint | cd frontend && npm run lint | BLOCKED — not executed |
| Frontend source validation/build | cd frontend && npm run validate:source && npm run build | BLOCKED — not executed |
| Backend TypeScript/lint/tests | cd backend && npm run typecheck && npm run lint && npm test | BLOCKED — not executed |
| Prisma generation/validation | cd backend && npx prisma generate and npx prisma validate | BLOCKED — not executed |
| Authenticated API smoke tests | Isolated accounts and persisted test records | BLOCKED — no runtime/database/credentials |
| Cross-module integration tests | Finance/library/exam/admissions/placement workflows | BLOCKED — not executed |
| Browser loading/error/empty tests | Playwright or available browser test harness | BLOCKED — no browser runtime |
| Performance measurements | Network traces, request timing and query metrics | BLOCKED — no running app/telemetry |
| Final diff check | git diff --check and full local diff review | BLOCKED — no local checkout; remote file changes were selectively inspected |

## Remaining risks and required next work

1. Add a deterministic frontend test harness for the API client using deferred fetch promises. Test: GET starts; mutation succeeds and invalidates; second GET starts a new network request; older promise settles without deleting the newer map entry.
2. Execute frontend/backend typecheck, lint, build, tests and Prisma validation from a real checkout using each package's declared Node engine. Fix any failures before considering the source change merge-ready.
3. Complete the raw fetch/Axios and apiFetch call-site inventory; ensure protected requests use the authenticated helper and public auth/recovery endpoints remain intentionally public.
4. Exercise error handling with isolated tests for 400/401/403/404/409/413/429/500 and request-ID propagation; ensure HttpRequestError preserves request ID consistently if callers need support diagnostics.
5. Use authenticated test accounts and persisted fixtures to reproduce reported failures and record sanitized method/path/status/request ID/response.
6. Test all role workspaces for loading, empty, error, refresh, mutation and authorization behavior.
7. Run cross-tenant/campus/department and student/parent tests for list/detail/search/pagination/aggregations/exports/downloads.
8. Test finance/library/examination/admissions/placement canonical data propagation and duplicate mutation prevention.
9. Measure latency, duplicate requests, query counts and dashboard waterfall before making performance claims.
10. Re-run the complete audit against the final source after any fixes. Do not deploy during this milestone.

## Final milestone status

**PARTIALLY VERIFIED.** One source-confirmed API cache race is fixed. No live endpoint failures were reproduced; no build/test/runtime checks were executed. API, backend, role workspace, cross-module and performance acceptance criteria remain UNVERIFIED or BLOCKED until executable evidence is available.
