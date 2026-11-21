# ACADLYX Frontend Completion Execution Tracker

Last updated: 2026-10-18

## 1. Scope, branch safety, and verification policy

- Repository: `acadlyx/acadlyx`
- Authorized implementation branch: `native-mobile-parity-2026-10-17`
- Current branch tip at the time of this tracker edit: `40d4ebbd68d8ebeeeed8e40d091aa8690cb42f9b`
- Latest frontend-source checkpoint included in that branch: `8b816bd27bac6a9abbfbd0e43ad18756d01275ee`
- Protected production reference SHA: `2dc568ec4416a295028cf64eaa7ee659b9258d89` (`production-upgrade-2026-09-20`)
- PR #77 remains open/draft/unmerged. No merge, deployment, backend change, database change or infrastructure change was performed.
- The source changes are frontend-only: route/navigation configuration, shared shell, frontend page components, source-validation script, Playwright frontend tests, and this documentation.
- No writable local checkout is available in this session. Local npm/typecheck/lint/build/browser/screenshot commands were not run. GitHub Actions supplies the runtime quality evidence; source-content inspection is recorded separately and never counted as route verification.

The row-level completion ledger is `docs/production/FRONTEND_COMPLETION_REQUIREMENTS.csv`. It contains **677 requirements** with unique IDs, role/workspace or route, expected behavior, status, evidence source, test method, test result, associated source checkpoint and unresolved dependency. It is the authoritative denominator for the current completion calculation.

Statuses are strictly `NOT_STARTED`, `IN_PROGRESS`, `IMPLEMENTED_UNVERIFIED`, `VERIFIED`, or `BLOCKED`. Source presence, route inventory, test authoring, or a green build alone do not mark an individual route/workflow as verified.

## 2. Repository inventory and role ownership

- App Router page files: **300**.
- Explicit `NAMESPACE_OWNERS` entries: **71**.
- Role/navigation items: **216** in `ROLE_NAVIGATION` plus **19** in `INSTITUTION_ADMIN_NAV`, for **235 sidebar destinations**.
- Canonical/dashboard identity map: **21 role identities**, including Staff.
- First-level route groups: **66**.
- Generated route ledger rows: **677**: 21 roles, 66 route groups, 300 pages, 235 navigation items, 24 shared interaction requirements, 7 responsive widths, 6 accessibility checks, 13 required-test rows and 5 CI gates.
- The source inventory found **no App Router path missing a namespace owner/public-route exception** and no navigation destination whose normalized href lacks a corresponding App Router page. These are source-derived completeness checks, not a claim that every link works at runtime. An automated source-validation guard now rejects new unowned protected page routes.

Role-to-workspace ownership is derived from `authority.ts`, `navigation.ts`, `adminNavigation.ts`, the namespace registry and page wrappers. The route ledger associates pages with the longest matching namespace prefix; the more-specific prefix is deliberately used for scoped sub-routes.

| Role/workspace | Landing page | Ownership summary / boundary |
|---|---|---|
| Super Admin | `/superadmin` | Platform workspace; no automatic access to tenant Accounts operations |
| Institution Admin | `/admin` | Institution administration and authorized student master; no blanket specialist authorization |
| Chairman | `/chairman` | Authorized institutional oversight and existing fee-governance routes |
| Management | `/management` | Management overview, insights and separate fee-approval workflow |
| Director | `/director` | Campus-scoped oversight, operations and campus fee approvals |
| Registrar | `/registrar` | Authorized academic masters, student movement, registration and certificates |
| Dean | `/dean` | Academic oversight, authorized department context and Dean-only academic structure page |
| HOD | `/hod` | Authorized department/programme/batch/section and academic workflows |
| Faculty | `/faculty` | Assigned teaching/course-offering context |
| Accounts | `/accounts` | Fee structures, heads, invoices, payments, receipts and financial operations within granted scope |
| HR | `/hr` | Employee and leave workflows |
| Admissions | `/admissions` | Admissions workflows; Admissions reports/student-list aliases are now explicitly role-owned |
| Examination | `/examination` | Examination workflow and authorized academic context |
| Librarian | `/library` | Library circulation/inventory; Library students/reports aliases are now explicitly role-owned |
| Placement | `/placements` | Placement workflows, eligibility, profiles, drives and reports |
| IT | `/it` | IT-specific workspace and operations |
| CMS | `/site-content` | Website CMS and permitted content features |
| Student | `/student` | Own records and Student-owned academic services |
| Parent | `/parent` | Only linked-child services; each child API must revalidate the relationship |
| Club President | `/club-president` | Club workspace and permitted shared features |
| Staff | `/staff` | Staff operations and notifications |

This is an implementation-oriented ownership matrix, not a grant of privileges. Backend/API authorization remains the final boundary. Shared modules appear in multiple workspaces only where the current role, permissions and tenant features allow them.

## 3. Implemented remediation checkpoints

### FUI-001 — Shared dashboard visual identity

**State: `IMPLEMENTED_UNVERIFIED`.**

