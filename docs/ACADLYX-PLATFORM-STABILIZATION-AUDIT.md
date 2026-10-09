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

Two related frontend contracts were inconsistent with backend authorization:

- The legacy `frontend/src/app/erp/page.tsx` used one page-wide gate requiring `fees.manage` or `fees.pay` for fee heads, structures, approval, invoice creation and payment recording. The backend uses operation-specific permissions for structures/approval and `fees.payment.record` for payment recording.
- The canonical Accounts workspace in `frontend/src/components/accounts/FinancePage.tsx` treated `fees.manage` or `fees.admin` as a wildcard granting every Finance UI action. Its navigation metadata also used granular read permissions such as `fees.invoice.read`, `fees.payment.read`, and `fees.refund.read`, while the actual Finance API read routes require `fees.read` (with documented alternatives for command center/audit). This could both show actions that the API rejects and hide views from users who have the actual route permission.
- The fee-structure service accepted `fees.manage` as a substitute for `fees.structure.manage` and broad permissions for read, although route middleware already enforced dedicated permissions.

The source-level UI denial is confirmed as a permission-contract inconsistency, but a live HTTP 403 or feature-entitlement denial was not reproduced. The displayed message may also arise from `requireFeature("fees")`; this remains a separate, unverified possible cause and must not be “fixed” by granting permissions.

### Action-to-permission contract

All names below are existing permission strings observed in the repository; no new role permission was invented.

| Finance action | Frontend visibility/enabled condition | Backend route requirement | Entitlement / additional guard |
|---|---|---|---|
| Read fee heads | `fees.structure.read` | `fees.structure.read` on ERP route | `requireFeature("fees")`; institution-bound records |
| Create/update/deactivate fee heads | `fees.structure.manage` | `fees.structure.manage` on ERP route | `requireFeature("fees")`; service validates institution references |
| Read fee structures | `fees.structure.read` | `fees.structure.read` on ERP route | `requireFeature("fees")`; service scopes by institution |
| Create/update fee structures | `fees.structure.manage` | `fees.structure.manage` on ERP route | `requireFeature("fees")`; academic year/program/semester/fee-head references checked against institution |
| Approve a draft structure | `fees.structure.approve` | `fees.structure.approve` on ERP route | `requireFeature("fees")`; backend remains authoritative |
| Assign a fee structure | `fees.assign` | `fees.assign` on ERP route | `requireFeature("fees")`; assignment validates student/institution context |
| Read invoices, payments, receipts, collections, concessions, refunds, transactions | `fees.read` (now used by Finance workspace nav) | `fees.read` on Finance routes | Router-level `requireFeature("fees")`; command center also permits `fees.collection.read`; audit also permits `audit.read` |
| Create/cancel invoice in Accounts workspace | `fees.invoice.manage` | `fees.invoice.manage` | Router-level `requireFeature("fees")` |
| Record payment in Accounts workspace | `fees.payment.record` | `fees.payment.record` | Router-level `requireFeature("fees")` |
| Request/approve concession | `fees.concession.manage` / `fees.concession.approve` | Matching dedicated permission | Router-level `requireFeature("fees")` |
| Request/approve/process refund | `fees.refund.request` / `fees.refund.approve` / `fees.refund.process` | Matching dedicated permission | Router-level `requireFeature("fees")` |
| Export reports | `fees.reports.export` or `fees.read` | Either permission via `authorizeAnyPermission` | Router-level `requireFeature("fees")` |
| Legacy ERP invoice creation | `fees.manage` | `fees.manage` on legacy ERP route | Separate legacy route contract; do not conflate with Accounts Finance API |
| Legacy ERP payment recording | `fees.payment.record` | `fees.payment.record` on legacy ERP route | `requireFeature("payments")`; entitlement differs from Finance API and needs product-policy review |

Waiver, adjustment, ledger, export and reporting permissions were not mapped to UI controls in this specific `/erp` Fees tab because corresponding actions are not present in the inspected component. Their full repository-wide mapping remains outside this milestone and must not be inferred from the table.

### Changes applied

- `frontend/src/components/accounts/FinancePage.tsx`: removed wildcard `fees.manage` / `fees.admin` UI authorization; Finance controls now require their requested permission. Aligned Finance list-view permissions with the actual `finance.routes.ts` read contract and gated XLSX export by the actual export/read permission.
- `frontend/src/lib/navigation.ts`: aligned Accounts navigation read guards with the actual Finance API read permission while preserving the distinct fee-structure/fee-head read permission and unrelated Chairman collection permission.
- `frontend/src/app/erp/page.tsx`: replaced the page-wide `fees.manage` / `fees.pay` gate with operation-specific visibility for structure read, structure management, approval, invoice creation and payment recording.
- `backend/src/services/feeAuthorization.ts`: introduced a typed action-to-existing-permission map covering structures, invoices, payments, concessions, refunds and exports.
- `backend/src/services/feeStructure.service.ts`: structure-management and structure-read checks now use the canonical permission helper; legacy `fees.manage` no longer grants fee-structure mutation/read service access by itself.
- `backend/src/__tests__/feeAuthorization.test.ts`: added regression tests for permission mapping, read-only denials, operation-specific mutations and rejection of legacy broad permissions.

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