# ACADLYX Platform Stabilization Audit

Audit date: 2026-10-09. Baseline branch: production-upgrade-2026-09-20. Working branch: stabilization-platform-2026-10-09. Status: IN PROGRESS; source inspection only, not a completion certificate.

## Status definitions

- FIXED: code changed and reproducer/regression passed.
- VERIFIED: relevant behavior executed successfully with evidence.
- PARTIALLY VERIFIED: only some layers/scenarios checked.
- UNVERIFIED: adequate runtime/test evidence absent.
- BLOCKED: unavailable environment, credentials, service or test fixture prevents verification.

## Finding 1 — Fee Structures UI permission mismatch (PARTIALLY VERIFIED)

Evidence: frontend/src/app/erp/page.tsx gates Fees management using fees.manage and fees.pay. backend/src/routes/erp.routes.ts protects fee-structure reads with fees.structure.read, creation/update with fees.structure.manage, approval with fees.structure.approve and assignment with fees.assign. backend/src/services/feeStructure.service.ts also checks dedicated structure-management and read permissions.

Likely symptom: a user with the dedicated fee-structure permission can still see the frontend “Access restricted” state if they lack the unrelated legacy fees.manage/fees.pay pair. This is a frontend authorization-contract mismatch, not a reason to weaken backend authorization.

Correction required: use operation-specific permissions in the UI. Structure and fee-head maintenance requires fees.structure.manage; read requires fees.structure.read; approval requires fees.structure.approve; assignment requires fees.assign; invoices and payments must use their own route permissions. Do not grant all fee permissions to a role. This code correction and regression test have NOT yet been applied by this report.

## Finding 2 — Entitlement and permission are separate (PARTIALLY VERIFIED)

The ERP router applies requireFeature("fees") and action-specific authorize middleware. Runtime entitlement behavior remains UNVERIFIED.

## Finding 3 — Institution and academic relationship checks (PARTIALLY VERIFIED)

The fee-structure service checks academic-year, program, semester and fee-head references against the institution, validates program/semester context and checks student membership/enrollment for assignment. Full cross-tenant regression tests have not run.

## Finding 4 — Legacy exam writes retired (PARTIALLY VERIFIED)

The inspected ERP router returns HTTP 410 for legacy exam writes and points to the canonical examination lifecycle. Frontend compatibility and end-to-end lifecycle tests remain UNVERIFIED.

## Finding 5 — Audit logging (PARTIALLY VERIFIED)

Fee-head and fee-structure mutations call the existing audit service. Audit completeness, failure behavior, correlation IDs and approval reason capture need verification.

## Files changed

This audit records the baseline only. Do not report application code as fixed until a code diff and regression evidence are added here.

## Verification log

| Check | Evidence | Result |
|---|---|---|
| Branch/commit discovery | Repository branch and recent commit search | PARTIALLY VERIFIED; branch exists; searched latest commit c0bbf2fb451f53bd17be75840bda88b893bc719f |
| Fee UI permission gate | Inspect frontend/src/app/erp/page.tsx | PARTIALLY VERIFIED; permission pair differs from dedicated route permissions |
| Fee API permission gate | Inspect backend/src/routes/erp.routes.ts | PARTIALLY VERIFIED; action permission and entitlement middleware present |
| Fee service scope | Inspect backend/src/services/feeStructure.service.ts | PARTIALLY VERIFIED; institution checks observed in relevant paths |
| Frontend typecheck/lint/build | Not executed | UNVERIFIED |
| Backend typecheck/lint/tests | Not executed | UNVERIFIED |
| Prisma validation/migration status | Not executed against runtime/database | UNVERIFIED |
| Browser/network/responsive checks | Not executed | UNVERIFIED |
| Production smoke tests | Not executed | BLOCKED / UNVERIFIED |

## Required rounds

1. Baseline: capture working-tree state and run existing commands from a full checkout.
2. Governance: reconcile role seeds, permissions, entitlements and approval models.
3. Authorization: trace session refresh, guards, middleware, services, query scopes and cache invalidation.
4. Fetching: inventory requests, contracts, loading/error/empty states and duplicate calls.
5. Design system: enumerate tokens, shared components and hardcoded deviations; verify with browser screenshots.
6. Integration: trace canonical student, fees, library, exam, placement and document workflows.
7. Performance: capture timings/query evidence before optimizing.
8. Regression: run affected and full available suites.
9. Re-audit: search again for original defect classes and inspect diffs.
10. Independent final verification: execute checks against final commit.

## Risks and blockers

The repository connector does not prove local build, browser, database migration or production health. Full route/model/permission extraction is pending. Reported 401/403/404/500s need safe request IDs/logs and reproducible context. Role navigation, mobile responsiveness, theme consistency and performance have not been browser-verified. Do not claim zero errors, complete module readiness or 100% production readiness without executable evidence.

## Final verification status

NOT COMPLETE. Update classifications only when tests and runtime evidence support them.