- Reconciled shared sidebar, active/hover/focus state, border and shadow accents with the existing ACADLYX green/beige tokens.
- Replaced identified blue utility accents in the shared frame with semantic design-token classes.
- Kept CSS consolidation incremental; global, contrast, responsive and modal styles have not received a destructive rewrite.
- Source guards in `frontend/scripts/validate-source.mjs` check key token invariants.
- Files include `frontend/src/app/acadlyx-dashboard-tokens.css`, `frontend/src/components/dashboard/UnifiedDashboardFrame.tsx`, and the source validator.
- Remaining: rendered screenshot/contrast checks across route families and all required widths.

### FUI-002 — Fee management ownership and approvals

**State: `IMPLEMENTED_UNVERIFIED`.**

- Removed the Institution Admin menu’s Accounts-owned `/accounts/fee-structures` link.
- Restricted generic Fee Structures/Fee Heads sidebar entries to Accounts.
- Added `/management/fee-approvals` and a shared `FeeStructureApprovalQueue`; the Management page uses institutional copy and requires both fee-read and approval permission plus matching effective role.
- Refactored Director’s approval queue to reuse the component while retaining campus-scoped copy. API scope/maker-checker checks were not changed.
- Director navigation permission requirements now match the queue’s read/approve checks.
- Added fee tenant-feature aliases and source assertions.
- Legacy `/fees/receipts` namespace ownership now includes Accounts, preserving the authorized Accounts route.
- Files include `frontend/src/lib/navigation.ts`, `frontend/src/lib/adminNavigation.ts`, `frontend/src/components/accounts/FeeStructureApprovalQueue.tsx`, Director/Management routes and `frontend/scripts/validate-source.mjs`.

### FUI-003 — Parent, notices, Staff and shared route ownership

**State: `IMPLEMENTED_UNVERIFIED`.**

- Added Parent `Children → /parent/children`, enforced `parent_portal` tenant entitlement and explicitly limited the existing linked-child page to Parent.
- Generic notices links for Dean, HOD and Student resolve to their role-specific notices page before sidebar destination deduplication. Student notices remain read-only under the existing page permissions.
- Added `STAFF` to `DASHBOARD_IDS` to match the existing label/home/navigation.
- Added explicit role-owned namespaces for Admissions students/reports and Librarian students/reports because their page wrappers use `RoleScopedStudents`/`RoleScopedReports` with a single role prop.
- Added browser assertions for the specific owner/non-owner direct routes and protected API request suppression. They are authored test coverage, not passed runtime coverage until CI reports success.

### FUI-004 — Fail-closed protected routes and page/namespace parity

**State: `IMPLEMENTED_UNVERIFIED`; exact-head verification pending.**

A high-impact authorization defect was found in `frontend/src/lib/navigation.ts`: a protected route with no matching `NAMESPACE_OWNERS` entry returned `true`. Because the global `ProtectedRouteBoundary` calls `canAccessRoute` before it mounts protected page children, unknown protected routes must never default to allowed.

Implemented:

- Unknown protected route with no namespace entry now returns deny (`false`).
- Added explicit owner namespaces for previously uncovered page families: club, CMS, enrollment/forms, ERP/work, faculty management, institution settings/CMS, LMS subroutes, profile, today, deletion approvals and fee aliases.
- Added route-inventory assertions to `frontend/scripts/validate-source.mjs`. Every non-public page must be covered by a namespace owner or the public exact-route registry.
- Narrowed `/students` and `/students/[id]` to Institution Admin only, matching the student-master page’s `allowedRoles={["INSTITUTION_ADMIN"]}`. Other roles must use their existing role-owned student paths.
- Narrowed `/academics` to Dean only, matching the page’s explicit `allowedRoles={["DEAN"]}`.
- Narrowed generic `/timetable` to the roles explicitly allowed by that page (Chairman, Director, Dean, HOD, Faculty). Student uses `/student/timetable`.
- Added most-specific namespaces for `/admissions/students`, `/admissions/reports`, `/library/students`, and `/library/reports` so those aliases do not inherit broad parent namespace roles.
- Source checks lock the important ownership entries and unknown-route deny behavior.
- Regression tests monitor requests for generic student lists, academic structure, timetable, Admissions/Librarian student lists/report options, LMS and permanent-deletion approvals to ensure non-owner direct navigation does not mount the restricted page’s data effects.

This preserves existing API contracts and does not change backend authorization. The existing page-level `DashboardShell` checks remain an additional UI layer, not the first/only gate.

## 4. Automated regression coverage authored

The current `frontend/e2e/leadership-authenticated-workspace.spec.mjs` has **21 Playwright cases**. It includes existing authenticated workspace/history/library checks plus direct route and menu regressions for:

- Institution Admin must not see Accounts fee setup; direct Accounts fee URL denied.
- Management fee approvals must stay in their own workspace on direct load/reload and must not expose Accounts setup links.
- Parent can reach the linked-child workspace.
- Dean, HOD and Student each resolve to one role-owned Notices destination.
- Student cannot directly open Management fee approvals.
- Accounts cannot directly open LMS; no protected LMS API request should be made.
- Student cannot directly open user-deletion approvals; no deletion approval API call should be made.
- Director cannot open Institution Admin student master; no generic student-list request should be made.
- Director cannot open Dean-only Academics; no department/program/year/offering requests should be made.
- Student cannot open the shared leadership timetable; no generic timetable API request should be made.
- Director cannot open Admissions student/report pages; Student cannot open Librarian student/report pages, and those route families’ protected API calls must not run.

