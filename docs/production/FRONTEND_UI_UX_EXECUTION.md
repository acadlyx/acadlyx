# ACADLYX Frontend Ownership & UI/UX Remediation Tracker

Last updated: 2026-10-18

## Mission and protection

This work repairs role/workspace ownership, navigation destination integrity, and shared visual consistency in the **existing web frontend**. The authorized implementation branch is `native-mobile-parity-2026-10-17`; `production-upgrade-2026-09-20` is inspected read-only. No merge, production commit, deployment, infrastructure change, backend permission change, database change, or API authorization change is authorized.

- Repository: `acadlyx/acadlyx`
- Authorized branch: `native-mobile-parity-2026-10-17`
- Last implementation checkpoint before this tracker edit: `9cfd7ab4f8e9828834878adc7cb3ebc51f19c26a`
- Production reference SHA: `2dc568ec4416a295028cf64eaa7ee659b9258d89`
- PR #77 remains draft and must not be merged/deployed.
- Environment limitation: no writable local checkout is mounted in this session. Changes were committed to the authorized remote branch through the GitHub repository integration. Local npm, typecheck, lint, browser sessions, and viewport screenshots were not run in this session.

## Current route inventory

The recursive Git tree was fetched successfully (`truncated: false`) from both refs. A route here means a source file matching `frontend/src/app/**/page.{tsx,ts,jsx,js}`; this is a source inventory, not a claim that each route renders or works.

| Measure | Authorized feature branch | Read-only production reference |
|---|---:|---:|
| App Router page files | 300 | 299 |
| Pages under Management | 8 | 7 |
| Pages individually browser-verified in this session | 0 | Not applicable |
| Pages fully audited end-to-end (route, action, permission, data context, browser) | 0 | Not applicable |

The additional feature-branch page is `frontend/src/app/management/fee-approvals/page.tsx`. The two branches have the same page-file count in the other role directories enumerated for this checkpoint. A file count alone is not feature parity, and no route is marked browser-verified based on source inspection or build status.

## Role → workspace → sidebar/route ownership matrix

This is a **source-derived ownership map**, based on `authority.ts`, `navigation.ts`, `adminNavigation.ts`, existing route wrappers, and the role-owned route namespace checks. Sidebar items remain filtered by authenticated permissions and tenant entitlements; this matrix does not grant permissions. `getPrimaryRole` selects one effective workspace for multi-role accounts; it does not union every role's sidebar.

| Role | Home/workspace | Primary owned menu/workflow areas | Required context/boundary to preserve |
|---|---|---|---|
| Super Admin | `/superadmin` | Platform overview, institutions, platform users, site CMS, platform placements, notices and notifications | Platform-level tasks only; do not reuse Accounts routes just because the role has a secondary fee permission |
| Institution Admin | `/admin` | Institution overview, users, students, imports/exports, academic masters, campuses, notices, calendar, parent links, events/gallery, operations | Institution scope with granted permissions and tenant-feature entitlements; no automatic specialist/finance authority |
| Chairman | `/chairman` | Institution oversight, fee structure drafts/oversight, academic oversight, collections, reports, intelligence, student oversight, notices/events | Institution-wide only where existing backend scope allows; preserve maker-checker workflow |
| Management | `/management` | Management overview, operations, intelligence/reports, placement, notices/events, dedicated fee-approval queue | Institutional approval workflow only with fee read + approval permissions; creator must not approve their own draft |
| Director | `/director` | Campus oversight, examinations, fee structures/approvals/collections, reports, students, admissions, OBE, notices/events | Campus-scoped where required; preserve live API scope enforcement |
| Registrar | `/registrar` | Academic masters, students, admissions, certificates, course registration, student movement/promotion, reports, notices | Authorized institution/academic scope; do not grant campus-wide director access |
| Dean | `/dean` | Academic oversight, exams/OBE, students/results, department fees, reports/intelligence, placement, notices | Assigned academic/department context; generic Notices destination now resolves to `/dean/notices` |
| HOD | `/hod` | Students/faculty, attendance, timetable, enrollment/course-registration requests, exams/OBE, department fees, reports/intelligence, notices | Authorized department/programme/batch/section context; generic Notices destination now resolves to `/hod/notices` |
| Faculty | `/faculty` | Assigned courses, students, attendance, assignments, exams, marks, OBE, leave/profile, notices | Teaching assignment and course-offering scope; no unrelated department-wide or finance actions |
| Accounts | `/accounts` | Fee structures/heads, invoices, payments, receipts, dues, collections, concessions, refunds, transactions, audit/reports | Assigned financial scope and existing permissions; active/approved structures are required for assignment |
| HR | `/hr` | Employees, leave management, reports, notices | HR permissions and assigned institution scope |
| Admissions | `/admissions` | Applications, admissions/student workflow, reports, notices | Admissions permissions; avoid using general student routes to broaden the action surface |
| Examination | `/examination` | Examination administration, admit-card templates, OBE, reports, notices | Exam-specific permissions and academic context |
| Librarian | `/library` | Copies, circulation, fines, policies, library reports, authorized student lookup, notices | Library inventory/circulation scope; do not use unrelated Accounts routes for fines or charges |
| Placement | `/placements` | Students, companies, drives, openings, applications, calendar, visits, interviews, tests, offers, reports | Placement workflow and candidate eligibility scope |
| IT | `/it` | IT overview, operations, notices | IT/operations permissions; not a general institution admin |
| CMS | `/site-content` | Website CMS, notices/notifications, events/gallery | CMS-specific permissions; not general tenant administration |
| Student | `/student` | Personal academics, attendance, assignments, exams/results, fees, library, timetable, placement, profile/documents, notices | Own student identity/enrollment only; no cross-student records |
| Parent | `/parent` | Linked children, child-specific attendance/results/fees/coursework/notices, parent notices/notifications | Only active backend-linked child records; every child/tab API remains independently authorized |
| Club President | `/club-president` | Club workspace, notices/notifications, common events/gallery | Club-specific role and permissions |
| Staff | `/staff` | Staff overview, operations, notices/notifications | Staff-specific role scope; dashboard identity now matches its existing home, label and navigation entry |

