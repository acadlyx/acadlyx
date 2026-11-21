# ACADLYX Complete System Audit — Phase 1 Baseline

**Repository:** `acadlyx/acadlyx`  
**Audit branch:** `native-mobile-parity-2026-10-17`  
**Baseline commit inspected:** `b050fcb53e96556a377b3aae24ba7b928f965274`  
**Production branch:** `production-upgrade-2026-09-20` — read-only; not modified  
**PR:** #77 remains an open draft; no merge, rebase, deployment, or production mutation was performed.

## Phase status

| Phase | Status | Evidence |
|---|---|---|
| 1 — Complete application audit | **Baseline established; deep verification still in progress** | Repository inventory, route/module source scan, shared auth/scope/finance/storage/mobile/database/infrastructure source inspection, issue register below |
| 2 — Fixes and implementation | **Not started at baseline** | Fixes are to be applied on the implementation branch after this baseline |
| 3 — Final independent audit | **Pending** | Must inspect final source and CI/test/deployment evidence independently |

This report is not a declaration of production readiness. Static source inspection cannot prove live database integrity, external provider configuration, or full browser behaviour. Items requiring those capabilities are explicitly marked unverified or blocked.

## Repository inventory

Counts below are calculated from the recursive Git tree at the baseline commit, not copied from repository status reports.

| Area | Inventory |
|---|---:|
| Total repository files | 1,034 |
| Frontend App Router page files | 303 |
| Frontend shared components | 93 |
| Frontend library modules | 49 |
| Frontend hooks | 3 |
| Backend route modules | 57 |
| Backend controllers | 33 |
| Backend service modules | 83 |
| Backend validators | 35 |
| Backend middleware files | 10 |
| Prisma models | 107 |
| Prisma SQL migrations | 72 |
| Backend tests | 51 |
| All test/spec files (backend, frontend E2E, mobile) | 55 |
| Mobile app files | 60 |
| Mobile source files | 48 |
| GitHub Actions workflows | 5 |

The 303 frontend routes span public pages, authentication, Super Admin, Institution Admin, Chairman, Management, Director, Dean, Registrar, HOD, Faculty, Accounts, HR, Admissions, Examination, Librarian, Placement, IT, CMS, Student, Parent, Club President, and shared ERP routes. Route wrappers that intentionally reuse canonical screens or redirect to a canonical route are not classified as duplicates merely because they are short.

### Source areas inspected

- Frontend: `frontend/src/app/**`, shared `components`, `lib`, hooks, navigation, auth boundary, dashboard shell, role/tenant route policy, Finance pages/APIs, Student pages/APIs, public-site shell, file-storage client, source-validation and access-policy scripts.
- Backend: all 57 route-module declarations were inventoried; controller, service, validator, middleware, configuration, authentication, authorization, finance/billing, payment, file-storage, background-job, and app-mount source were inspected. All 83 service files were inventoried for exported methods, transaction use, raw SQL use, tenant/scope references, and authorization patterns; high-risk finance and access-scope paths received deeper source inspection.
- Database: `backend/prisma/schema.prisma`, migration chronology and SQL for same-timestamp examination, campus-access, finance, library-finance, and job migrations.
- Mobile: API client, SecureStore token lifecycle, auth provider, root navigator, role dashboard/navigation, workspace context, screen catalogue, and mobile contract test.
- Infrastructure: `render.yaml`, backend/frontend/mobile package scripts, and the five CI workflow definitions.

**Coverage limitation:** 303 route files were structurally scanned, and route handlers/components were inspected by shared workflows and risk areas. This does not amount to a live click-through of every data-dependent control on every role, nor to live production API/database testing. Dynamic workflows remain UNVERIFIED until Phase 3 browser/integration evidence is available.

## Phase 1 issue register

Severity definitions: **Critical** = immediate compromise or irreversible data-integrity threat; **High** = exploitable authorization/session or material workflow risk; **Medium** = significant correctness, compatibility or security gap; **Low** = maintainability risk with limited direct impact.

