# ACADLYX native mobile implementation tracker

Continuation started from the authorized branch `native-mobile-parity-2026-10-17` at
`b2a3894145305f122be7e1ddf4c2d16751460baf`.

This is the persistent implementation tracker. The route-by-route source,
native locations, workflow gaps, and backend dependencies are maintained in
[`MOBILE_FEATURE_PARITY.md`](./MOBILE_FEATURE_PARITY.md); this tracker records
the current implementation state and verification evidence without treating
source inspection as runtime evidence.

## Status vocabulary

- `NOT_STARTED` — no native workflow has been implemented.
- `IN_PROGRESS` — a native surface or part of a workflow exists, but required
  operations, contracts, scope handling, or evidence are incomplete.
- `BLOCKED` — an external dependency or an intentionally server-only surface
  prevents a mobile workflow.
- `IMPLEMENTED_UNVERIFIED` — source and contract checks support the
  implementation, but it has not passed the required live API/device checks.
- `VERIFIED` — acceptance criteria and recorded automated/runtime evidence
  have passed. No item below is marked verified merely from code review.

## Role dashboards

| Role | Backend source of truth | Native implementation | State | Evidence / remaining verification |
|---|---|---|---|---|
| Super Admin | `/institutions`, `/my-work`, RBAC | `RoleDashboardScreen.tsx` platform composition | IMPLEMENTED_UNVERIFIED | Contract test; live authorized API and device check required |
| Institution Admin | `/operations/summary`, `/my-work`, RBAC | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Chairman | `/intelligence/command-center`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Management | `/intelligence/command-center`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Director | `/intelligence/command-center`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Dean | `/course-offerings`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Registrar | `/registrations`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| HOD | `/course-offerings`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Faculty | `/faculty/me/dashboard`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Accounts | `/finance/command-center`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| HR | `/hr/employees`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Admissions | `/admissions`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Examination | `/examinations/sessions`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Librarian | `/library/books`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Placement | `/placements/drives`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| IT | `/operations/summary`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| CMS | `/institutional-cms`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |
| Student | `/students/me/dashboard`, `/my-work` | Role composition plus Student Portal destinations | IMPLEMENTED_UNVERIFIED | Same |
| Parent | `/parent/children`, `/my-work` | Role composition plus Parent portal destination | IMPLEMENTED_UNVERIFIED | Same |
| Club President | `/events`, `/my-work` | Role composition | IMPLEMENTED_UNVERIFIED | Same |

The dashboard resolves the canonical effective role using the priority in
`backend/src/services/accessScope.service.ts`; client menu filtering is only a
usability aid. Role signal requests are withheld unless the session returns the
needed permission and all quick actions open existing native destinations.

## Cross-cutting implementation status

| Capability | Source / native location | State | Remaining work |
|---|---|---|---|
| Authentication, MFA, token refresh and logout | `/auth`; `AuthProvider.tsx`, `api/client.ts` | IMPLEMENTED_UNVERIFIED | Live expiry, refresh-race and device checks |
| Authorized workspace/context | `/workspace/context`; `WorkspaceContextProvider.tsx`; `workspaceContext.service.ts`; `workspaceScope.mjs` | IMPLEMENTED_UNVERIFIED | Selector supports all seven dimensions. Context authorization is resolved fresh from PostgreSQL, selections are persisted per account/role/permission shape and revalidated on restore, and cached record values are reset before new scope activation. Real API/PostgreSQL role and tenant isolation suite added; latest CI result required. |
| Module inventory and generic read surfaces | `MODULES`, `ModuleScreen.tsx` | IN_PROGRESS | This is not workflow parity; module-specific actions remain |
| Attendance, assignments, notices, timetable, library, calendar | Dedicated screen files in `mobile/src/screens` | IN_PROGRESS | Route matrix identifies remaining workflow actions and tests |
| Parent, HR, admissions and student portals | Dedicated screen files | IN_PROGRESS | Live contract and complete lifecycle tests |
| Global search | `/search`; `GlobalSearchScreen.tsx` | IMPLEMENTED_UNVERIFIED | Debounced server-scoped search now opens a native authorized destination; live search/result authorization still required |
| Placement | `/placements`; `PlacementScreen.tsx` | IMPLEMENTED_UNVERIFIED | Drives, opportunities, eligibility explanation, student registration/application, offers and calendar are native. Coordinator create/edit, interview/test/offer administration, cohort builder and live API/device checks remain. |
| Finance, examinations, LMS, CMS, files, imports/exports, assistant | `MOBILE_FEATURE_PARITY.md` route matrix | IN_PROGRESS / NOT_STARTED by route | Implement only against inspected existing contracts |
| Native build/device verification | Expo configuration | BLOCKED | No simulator/device or build service evidence has been supplied in this environment |
| Dependency security remediation | `mobile/package-lock.json` | BLOCKED | `npm audit --omit=dev --json` reports 22 upstream advisories (15 high, 7 moderate). `npm audit fix --dry-run` proposes incompatible major downgrades to Expo 44 / React Native 0.72 while this app is Expo 57 / React Native 0.86; affected paths include Expo CLI → code-signing/Metro and React Native → community CLI/Metro. A reviewed supported-SDK upgrade is required. |