Intentionally shared routes such as LMS, Events & Gallery, notices, and notifications remain shared only where role/permission/tenant filtering allows them. A shared page wrapper is not, by itself, proof that two roles have identical authority.

## Implemented checkpoints

### FUI-001 — Shared dashboard visual identity

**Status:** Implemented in source; latest exact-head CI/browser confirmation pending.

- Reconciled sidebar background, hover, active state, focus and shadow with the existing green/beige semantic tokens.
- Removed identified blue utility accents from the shared frame branding and profile controls.
- Added source-contract checks to `frontend/scripts/validate-source.mjs`.
- Files: `frontend/src/app/acadlyx-dashboard-tokens.css`, `frontend/src/components/dashboard/UnifiedDashboardFrame.tsx`, `frontend/scripts/validate-source.mjs`.

### FUI-002 — Incorrect workspace ownership and duplicate destinations

**Status:** Implemented in source; exact-head CI/browser confirmation pending.

- Removed Institution Admin's `Fee Structures → /accounts/fee-structures` item from `INSTITUTION_ADMIN_NAV`. The route is owned by Accounts in the existing namespace registry; a link that the route guard redirects is misleading.
- Restricted generic `Fee Structures` and `Fee Heads` navigation in `ROLE_NAVIGATION` to Accounts, removing the links from Super Admin and Management. This does not alter backend authorization or change access to the routes.
- Added a dedicated Management route `/management/fee-approvals` and menu item, gated on `fees.structure.read` and `fees.structure.approve`. It reuses `FeeStructureApprovalQueue`; it does not expose Accounts-only invoice assignment actions.
- Refactored Director's existing campus fee-approval page to reuse the same queue component while preserving its role-specific campus copy. The queue requires the effective role to match the current workspace and checks both fee-read and approval permission before showing the queue; APIs still enforce actual record scope and maker-checker.
- Aligned the Director's sidebar entry to require both `fees.structure.read` and `fees.structure.approve`, matching the queue’s UI gating.
- Mapped fee-approval/fee-structure aliases to the existing `fees` tenant entitlement; did not bypass tenant entitlements.
- Fixed duplicate Dean/HOD Notices destinations by mapping generic `/notices` to their existing role-owned wrappers before final destination deduplication.
- Added the Parent `Children → /parent/children` menu entry for the existing real linked-child page, tagged the route with the `parent_portal` tenant entitlement, and supplied `allowedRoles={["PARENT"]}` on the existing page. No mock student data or new backend endpoints were introduced.
- Added `STAFF` to `DASHBOARD_IDS` to match the role's existing label, priority, home `/staff`, routes, and sidebar. This makes the dashboard identity helper recognize a role that the rest of the existing frontend already supports.
- Added source guards for fee ownership, Management queue permissions, Director permission alignment, Dean/HOD duplicate resolution, Parent child-route ownership/entitlement, Staff dashboard identity, and the shell palette.
- Added five focused Playwright cases in `frontend/e2e/leadership-authenticated-workspace.spec.mjs`: Institution Admin must not see Accounts fee-management links; Management fee approvals must stay in its owned route across direct load/reload; Parent must reach its linked-child screen; Dean and HOD must each see exactly one workspace-owned Notices destination. The test fixture now exposes the `parent_portal` tenant feature only to the Parent case. These tests have been committed but **have not yet been reported as executed** by CI.
- Main source files touched in this work: `frontend/src/lib/adminNavigation.ts`, `frontend/src/lib/navigation.ts`, `frontend/src/lib/authority.ts`, `frontend/src/components/dashboard/DashboardShell.tsx`, `frontend/src/components/accounts/FeeStructureApprovalQueue.tsx`, `frontend/src/app/management/fee-approvals/page.tsx`, `frontend/src/app/director/fee-approvals/page.tsx`, `frontend/src/app/parent/children/page.tsx`, `frontend/scripts/validate-source.mjs`, and `frontend/e2e/leadership-authenticated-workspace.spec.mjs`.