| ID | Severity | Module / feature | Source paths | Root cause and affected workflow | Required correction | Dependencies | Baseline status |
|---|---|---|---|---|---|---|---|
| AUTH-01 | **High** | Native mobile session restore / refresh | `mobile/src/api/client.ts`; `mobile/src/auth/AuthProvider.tsx`; `mobile/src/navigation/RootNavigator.tsx` | Refresh catches every exception and clears both SecureStore tokens. Startup `/auth/me` catch also clears tokens for all errors. A transient offline/timeout/5xx event therefore logs out a user whose refresh token may still be valid. | Separate invalid/expired credentials from network/timeout/server-unavailable outcomes. Clear credentials only for definitive invalid-session responses. Preserve tokens and offer a retry/unavailable state for transient failures. Re-audit JSON and PDF refresh paths. | Mobile auth UI and contract tests. | **Confirmed — Phase 2 fix required** |
| BILL-01 | **High** | Legacy billing workspace authorization | `backend/src/services/feeBilling.service.ts`; `backend/src/routes/feeBilling.routes.ts`; `backend/src/config/rbac.ts`; `backend/src/services/accessScope.service.ts` | `assertCanManageFees` accepts any role in `actor.roles` and falls back to a union permission. That does not respect the active/effective workspace role. A multi-role account can inherit a secondary role's fee-management permission while operating in another workspace. | Gate service actions by the effective workspace role and the specific action permission, not the union of all role bindings. Add targeted multi-role adversarial tests. | Canonical RBAC and active workspace resolver. | **Confirmed — Phase 2 fix required** |
| BILL-02 | **High** | Billing resource-level campus/department isolation | `backend/src/services/feeBilling.service.ts`; `backend/src/services/accessScope.service.ts`; `backend/src/services/workflowAuthority.service.ts` | Several legacy billing mutations/list queries operate on tenant-only invoice/refund/concession identifiers after general permission checks. The service has a student-scope helper but it is not consistently applied to each affected record. This can expose or mutate a same-institution student record outside an active Director/Dean/HOD scope when the caller has the route permission. | Resolve the related student for each invoice/refund/concession operation and enforce `assertCanViewStudent` or an equivalent SQL scope predicate. Scope list/count queries consistently. Deny tenant-wide late-fee application and reconciliation to campus-scoped roles unless a safe scoped implementation exists. | Student/campus/dept relationships and workflow authority policy. | **Confirmed concern; per-operation matrix to be re-audited during Phase 2** |
| BILL-03 | **Medium** | Duplicate money workflow/API families | `backend/src/routes/finance.routes.ts`; `backend/src/routes/feeBilling.routes.ts`; `backend/src/routes/erp.routes.ts`; `backend/src/services/finance.service.ts`; `backend/src/services/feeBilling.service.ts`; `backend/src/services/erp.service.ts`; `frontend/src/lib/financeApi.ts`; `frontend/src/lib/billingApi.ts`; `frontend/src/lib/erpApi.ts` | Multiple route/service families can create, read, cancel, or settle records against overlapping fee tables. The newer Finance service uses an effective-role scope resolver and stable payment idempotency; the legacy Billing service has separate raw-SQL implementations and weaker checks. | Establish one canonical ledger/mutation path; preserve legacy endpoints through safe adapters where they are still consumed. Do not drop endpoints or data until consumer and migration compatibility is proved. | Frontend consumer inventory, API compatibility, existing fee tables and idempotency records. | **Confirmed architectural duplication — Phase 2 consolidation/hardening required** |
| FILE-01 | **Medium** | Upload content validation | `backend/src/routes/fileStorage.routes.ts`; `backend/src/controllers/fileStorage.controller.ts`; `backend/src/services/fileStorage.service.ts` | Upload validation relies on the request-provided MIME type and module allowlist; the upload path does not verify file signatures/content for ordinary uploads. A spoofed content type may pass the allowlist. | Add server-side signature/content validation for supported types and safe extension/name handling without breaking existing legitimate uploads. Keep storage provider and tenant folder policy. | Module-specific allowed formats and provider compatibility. | **Confirmed source gap — Phase 2 fix required** |
| FILE-02 | **Medium** | Staff file upload | `backend/src/controllers/fileStorage.controller.ts`; `backend/src/services/fileStorage.service.ts` | The controller has a `staff` permission mapping, but the storage service MIME allowlist does not define a `staff` module. The exposed module therefore fails as unsupported after permission succeeds. | Align the canonical module catalogue, permission map and MIME policy; verify every client upload module has a matching server allowlist. | File-storage client consumers and module ownership rules. | **Confirmed source mismatch — Phase 2 fix required** |
| AUTH-02 | **Medium** | Brute-force and reset-token configuration | `backend/src/services/accountSecurity.service.ts`; `backend/src/config/env.ts` | `AUTH_MAX_FAILED_ATTEMPTS`, `AUTH_LOCKOUT_MINUTES` and `AUTH_RESET_TTL_MINUTES` are converted directly with `Number()` rather than the validated configuration helper. Invalid environment values can produce NaN thresholds/expiry dates and weaken lockout or reset behaviour. | Centralize validated positive bounded values in `env`; fail production startup for invalid values or apply an explicit safe default. | Existing deployment variable names and configuration tests. | **Confirmed source defect — Phase 2 fix required** |
| DB-01 | **Medium** | Examination legacy projection migration duplication | `backend/prisma/migrations/20261001000000_exam_dashboard_projection/migration.sql`; `backend/prisma/migrations/20261001000000_examination_legacy_projection/migration.sql` | Both migrations share a timestamp and define the same trigger name. The second drops/replaces the trigger with a second function, leaving the first function unused in the database. Four same-timestamp migration pairs exist overall. | Preserve deployed migration history. Add a forward-only cleanup migration for the unused function after confirming no trigger references and verify migration replay on clean and populated fixtures. Review the other same-timestamp pairs separately. | Prisma migration history and live database migration ledger. | **Confirmed duplicate definitions; live DB state UNVERIFIED** |
| INFRA-01 | **Medium** | Deployment and provider readiness | `render.yaml`; `backend/src/config/env.ts`; payment/storage/email providers | The Render blueprint sets payment provider to manual; email provider defaults disabled; Cloudinary credentials are external secrets. Online payment, email delivery, and real provider upload cannot be claimed functional without real credentials and provider callbacks. Render services are wired to the protected production branch, not this implementation branch. | Record explicit provider configuration/health checks; verify credential presence, webhooks, delivery and provider failure/retry behaviour in the target environment. | Render/Vercel/Supabase/Cloudinary/email/payment-provider access and authorized production test data. | **BLOCKED / UNVERIFIED externally** |
| INFRA-02 | **Medium** | Multi-instance rate limiting | `backend/src/middleware/rateLimit.ts`; `backend/src/app.ts`; `render.yaml` | The inspected rate limiter uses the default in-process store. Rate limits are per process and will not be shared if the API is horizontally scaled. | Select a shared store or enforce documented single-instance constraints; test multi-instance behaviour before scaling. | Shared Redis/store infrastructure and production topology. | **Source-confirmed scaling limitation; target topology UNVERIFIED** |