## Current follow-up status (2026-10-17)

- Backend unused fixture binding fixed in commit `2215622402a42c06ee87278b6a4012e806954ac8`.
- Stale mobile cache-boundary assertion fixed in commit `394aa89384aec6eeff8811ff1b673efb29accc9e`; Native Mobile CI passed typecheck, all 16 structural tests, Expo Doctor (21/21), Android JS bundle export and iOS JS bundle export on that commit.
- Backend fixture in commit `37d17cba2d39efe2938cb9478664f4f72de68c22` attached `batches.read` only to the temporary HOD role, but the latest migrated test database had no permission row, so the integration suite still failed before reaching its scope assertions. The continuation patch upserts that canonical permission inside the isolated test fixture and still grants it only to the HOD fixture role; application RBAC defaults remain unchanged.
- Android Back source review found the bottom-tab navigator relied on the default first-route behavior. The continuation patch sets `backBehavior="history"` so hardware Back follows previously visited tabs, while the native stack continues to push detail routes normally. A source-contract regression test now covers tab history, detail navigation and auth/logout boundaries. No emulator/device is available here, so physical hardware Back, system-gesture, modal and drawer runtime behavior remain unverified.
- Full ERP workflow parity remains incomplete. Role dashboards and generic read-only module surfaces are not evidence of complete create/edit/approval/import/export workflows.

## Verification log

| Check | Result | Date |
|---|---|---|
| `mobile: npm test` | PASS — 16/16 structural tests on commit `394aa893`; no Android hardware Back/device test performed | 2026-10-17 |
| `mobile: npm run typecheck` | PASS | 2026-10-17 |
| `mobile: npm run doctor` | PASS — 21/21 Expo checks after adding `package-lock.json` | 2026-10-17 |
| `mobile: npm audit --omit=dev --json` | 22 advisories — 15 high, 7 moderate, 0 critical; remediation requires a reviewed Expo/React Native compatibility update | 2026-10-17 |
| `backend: workspace-context-role.contract.test.ts` | PASS — effective-role and hierarchy guards; later isolated PostgreSQL suite passed in CI | 2026-10-17 |
| `backend: workspace-context-isolation.integration.test.ts` | PASS in the verified CI PostgreSQL suite | 2026-10-17 |
| `backend: npm run typecheck` | PASS in verified CI | 2026-10-17 |
| `mobile: placement workflow contract` | PASS — drives, eligibility, apply, offers and calendar route coverage | 2026-10-19 |
| Live authenticated API tests | NOT RUN | No authorized test account/API environment configured |
| iOS / Android build | NOT RUN | No simulator/device or build credentials available |


## Continuation audit — 2026-10-17

- Remote feature-branch HEAD before this continuation: `b2a3894145305f122be7e1ddf4c2d16751460baf`; the four previously reported commits were present.
- Latest CI at that HEAD: Native Mobile CI and Frontend build passed. ERP verification and Production Gate failed at the PostgreSQL-backed workspace-context isolation test because the test database did not contain the `batches.read` row. Production Quality failed on that same backend assertion and on two authenticated browser-smoke cases; its other listed jobs (frontend typecheck/build, migration validation, finance workload, backup/restore) passed. Deployment smoke was skipped for the pull-request event.
- The integration fixture now upserts the canonical `batches.read` row into the disposable test database and associates it only with the temporary HOD role. The latest run must pass before the endpoint scope assertions can be considered verified.
- The Director Operations legacy route now replaces browser history to `/director` using the router lifecycle; the prior render-time redirect sent the authenticated browser smoke to the public homepage.
- The placement calendar heading mismatch was traced to `PersistentDashboardRoute` overriding nested page titles with the last path segment (rendering `Calendar`). It now preserves the explicit title `Placement Calendar`, and the browser smoke also asserts the URL has not been redirected before asserting the heading.
- Android tab navigation opts into visit history and has source-contract coverage. This is automated structural coverage, not an emulated hardware event. Full mobile workflows remain `IN_PROGRESS`, and physical device verification is outstanding.
- Continuation CI results must be read from the new commit's Actions runs; the results above describe the baseline HEAD only.