### Confirmed source-content assertions

The latest fetched branch source was inspected programmatically through the repository integration. These assertions returned true: the Admin menu no longer links to Accounts fee structures; Fee Structures/Fee Heads entries are Accounts-only; Management has a dedicated approval item/page and shared queue with required permission checks; the Parent Children entry is Parent-only and tagged with `parent_portal`; Dean/HOD notices overrides point to role-owned destinations; Staff appears in dashboard identity and workspace home; fee-route aliases enforce the existing `fees` feature; dashboard shell palette uses green semantic tokens.

These were **source-content checks executed against the fetched text**, not execution of `npm run validate:source`, TypeScript, lint, build, or browser automation.

## Verification and CI

- A Frontend build at intermediate SHA `aed3fbc1bef946b45b8411c2bb0ad84d31587dda` **failed at `npm run validate:source`**, before TypeScript or production build ran. The log named the fee ownership/Management approval source guard. The ownership fix and guard were subsequently reconciled; that failing run is not counted as a pass.
- Frontend build run [39070148017](https://github.com/acadlyx/acadlyx/actions/runs/39070148017) completed **SUCCESS** at `45743a55876264881da499d7da2ac605e3ed870a`. Its `npm run validate:source`, `npm run typecheck`, and `npm run build` steps all passed. The GitHub comparison from that SHA to the latest implementation/test SHA `239a8d0988f5146c27ea2353bd0ba5b62c8d733d` shows changes only in this tracker and `frontend/e2e/leadership-authenticated-workspace.spec.mjs`; frontend application code and the source validator were unchanged in that interval. The successful build therefore covers the same application source, but it does **not** prove that the newer Playwright additions passed.
- Six targeted Playwright cases are now committed: Institution Admin cannot see or directly open Accounts fee structures; Management fee approvals remain in their owned route after direct navigation/reload and do not expose Accounts tools; Parent can load its linked-child route; Dean and HOD notices each resolve to their workspace-owned destination; Student cannot directly open the Management approvals page. Playwright execution for these updated cases is **pending**.
- Last implementation/test SHA before this tracker edit: `239a8d0988f5146c27ea2353bd0ba5b62c8d733d`. Exact-head Frontend build, ERP verification, Production Quality, Production Gate and Native Mobile CI checks for the next documentation checkpoint must be checked by SHA. Production Quality's browser job must be read separately; a successful build is not browser evidence.
- No local shell was mounted, so local lint, typecheck, package scripts, production build, browser testing and screenshot review were not run. CI is the available execution evidence.
- Browser verification of the 300 App Router pages and the prescribed 320–1920 px viewport set remains 0/300. The new Playwright assertions are test coverage authored, not routes marked verified.

## Progress metrics (definition and current evidence)

These are separated by what was actually inventoried versus tested; none means all workflows are production-ready.

| Dimension | Progress to date | Measurement rule |
|---|---|---|
| Role/workspace identity | 21/21 supported role identities mapped to home and role-owned menu areas (100% for identity/home mapping) | Count labels, priority/dashboard IDs, home mappings and role navigation entries; action-level scope and route behavior still unverified |
| Feature ownership remediation | 6 confirmed ownership/navigation defects addressed in this bounded pass | Count the Admin fee link, non-Accounts fee links, missing Management approval surface, duplicate Dean/HOD notice destinations, missing Parent Children entry/entitlement, and missing Staff dashboard identity. Not a percentage of all possible defects |
| Navigation source consistency | Key targeted assertions present; exact-head test pending | Existing source-contract assertions target the specific changed invariants; full sidebar/API permission coverage is not claimed |
| Visual consistency | 1 shared-shell palette defect corrected in source | Only the identified shared dashboard brand mismatch; page-by-page visual audit remains incomplete |
| Responsive/accessibility | 0/300 routes browser-verified (0%) | Requires actual viewport/browser and keyboard/reduced-motion evidence |
| Regression verification | Latest exact-head CI pending | Passing source inspection is not counted as a test run; report each CI workflow and SHA separately |

## Next actions

1. Check CI results on the newest exact branch HEAD, fix any source-guard/type/lint/build failure, and do not weaken the guards to manufacture a pass.
2. Add role/navigation browser assertions for Management fee approvals, Parent Children, Dean/HOD Notices, and absence of Accounts fee management in the Institution Admin menu where the existing test fixtures support those roles.
3. Continue reviewing the remaining route inventory by role and verify action-level ownership and scope, rather than bulk-rewriting pages.
4. Exercise the shared shell at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px; verify keyboard focus, dialog/drawer dismissal, refresh/back/forward, and reduced-motion.
5. Keep counts of source-inventoried, source-reviewed, implemented, and browser-verified routes separate.