## Duplication inventory

1. **Finance/Billing:** overlapping `/finance/*`, `/billing/*`, and legacy `/erp/*` invoice/payment routes use common financial tables. Preserve compatibility, but converge mutation ownership on the scoped Finance ledger.
2. **Examinations:** old ERP `exams` is a compatibility/read projection of `exam_sessions`/`exam_schedules`; this is intentional compatibility, not an independently removable module. The two same-timestamp projection migrations contain redundant trigger-function definitions.
3. **LMS:** `lms.routes.ts` and `lmsProduction.routes.ts` share the `/lms` mount but expose separate endpoint families. The mount alone is not evidence of a duplicate endpoint.
4. **Frontend routes:** several short role routes reuse common components or redirect to canonical pages. These are retained until equivalent behaviour, links and deep-link compatibility are proved.

## External and runtime verification blockers

- The audit branch has no live database credentials or target production data attached to this GitHub source-inspection session. Migration drift, existing orphan rows, referential integrity on the deployed DB, backup restoration and transaction behaviour against production data remain **UNVERIFIED**.
- Render/Vercel deployment and provider credentials are not inspected here. No deployment was triggered. Online payment, live email, real file upload and delivery, webhook signature end-to-end processing remain **BLOCKED / UNVERIFIED** pending provider access.
- The current branch/PR has no combined commit status checks reported by GitHub at baseline. This is not equivalent to a passing build. Build, typecheck, lint, integration and browser results remain **UNVERIFIED** until CI evidence is obtained.
- A full click-through of all 303 routes under all 20 role contexts requires authenticated institution fixtures and browser execution. Static route/component scan does not certify every dynamic interactive element.

## Phase 1 exit criteria

Phase 1 is not declared complete until the remaining dynamic route/control coverage, controller/validator contract checks, full migration dependency review, and all high-risk source findings have a documented disposition. Phase 2 fixes must reference issue IDs above and add regression coverage. Phase 3 must rebuild the inventory from final source rather than reusing this baseline.