## Follow-up verification — 2026-10-17

The latest completed CI run for `f8c3e580008941d3bee53c9130819893fdadb837` reported:

- **Native Mobile CI: PASS.** Mobile TypeScript, structural contracts, Expo Doctor and Android/iOS JavaScript bundle exports completed successfully.
- **Frontend build: PASS.** Source validation, typecheck, lint and production build completed successfully.
- **ERP verification / Production Gate: FAIL.** The PostgreSQL API suite had 234 passing tests and 1 failing integration test. `GET /api/v1/batches?...campusId=...&departmentId=...&programId=...` returned HTTP 403, `Missing required permission(s): batches.read`, at assertion line 545. The test-only database `RolePermission` row and JWT permission field did not affect effective permissions because `authenticate` recalculates them from `getEffectivePermissions(roles)` in `backend/src/config/rbac.ts`.
- **Production Quality browser smoke: FAIL.** Director legacy-route navigation expected `/director` but ended at `/`; `canAccessRoute` applied the `operations` tenant-feature gate before the redirect-only legacy page could run. Placement route checks reached `/placements/applications` but the global shell supplied the generic heading `Applications`, not `Placement Applications`.

The follow-up patch fixes the canonical contract rather than faking permissions in tests: HOD receives `batches.read` only (not batch create/update/delete), and the integration fixture uses an empty JWT permission array so the real authentication path resolves role permissions. The Director legacy alias is allowed only for an effective Director and redirects to `/director`; the destination still passes the normal authorization boundary. The persistent shell now preserves the expected explicit titles for calendar, applications, offers, drives, openings and placement intelligence. The Director Playwright test now asserts the role-owned heading both before and after reload.

These changes have now been verified by the completed CI runs for this commit. Physical Android/iOS device validation remains outstanding, the full native ERP workflow parity tracker remains `IN_PROGRESS`, and the Expo dependency advisory described below remains an unresolved security review item.


## Verified CI outcome — `288dcd602ec37a6f9c1dc40c1a1bd201c21f2039` (2026-10-17)

All five required GitHub Actions workflows completed successfully on this commit:

