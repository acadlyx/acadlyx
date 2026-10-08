# ACADLYX Full Platform Production Audit — 2026-10-08

## Scope

Repository-wide static audit plus live Supabase production-database verification on `production-upgrade-2026-09-20`.

This document records evidence available through the repository/connected production database. It does not claim browser-authenticated E2E coverage where credentials/runtime traversal are unavailable.

## Confirmed root causes / fixes in this pass

### Library

1. **Damaged-copy inventory bug**
   - `returnBook` previously incremented `availableCopies` for DAMAGED books.
   - A damaged copy must leave circulation.
   - Fixed to reduce aggregate `totalCopies` without returning the copy to available stock.
   - Lost and damaged operations remain transactional and tenant-scoped.

2. **Missing late-return fine workflow**
   - Added authorized `POST /library/loans/:id/impose-late-fine`.
   - Requires `library.manage` and the Library entitlement.
   - Only active overdue ISSUED loans can be charged.
   - Uses the canonical Fees invoice architecture.
   - Uses a deterministic source event key so retries cannot create duplicate financial obligations.
   - Existing settled amounts are preserved when an overdue amount is refreshed.

3. **Student library balance correctness**
   - Student/library loan responses now expose the canonical outstanding invoice balance.
   - Student UI uses that balance instead of treating historical `fineAmount` as the current amount due.

### Authorization / access denial

4. **Stale cached RBAC could cause false access denial**
   - `DashboardShell` used cached `/auth/me` permissions for immediate route authorization while refreshing them in the background.
   - After RBAC/entitlement changes, a stale cache could redirect a legitimately authorized user to their workspace with an access-denied experience.
   - Fixed route authorization to wait for one fresh `/auth/me` reconciliation while still using the cached user for immediate rendering.

## Production database verification

- Active institutions: 1.
- Library entitlement: enabled for the active institution.
- Fees entitlement: enabled for the active institution.
- STUDENT role has `library.read` and `library.borrow`.
- Library permissions catalog contains read, borrow, manage and fine-waiver capabilities.
- Library issues: 1.
- Library fines: 1.
- Library-sourced fee invoices: 1.
- Orphan library fines: 0.
- Cross-institution library fine mismatches: 0.
- Library inventory rows with negative/invalid stock relationships: 0.
- Prisma migrations applied: 63.
- Prisma migration history rows: 64, including one historical migration that was rolled back after a SQL syntax failure and subsequently superseded/recovered.
- Latest applied migration: `20261008140000_placement_drive_opportunity_link`.
- Supabase security advisors: 0 findings.
- Supabase performance advisors report informational index/foreign-key findings across the wider schema; these require workload-based prioritization and must not be blindly indexed.

## Verification limitations

The connected repository interface cannot execute the complete local Node/Next.js toolchain in this session. The current branch therefore requires a fresh GitHub Actions/CI run after these changes before claiming frontend/backend build, lint, typecheck and test success.

Authenticated browser traversal of every role/device/module is also unavailable through the repository connector. In particular, the following require final runtime execution:

- student Library browser journey;
- librarian circulation journey;
- lost/damaged/fine end-to-end financial settlement;
- Fees/Examination/Course Registration/Placement/CMS role journeys;
- adversarial two-tenant authorization;
- mobile visual traversal at all requested breakpoints;
- production deployment smoke after the latest commits.

## Acceptance posture

**Not yet 100% production-verified.**

The code changes in this audit target root causes rather than weakening RBAC or replacing backend operations with mock data.


---

# Role Workspace / Student Profile / RBAC Hardening — 2026-10-09

## Status legend

- **FIXED** — root cause corrected in repository or authoritative RBAC data.
- **VERIFIED** — directly confirmed by repository/database inspection.
- **PARTIALLY VERIFIED** — implementation and static scope checks confirmed, runtime role traversal still required.
- **UNVERIFIED** — no authenticated runtime evidence available.
- **BLOCKED** — verification requires unavailable execution/browser infrastructure.

## Role workspace inventory

