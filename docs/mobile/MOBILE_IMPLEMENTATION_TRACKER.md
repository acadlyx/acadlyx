# ACADLYX native mobile implementation tracker

Last audited on the authorized branch `native-mobile-parity-2026-10-17` at
`ad43c6ff6a97af9f9a6f3f89a24d6ec3a321b47e`.

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
| Finance, examinations, LMS, placements, CMS, files, imports/exports, assistant | `MOBILE_FEATURE_PARITY.md` route matrix | IN_PROGRESS / NOT_STARTED by route | Implement only against inspected existing contracts |
| Native build/device verification | Expo configuration | BLOCKED | No simulator/device or build service evidence has been supplied in this environment |
| Dependency security remediation | `mobile/package-lock.json` | BLOCKED | `npm audit --omit=dev --json` reports 22 upstream advisories (15 high, 7 moderate). `npm audit fix --dry-run` proposes incompatible major downgrades to Expo 44 / React Native 0.72 while this app is Expo 57 / React Native 0.86; affected paths include Expo CLI → code-signing/Metro and React Native → community CLI/Metro. A reviewed supported-SDK upgrade is required. |

## Verification log

| Check | Result | Date |
|---|---|---|
| `mobile: npm test` | PASS — 13 tests on earlier head; Priority 1 context-transition tests added and latest run pending | 2026-10-17 |
| `mobile: npm run typecheck` | PASS | 2026-10-17 |
| `mobile: npm run doctor` | PASS — 21/21 Expo checks after adding `package-lock.json` | 2026-10-17 |
| `mobile: npm audit --omit=dev --json` | 22 advisories — 15 high, 7 moderate, 0 critical; remediation requires a reviewed Expo/React Native compatibility update | 2026-10-17 |
| `backend: workspace-context-role.contract.test.ts` | PASS on earlier head — source contract for effective-role and hierarchy guards | 2026-10-17 |
| `backend: workspace-context-isolation.integration.test.ts` | ADDED; latest CI pending — real Express API + disposable PostgreSQL; all 20 roles, multi-role priority, seven context dimensions, revocation, deleted/foreign IDs, direct unauthorized list calls, tenant/student isolation | 2026-10-17 |
| `backend: npm run typecheck` | PASS on earlier head; latest Priority 1 service/controller/test changes pending CI | 2026-10-17 |
| Production live API smoke tests | NOT RUN | No production records or production credentials were used. The new API suite runs only against isolated CI PostgreSQL; its latest result is pending. |
| iOS / Android build | NOT RUN | No simulator/device or build credentials available |