| Workflow | Result | Evidence |
|---|---|---|
| ACADLYX Native Mobile CI | PASS | [Run 39038769615](https://github.com/acadlyx/acadlyx/actions/runs/39038769615) — TypeScript, structural contracts, Expo Doctor, Android JS bundle export and iOS JS bundle export all succeeded |
| ACADLYX Production Gate | PASS | [Run 39038769660](https://github.com/acadlyx/acadlyx/actions/runs/39038769660) — backend and frontend jobs succeeded |
| Frontend build | PASS | [Run 39038769654](https://github.com/acadlyx/acadlyx/actions/runs/39038769654) — source validation, typecheck, lint and production build succeeded |
| ACADLYX ERP verification | PASS | [Run 39038769597](https://github.com/acadlyx/acadlyx/actions/runs/39038769597) — backend and frontend jobs succeeded |
| ACADLYX Production Quality | PASS | [Run 39038769606](https://github.com/acadlyx/acadlyx/actions/runs/39038769606) — backend typecheck/tests, browser smoke, frontend build, migration validation, 10k-student finance profile, backup/restore rehearsal and legacy refund compatibility all succeeded |

The isolated PostgreSQL-backed test was enabled with `RUN_POSTGRES_INTEGRATION=1`; its real API suite finished with **236 passed, 0 failed, 0 skipped**. The HOD scoped `GET /api/v1/batches?...campusId=...&departmentId=...&programId=...` returned HTTP 200, and the same suite's cross-programme/cross-tenant denial assertions passed. The browser-smoke job ran **4 Playwright tests; 4 passed**. The previously failing Director legacy redirect/heading and Placement workflow titles therefore passed in this run.

The Production Quality workflow's `Production deployment smoke checks` job was skipped because this was a pull-request run. No production deployment was run or requested. A passing CI suite does not equal physical-device or full functional-parity sign-off.

### Remaining release limitations

- **Android/iOS device verification: NOT RUN.** React Navigation tab-back history is covered by the native structural regression test and Android/iOS JS bundle exports passed, but no physical device/emulator was available to verify hardware Back, system gestures, modal/drawer behavior, or auth transitions end-to-end.
- **Full ERP mobile parity: IN PROGRESS / IMPLEMENTED_UNVERIFIED by workflow.** The generic module surfaces and the dedicated screens documented in `MOBILE_FEATURE_PARITY.md` do not establish every create/edit/approval/import/export/offline/deep-link workflow as complete. Continue from the existing tracker; do not claim 100% parity.
- **Dependency advisory: UNRESOLVED.** The committed `mobile/package-lock.json` is lockfile v3 with 510 package entries. It locks `node-forge@1.4.0` under the Expo CLI/code-signing dependency path (`@expo/cli@57.0.31` / `@expo/code-signing-certificates@0.0.6`); `node-forge` is required there at `^1.3.3`. The upstream advisory [GHSA-86w9-cpqp-85rv / CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv) reports versions through 1.4.0 as affected and lists no patched version as of this audit (2026-10-17). Do not claim this is fixed by successful builds or downgrade the Expo/RN stack blindly; monitor for a compatible upstream fix or a coordinated toolchain update. This environment did **not** run a fresh full `npm audit`, so the earlier documented count of 22 advisories is historical rather than a current scan result.


## Native finance workflow slice — 2026-10-17

- Starting feature-branch HEAD for this slice: 2f07a6db1a1e2f06bf22804313e8219c89b81be6. Production is not an implementation target.
- Added a dedicated native Finance Workspace via existing module navigation. It reads authorized fee structures, the first invoice page, payment status and refund queue from existing ACADLYX APIs, with loading/empty/retry/error states and query invalidation after successful changes.
- Wired fee-structure transitions to existing server routes: draft creator submission, Chairman-only direct publish (session role and permission gate), pending non-creator approval, and rejection with reason. This does not imply fee-structure creation/editing or student assignment UI.
- Wired refund request from a successful payment, approval of REQUESTED refunds, and processing of APPROVED refunds. Each action remains subject to backend permission, financial-balance, institutional/workspace-scope and state checks.
- Aligned invoice/payment/refund queue middleware with granular permissions already enforced in the respective service functions. Refund approvers and processors can read the scope-filtered queue without receiving broad fee-read permissions.
- Added static source-contract coverage for native routes, permissions and existing backend transition handlers. This is not a live API integration result, payment-provider proof, or device test.
- Remaining finance gaps include invoice create/cancel, offline payment/checkout/confirmation, fee assignment, concessions/reconciliation, receipt download, audit/export and complete pagination. Functional status stays IN_PROGRESS until CI, integration and device evidence pass.

### Dependency security re-check — 2026-10-17

- Lockfile v3 pins node-forge 1.4.0 via expo/node_modules/@expo/cli 57.0.31 and @expo/code-signing-certificates 0.0.6, which itself depends on node-forge. The path is Expo CLI/signing tooling; a compiled runtime-bundle search was not run, so this does not claim the vulnerable package is absent from every shipped artifact.
- Official GHSA-86w9-cpqp-85rv / CVE-2026-85393 still lists all node-forge versions through 1.4.0 as affected and no patched release as of 2026-10-17. No lockfile deletion, incompatible Expo/React Native downgrade, blind override, or home-grown cryptographic patch was applied.
- Safest interim mitigation is to keep signing/build operations in trusted developer/CI environments and avoid using this affected verification path on untrusted signature/certificate inputs. Monitor the upstream advisory and Expo dependency updates. This remains a security sign-off item for workflows relying on the affected verifier. The previously documented 22-advisory total is historical; this turn did not run a fresh full npm audit.


## Native examination workflow slice — 2026-10-17

- Added a dedicated mobile examination workspace using the canonical session, schedule marksheet and transition endpoints. The generic read-only renderer no longer handles the Examinations module.
- Staff flows include partial draft saves, complete-roster submission, submitted-mark approval, locking only after every displayed eligible candidate is approved, and enqueueing publication only after the schedule is locked. The screen reports action errors and publication job status; the backend remains authoritative for permissions, roster scope, maker-checker and state transitions.
- Student/Parent effective roles do not use the staff marksheet endpoint; their personal results stay on the dedicated self-service APIs. A service-boundary guard denies roster-level marksheet reads to Student/Parent roles.
- Registration-required marksheets are limited to registered, eligible candidates; schedule locking now counts the same eligible candidate set as mark entry. Source-contract tests cover the role guard, candidate selection, endpoints and UI permission gates.
- State remains IN_PROGRESS until the current commit's checks pass, followed by isolated live API and physical-device verification. Rooms, seating, invigilators, exam attendance, hall tickets, file downloads, corrections/revaluation and full publication-job lifecycle remain incomplete.

## Native internal-mark workflow slice — 2026-10-17

- Added a dedicated native internal-mark screen. Faculty load only assigned courses through /faculty/me/course-offerings, then the ownership-gated /course-offerings/:id/roster and /internal-marks?courseOfferingId=...&component=... APIs populate roster rows and saved component marks.
- Save calls the existing POST /internal-marks contract with courseOfferingId, component, maxMarks and records. Client validation checks numeric ranges; the server independently enforces owning faculty or institution-wide authority, roster membership, institutional scope, component bounds and maximum marks. Blank entries are omitted so partial saves do not zero or erase untouched students.
- Authorized Director, Dean, HOD and institution/examination roles use a scoped read-only list. Student and Parent are excluded from the staff marks module and keep the dedicated individual results screens.
- Added a Faculty dashboard quick action, dedicated module dispatch, role gating and source-contract assertions referencing the backend validator/service and the existing web marks-entry workflow.
- State remains IN_PROGRESS until CI passes and a real authorized Faculty API test plus Android/iOS device checks are recorded. Result approval/correction and export workflows are not implied; they are not implemented by the existing internal-marks API.


## Native student performance/results slice — 2026-10-17

- Changed the student portal's Performance tab to GET /examinations/my/performance, which returns approved/published examination marks plus non-duplicated legacy result rows. Internal assessment component marks are fetched separately from GET /students/me/marks.
- Added a Published Results tab backed by GET /examinations/my/results; publication status remains the backend source of truth. Performance/results are displayed as domain fields rather than raw object dumps.
- Added an authenticated PDF download helper that uses the mobile bearer token, retries once after the existing refresh-token flow, validates content type and PDF signature, writes to app cache and hands off to native preview/share. It calls the existing results.read-protected marksheet endpoint; the backend applies assertCanViewStudent before document generation.
- Exposed My Performance and Published Results from the student dashboard and module catalog. StudentPortal follows changed initialTab navigation parameters. Source-contract coverage includes API routes, the permission boundary, token refresh and PDF validation.
- Grade/semester aggregation, live API-role tests and physical-device PDF verification remain open. Status remains IN_PROGRESS pending CI and device evidence.


## Native documents reader slice — 2026-10-17

- Replaced the generic module record renderer for Documents with a dedicated native reader using GET /portal/documents/me. The endpoint authorizes documents.read and the service resolves records for the authenticated actor's institution and ownerId.
- Added refresh, loading, retry/error, empty states, and open-document action. The app rejects non-HTTP(S) schemes before handing a returned URL to the operating system. It does not invent a storage URL or allow the client to choose another user's ownerId.
- This slice is intentionally read/open only: it does not present upload or delete controls because the existing portal record API and file-storage module permissions do not grant a generic self-upload action. Administrators' scoped document management still needs its own schema-validated native workflow. Native binary download/import/export and physical-device document handler tests remain open.
- Functional state remains IN_PROGRESS pending CI and isolated API-role checks.

## Native LMS workspace slice — 2026-10-19

- Added a dedicated Learning Management mobile workspace backed exclusively by the existing LMS production routes. It discovers only server-authorized course offerings through `GET /lms/catalog`, opens `GET /lms/offerings/:id/workspace`, and renders course modules, lessons, linked resources, assignments, quizzes, live classes and announcements.
- Resources and live meeting links are opened only when the server has supplied an HTTP(S) URL. Assignment submission/review continues to use the dedicated Assignments workspace rather than duplicating a separate submission state machine.
- The workspace supports server-authorized course lifecycle actions (`SUBMIT`, `APPROVE`, `REJECT`, `PUBLISH`, `ARCHIVE`, and `REOPEN`) through the existing workflow endpoint, and lets eligible non-parent users post course discussions. Query invalidation refreshes both the selected workspace and its catalogue after successful mutations.
- This is an implementation slice, not a claim of full LMS parity: native lesson/material authoring, quiz attempts/grading, live-class scheduling, gradebook, analytics, certificate requests, uploads and physical-device validation remain outside this slice.