| Role | Dashboard workspace | Student/profile entry | Scope model | Status |
|---|---|---|---|---|
| Super Admin | `/superadmin` | Platform user/institution administration | Platform | VERIFIED |
| Institution Admin | `/admin` | `/admin/students` | Institution | VERIFIED |
| Chairman | `/chairman` | Leadership/oversight routes | Institution/group | VERIFIED |
| Management | `/management` | Leadership/oversight routes | Institution/group | VERIFIED |
| Director | `/director` | `/director/students` → profile | Assigned campus/derived departments | PARTIALLY VERIFIED |
| Dean | `/dean` | `/dean/students` → profile | Managed academic departments | PARTIALLY VERIFIED |
| Registrar | `/registrar` | `/registrar/students` → profile | Institution | PARTIALLY VERIFIED |
| HOD | `/hod` | HOD student directory/tab → profile | Managed department | PARTIALLY VERIFIED |
| Faculty | `/faculty` | My Students section → profile | Assigned teaching sections/registrations | PARTIALLY VERIFIED |
| Accounts | `/accounts` | Financial student workflows | Institution + financial permissions | PARTIALLY VERIFIED |
| HR | `/hr` | Employee workspace | HR domain | VERIFIED |
| Admissions | `/admissions` | Admission/student workflows | Institution + admissions permissions | VERIFIED |
| Examination | `/examination` | Examination student context | Institution + examination permissions | PARTIALLY VERIFIED |
| Librarian | `/library` | Library member workflows | Library-specific access | PARTIALLY VERIFIED |
| Placement | `/placements` | `/placements/students` operational entry exists in workspace UI; API scope is placement-qualified | Explicit placement relationship | PARTIALLY VERIFIED |
| IT | `/it` | Operations/technology workspace | IT permissions | VERIFIED |
| CMS | `/site-content` | CMS workspace | CMS permissions | VERIFIED |
| Student | `/student` | Own profile/self-service | Own record | VERIFIED |
| Parent | `/parent` | Linked-child workspace | Parent-student link | VERIFIED |

## Confirmed security/root-cause fixes

### 1. Student profile route authorization

The shared student detail API already enforced institution and resource scope through `getStudentWhereScope()` before loading the record. The frontend profile route, however, only admitted Institution Admin, Registrar and HOD roles.

**FIXED:** the profile route now permits the additional roles that have `students.read` and an applicable backend scope: Chairman, Management, Director, Dean, Faculty, Accounts, Admissions, Examination and Placement.

This does not grant access by itself. The backend remains the final authorization boundary.

### 2. Placement student scope was too broad

The Placement role previously received an institution-wide student query scope. That allowed a Placement user to retrieve any student in the tenant, even when the student had no placement relationship.

**FIXED:** Placement student reads now require an explicit placement relationship:
- Placement Profile, or
- Placement Academic Snapshot, or
- Placement Application.

The same relationship check is applied to direct student-detail access. A Placement URL cannot bypass this scope.

### 3. Restricted student-profile fields

The canonical student detail service returned the complete StudentProfile object to every authorized student reader. That exceeded least-privilege expectations for Placement, Librarian, Accounts and Examination.

**FIXED:** those specialist roles receive a restricted master-profile projection containing the identifiers needed for their operational context (including admission number/status), while sensitive master-profile fields such as address, date of birth, guardian contacts and emergency contacts are not returned through the generic student-detail contract.

Specialist financial, examination, library and placement data must continue to come from their own permissioned module services rather than being implicitly attached to the generic student profile.

### 4. Leadership/student scope alignment

Chairman and Management were documented as oversight roles but were not included in the central institution-wide student scope used by the student service.

**FIXED:** both roles are now included in the explicit institution-wide read scope. This does not add specialist mutation permissions.

### 5. Examination workspace dependency

The Examination workspace required campus context selectors but the EXAMINATION role lacked `campuses.read`.

**FIXED:** EXAMINATION has `campuses.read` in the canonical RBAC definition and the authoritative role-permission binding. Campus create/update/delete permissions remain denied.

### 6. HOD / Faculty profile entry points

- HOD navigation remains inside the HOD workspace and the HOD student directory now exposes **View Full Profile**.
- Faculty workspace now loads students from the server-side faculty scope and exposes **View Full Profile** for those students.
- Director, Dean and Registrar already use role-owned student directory entry pages with profile links.
- The generic `/students` page remains Institution Admin-owned; specialist roles are not being granted access to that page merely to make navigation work.

## Authorization matrix

| Role | Student read policy |
|---|---|
| Chairman / Management | Institution/group oversight scope |
| Director | Campus-derived department scope |
| Dean | Assigned department scope |
| HOD | Managed department scope |
| Faculty | Active teaching sections / approved registrations |
| Registrar | Institution scope |
| Examination | Institution scope, with examination-specific data handled separately |
| Accounts | Institution scope, with financial data permissioned separately |
| Placement | Placement-qualified students only |
| Librarian | Library-specific access; generic profile is restricted |
| Institution Admin | Institution scope |
| Student | Own record through self-service |
| Parent | Linked child through parent-specific APIs |
| Super Admin | Platform policy; not granted specialist operational permissions by default |

