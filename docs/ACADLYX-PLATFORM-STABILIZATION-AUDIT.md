# ACADLYX Platform Stabilization Audit

Audit date: 2026-10-09. Base: `production-upgrade-2026-09-20`. Working branch: `stabilization-platform-2026-10-09`. Scope of this milestone: Finance authorization contract only. Production was not modified or deployed.

## Status definitions

- FIXED (source): code changed; runtime behavior still needs execution where noted.
- VERIFIED: relevant behavior executed successfully with evidence.
- PARTIALLY VERIFIED: source inspection or only some layers checked.
- UNVERIFIED: adequate runtime/test evidence absent.
- BLOCKED: unavailable environment, credentials, service or fixture prevents verification.

## Finding 1 — Finance UI/backend permission mismatch (FIXED IN SOURCE; runtime PARTIALLY VERIFIED)

### Confirmed source-level cause

The previous `FeesTab` had a single page-wide gate requiring either `fees.manage` or `fees.pay`. That gate hid all fee structure actions even where the user had the dedicated `fees.structure.read` or `fees.structure.manage` permission. It also treated the legacy `fees.pay` permission as a proxy for payment recording, while the payment route requires `fees.payment.record`.

Separately, the service's fee-structure write helper accepted legacy `fees.manage` as an alternative to `fees.structure.manage`, despite the route middleware requiring the dedicated structure-management permission. Read service guards also accepted broad/legacy permissions that the route did not accept. The route middleware remained the external API gate, but these inconsistent checks made the authorization contract ambiguous.

The user-visible UI denial reproduced from source is the `Access restricted` branch returned when the old page-wide `canManage` condition was false. A live HTTP 403/entitlement denial was not reproduced in a running environment, so no claim is made that this was the only cause of the reported Finance errors.

### Action-to-permission contract

All names below are existing permission strings observed in the repository; no new role permission was invented.

| Finance action | Frontend visibility/enabled condition | Backend route requirement | Entitlement / additional guard |
|---|---|---|---|
| Read fee heads | `fees.structure.read` | `fees.structure.read` | `requireFeature("fees")`; institution-bound records |
| Create/update/deactivate fee heads | `fees.structure.manage` | `fees.structure.manage` | `requireFeature("fees")`; service validates institution references |
| Read fee structures | `fees.structure.read` | `fees.structure.read` | `requireFeature("fees")`; service scopes by institution |
| Create/update fee structures | `fees.structure.manage` | `fees.structure.manage` | `requireFeature("fees")`; academic year/program/semester/fee-head references checked against institution |
| Approve a draft structure | `fees.structure.approve` | `fees.structure.approve` | `requireFeature("fees")`; backend remains authoritative |
| Assign a fee structure | Existing UI currently has no assignment control in this tab | `fees.assign` | `requireFeature("fees")`; assignment validates student/institution context |
| Create/update invoice | `fees.manage` | `fees.manage` | Invoice route currently uses `requireFeature("fees")`; service checks remain authoritative |
| Read invoice | No invoice-list UI action is implemented in this tab | `fees.read` | Invoice route uses the repository's existing invoice authorization |
| Record payment | `fees.payment.record` | `fees.payment.record` | Current payment route uses `requireFeature("payments")`, not the Fees entitlement; this is preserved rather than silently changed. Product policy must decide whether payments entitlement is intentionally independent. |

Waiver, adjustment, ledger, export and reporting permissions were not mapped to UI controls in this specific `/erp` Fees tab because corresponding actions are not present in the inspected component. Their full repository-wide mapping remains outside this milestone and must not be inferred from the table.

### Changes applied

- `frontend/src/app/erp/page.tsx`: replaced the single page-wide `fees.manage` / `fees.pay` gate with operation-specific visibility for structure read, structure management, approval, invoice creation and payment recording. Read-only users can see structures without seeing mutation forms. Backend authorization is unchanged as the security boundary.
- `backend/src/services/feeAuthorization.ts`: introduced a typed canonical action-to-existing-permission map.
- `backend/src/services/feeStructure.service.ts`: structure-management and structure-read checks now use the canonical permission helper; legacy `fees.manage` no longer grants fee-structure mutation/read service access by itself.
- `backend/src/__tests__/feeAuthorization.test.ts`: added regression tests for mapping, read-only denials, operation-specific mutations and rejection of legacy `fees.pay` as a payment-recording permission.