**Execution status:** these tests are committed, but at this update no exact-head Playwright pass was returned. Source validation and test authoring must not be confused with browser test execution.

## 5. Exact current completion ledger and progress

Ledger path: `docs/production/FRONTEND_COMPLETION_REQUIREMENTS.csv`.

| Status | Rows | Meaning |
|---|---:|---|
| `IMPLEMENTED_UNVERIFIED` | 564 | Implementation/source target exists, but its applicable runtime acceptance has not been proven |
| `IN_PROGRESS` | 113 | Remaining implementation or verification steps still need work |
| `VERIFIED` | 0 | No row is being carried forward as verified without evidence on the current source checkpoint |
| `BLOCKED` | 0 | No item is marked blocked at this moment; confirmed future blockers must be represented explicitly |
| `NOT_STARTED` | 0 | Each ledger requirement has at least been inventoried and assigned an initial state |

Total applicable requirements: **677**.

Under the mission’s strict formula, the current verified completion score is **0/677 = 0%** until relevant current-head tests pass. This is intentionally not an estimate of the amount of code already written. The source implementation state is **564/677 = 83.3% `IMPLEMENTED_UNVERIFIED`**, with **113/677 = 16.7% `IN_PROGRESS`**. No route, role, viewport or accessibility requirement is counted verified merely because a file exists.

Category counts in the ledger:

| Category | Applicable rows | Verified now |
|---|---:|---:|
| Role/workspace identities | 21 | 0 |
| Route groups | 66 | 0 |
| App Router pages | 300 | 0 |
| Sidebar destinations | 235 | 0 |
| Shared interactions | 24 | 0 |
| Responsive widths | 7 | 0 |
| Accessibility | 6 | 0 |
| Required test categories | 13 | 0 |
| Exact-head CI gates | 5 | 0 |

The seven responsive widths are 320, 375, 768, 1024, 1280, 1440 and 1920 px. No claim is made that all routes, breakpoints or accessibility criteria have been manually exercised.

## 6. CI evidence and known intermediate failure

Current documentation-branch HEAD before this tracker update: `40d4ebbd68d8ebeeeed8e40d091aa8690cb42f9b`. GitHub Actions had these exact-head runs queued/pending when checked:

- [Frontend build](https://github.com/acadlyx/acadlyx/actions/runs/39072926320) — queued.
- [ERP verification](https://github.com/acadlyx/acadlyx/actions/runs/39072926285) — queued.
- [Production Quality](https://github.com/acadlyx/acadlyx/actions/runs/39072926254) — queued.
- [Production Gate](https://github.com/acadlyx/acadlyx/actions/runs/39072926219) — queued.
- [Native Mobile CI](https://github.com/acadlyx/acadlyx/actions/runs/39072926275) — pending.

A prior feature-branch source checkpoint `27cbc10550f984d8e7610f8689e3b33c992a8b79` had successful Frontend build, ERP verification, Production Gate and Native Mobile CI results; Production Quality was still in progress then. Those results predate the new exact route-owner corrections and are **not** counted as verification of the current source checkpoint.

There was an intermediate typecheck failure at `16fabfa75c87a42c91ae5d0fdea3d8ac03667ae3`, where a namespace edit temporarily left a syntax error. GitHub logged TypeScript errors at `navigation.ts` lines 1976/2206 after source validation passed. This was corrected in follow-up commits; the succeeding/current build must still finish successfully. The failure remains documented rather than suppressed.

No local shell, lint, typecheck, production build, browser session or screenshot review was run in this session.

## 7. Remaining work required for 100% verified completion

1. Let exact-head Frontend build, ERP verification, Production Quality, Production Gate and Native Mobile CI complete; inspect job-level logs and fix introduced regressions.
2. Execute the 21 authored Playwright tests on the code checkpoint, repair failures and re-run; after the next docs/checkpoint commit, check the exact new SHA again.
3. Complete route-by-route authenticated positive/negative tests for all 300 page files and every role. The ledger currently records route owners from the most-specific namespace entry but does not claim runtime ownership verified.
4. Cover supported multi-role precedence, account/session isolation across tabs, full context switching and stale-record invalidation.
5. Verify main actions and API-backed forms/tables/search/filter/pagination/export behaviors; do not replace any real API with mocks outside valid test fixtures.
6. Execute responsive checks at all seven widths and capture screenshots for all route families; resolve horizontal overflow and clipped menus/forms/tables/dialogs.
7. Run automated accessibility checks and keyboard/reduced-motion review across every route family.
8. Update individual ledger rows after results pass. Keep `IMPLEMENTED_UNVERIFIED`, `IN_PROGRESS`, and `BLOCKED` items out of the verified-completion numerator.
9. Do not claim 100% until every applicable ledger row is `VERIFIED`, no release-blocking frontend issue remains, and the final branch commit has the required green checks.