## Files changed in this pass

- `backend/src/services/accessScope.service.ts`
  - Tightened Placement student scope.
  - Added placement relationship validation for direct profile access.
  - Added Chairman/Management to explicit institution-wide student-read scope.
- `backend/src/services/studentAdmin.service.ts`
  - Added role-aware restricted profile projection.
  - Preserved server-side scope validation before record retrieval.
- `frontend/src/app/students/[id]/page.tsx`
  - Allows authorized institutional roles to use the canonical profile page.
- `frontend/src/app/hod/page.tsx`
  - Added HOD **View Full Profile** action.
- `frontend/src/app/faculty/page.tsx`
  - Added server-scoped My Students section and profile entry action.
- `frontend/src/components/dashboard/RoleScopedStudents.tsx`
  - Reduced initial directory page size and added configurable profile entry path.
- `frontend/src/lib/navigation.ts`
  - Kept HOD student navigation inside the HOD workspace.
  - Added Faculty My Students navigation to the Faculty workspace.
- `backend/src/__tests__/authorization-foundation.test.ts`
  - Added student-reader permission matrix coverage.
  - Added Examination campus read-only permission regression coverage.

## Verification passes

### Pass 1 — Architecture / inventory
**PARTIALLY VERIFIED**

Repository inspection confirmed dedicated dashboard components/routes for the major institutional roles, including Director, Dean, Registrar, HOD, Faculty, Accounts, HR, Admissions, Examination, Library, Placement, IT, CMS, Student and Parent. Placement has its own operational command center at `/placements`.

Remaining architectural debt: some specialist directory experiences still rely on the existing shared student-detail route rather than fully separate `/<role>/students/[id]` route modules. The shared route is server-authorized and role-aware; this is not being represented as a false 100% independent-route result.

### Pass 2 — Authorization / data isolation
**FIXED / PARTIALLY VERIFIED**

Static inspection confirmed:
- institutionId is derived server-side;
- student reads pass through `getStudentWhereScope`;
- Director scope derives from assigned campuses;
- Dean/HOD scope derives from department access;
- Faculty scope derives from active course offerings;
- Student scope is self-only;
- Parent uses linked-child APIs;
- Placement now requires an explicit placement relationship.

### Pass 3 — Implementation
**FIXED**

Root-cause changes were committed without weakening backend authorization or removing tenant checks.

### Pass 4 — Regression tests
**UNVERIFIED**

The authorization foundation test suite was extended, but the connected repository environment does not execute the local Node test runner.

### Pass 5 — Fresh source re-audit
**PARTIALLY VERIFIED**

Re-read of the modified access-scope, student service, profile route, navigation and role-workspace files confirmed the intended changes are present in the final code state.

### Pass 6 — Adversarial runtime authorization
**BLOCKED**

Authenticated browser/API execution for multiple real users, departments, campuses and tenants is not available through the connected repository environment. Therefore direct tampering tests are not claimed as executed.

Required runtime cases:
- HOD MCA → B.Tech student denial.
- Faculty URL student-ID substitution denial.
- Director unrelated-campus denial.
- Placement unrelated/unqualified-student denial.
- Parent unlinked-student denial.
- Cross-tenant student-ID denial.
- Disabled entitlement direct-URL/API denial.
- stale-session authorization refresh.

### Pass 7 — Independent final verification
**PARTIALLY VERIFIED**

Final source-state inspection was performed after the material changes. CI/build/test results for this newest commit are **UNVERIFIED** until GitHub Actions executes them.

## Known remaining risks / blockers

1. Authenticated browser traversal of every role is unavailable.
2. The connected GitHub interface cannot execute the complete frontend/backend toolchain directly.
3. Fully independent `/<role>/students/[id]` route modules remain an architectural follow-up; the current canonical profile endpoint is role-aware and server-scoped.
4. Placement operational subroutes should be runtime-tested for pagination and data minimization independently of the student-profile fix.
5. Mobile visual verification at the requested breakpoints remains UNVERIFIED.

## Final acceptance posture

**PARTIALLY VERIFIED — not 100% production verified.**

The critical discovered authorization defects in this pass were fixed at the server-side scope/RBAC layer. No frontend-only authorization bypass was used, no tenant checks were removed, and specialist profile access was narrowed rather than broadened indiscriminately.