No role mappings were broadened. No database migration was introduced. No production branch write or deployment was performed.

## Finding 2 — Entitlement and permission are separate (PARTIALLY VERIFIED)

The inspected fee-head and fee-structure routes require `requireFeature("fees")` independently of action permissions. The payment route currently requires `requireFeature("payments")` plus `fees.payment.record`. Entitlement behavior has not been exercised against a running API, and the product-level relationship between Fees and Payments entitlements remains unverified.

## Finding 3 — Tenant and academic scope (PARTIALLY VERIFIED)

Source inspection observed institution-bound academic-year/program/semester/fee-head checks and institution predicates in fee-structure queries. This milestone did not execute cross-institution requests or prove campus/department scope for all Finance records. Cross-tenant isolation remains unverified at runtime.

## Files changed in this milestone

- `frontend/src/app/erp/page.tsx`
- `backend/src/services/feeAuthorization.ts`
- `backend/src/services/feeStructure.service.ts`
- `backend/src/__tests__/feeAuthorization.test.ts`
- `docs/ACADLYX-PLATFORM-STABILIZATION-AUDIT.md`

## Verification log

| Check | Exact command / evidence | Result |
|---|---|---|
| Branch isolation | GitHub source reads and commits were explicitly targeted at `stabilization-platform-2026-10-09` | PARTIALLY VERIFIED; production branch was not targeted |
| Frontend action guards | Inspected final `frontend/src/app/erp/page.tsx` after update | PARTIALLY VERIFIED by source; no TS/JSX compiler run |
| Backend route permissions | Inspected `backend/src/routes/erp.routes.ts` for fee-head, structure, invoice and payment routes | PARTIALLY VERIFIED by source |
| Service permission guards | Inspected final `backend/src/services/feeStructure.service.ts`; canonical helper is used for structure read/manage checks | PARTIALLY VERIFIED by source |
| Regression test source | Added `backend/src/__tests__/feeAuthorization.test.ts`; package script is `npm test` using `tsx --test src/__tests__/*.test.ts` | ADDED; NOT EXECUTED |
| Backend typecheck | `npm run typecheck` (not executed; no checkout/runtime shell available through repository connector) | UNVERIFIED |
| Backend tests | `npm test` (not executed) | UNVERIFIED |
| Frontend typecheck | `npm run typecheck` (not executed) | UNVERIFIED |
| Frontend lint | `npm run lint` (not executed; repo script is `next lint`) | UNVERIFIED |
| Frontend production build | `npm run build` (not executed) | UNVERIFIED |
| Prisma validation/migration status | Not run; no schema migration was added | UNVERIFIED |
| Entitlement-denial API test | Not run against an authenticated runtime | UNVERIFIED |
| Cross-institution API regression | Not run against seeded institutions | UNVERIFIED |
| Browser/role smoke tests | Not run | UNVERIFIED |
| Production smoke test/deployment | Not performed by design | NOT RUN |

## Remaining risks and required follow-up

1. Execute the added test and TypeScript/build checks from a full checkout, fix any failures, and rerun the affected suite.
2. Add authenticated route integration tests proving each route allows/denies the relevant permission and returns denial when the required entitlement is absent.
3. Add two-institution fixtures to prove no cross-tenant fee head, structure, invoice or payment access.
4. Decide explicitly whether the payment-record route should require `payments`, `fees`, or both; this change intentionally preserves current backend behavior.
5. Verify supported Accounts, Admin, Registrar and Management role mappings against policy without granting blanket Finance permissions.
6. Audit waiver, adjustment, ledger, export, reporting, cache invalidation and role-seed behavior in a separate repository-wide pass.

## Final status

**MILESTONE 1: PARTIALLY VERIFIED — SOURCE FIX AND REGRESSION TESTS ADDED; EXECUTION PENDING.**

The acceptance criteria requiring executed regression tests and runtime authorization/entitlement proof are not yet met. This is not a platform stabilization certificate.