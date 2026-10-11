# ACADLYX Role, Workspace, and RBAC Audit

**Status:** PARTIAL SOURCE REVIEW — runtime verification outstanding  
**Evidence date:** 2026-10-11  
**Branch:** `production-readiness-completion-2026-10-10`

## Verified source-level observations

- Authorization is permission-based; the backend `authorize` middleware is the security boundary. Role grants, data scope, and workflow dependencies are distinct.
- The Student role includes `library.read` and `library.borrow`, but does not include staff `students.read`.
- The Library self-service route `GET /library/loans/mine` uses `authorize("library.borrow")` and obtains the user from the authenticated request. The service filters loans by `institutionId` and `actor.id`.
- The remediation removes `students.read` only from the `library.borrow` workflow dependency. The staff `library.manage` dependency still requires `students.read`; tests assert this distinction.
- The Student examination self-service routes `/my/performance` and `/my/results` authorize `exams.read` and `results.read`, respectively, and pass `actor.id` to service methods. The underlying performance queries constrain institution and student IDs and gate current workflow marks by approved/published status.
- The Accounts role has `fees.structure.read`, `fees.structure.manage`, `academic-years.read`, and `semesters.read`. The fee structure API uses these exact fee permissions and the fee-structure service checks canonical action-to-permission mappings.

## Change record

- `backend/src/config/rbac.ts`: remove staff student-directory read as a prerequisite for the student self-service borrowing permission; preserve it for staff library management.
- `backend/src/__tests__/library-access.test.ts`: assert self-service borrowing does not require `students.read`; assert staff management continues to require it.

## Not verified

This is not a complete role-by-role authorization certification. No authenticated HTTP test run, browser session, staging database, or seeded multi-institution dataset was available in this execution environment. Do not infer that a role has correct runtime scope from role-permission declarations alone.

Required regression matrix:

| Actor / context | Required positive case | Required negative case |
|---|---|---|
| Student | Read own loans, books, own approved/published marks | Read another student's loans/marks; use manipulated student IDs |
| Parent | Read only linked student's permitted information | Unlinked student ID and another institution |
| Librarian | Manage circulation in assigned institution/scope | Cross-institution borrower/book/fine ID |
| Accounts | Read/manage fee structures within permitted institutional scope | Unauthorized refund/payment action; cross-institution structure IDs |
| Institution Admin | Manage allowed institution-level records | Access another institution's records |
| Chairman / Management | Read or approve only actions granted by their actual permission set | Invoke payment/refund/other write permissions not granted |
| Director | Access only assigned campus scope | Another campus or institution |
| HOD | Access only assigned department/program scope | Another department, including another faculty/program |
| Faculty | Access assigned course/section/student scope | Manipulated section, course, student, or marks IDs |
| Examination Cell | Operate permitted examination lifecycle | Read unpublished/unauthorized marks or cross-institution exam IDs |
| Student / Parent / staff negative cases | Expected authenticated and scoped success | Missing token, expired token, revoked session, missing permission, wrong institution, wrong campus/department |

For each row, verify the actual HTTP status and response shape. A 403/404 authorization failure must never be converted into an empty collection in the client.

## Execution record

- A local checkout and runtime test environment could not be obtained because direct Git access from the container failed DNS resolution for `github.com`; remote authenticated GitHub file/branch operations were available.
- Focused tests, backend typecheck/full suite, frontend build, browser tests, and staging HTTP tests were **not run** here.
- No passing result is claimed from static source assertions alone.

## Acceptance criteria

1. Add/run authenticated API tests using real middleware and an isolated database with at least two institutions, two campuses, two departments, and representative roles.
2. Verify positive and negative authorization, direct URL/API access, manipulated resource IDs, and response status semantics.
3. Verify scope at query/service boundaries and tenant isolation under mixed-role users; test actual permission identifiers rather than role-name shortcuts.
4. Run browser tests on desktop and mobile with real authenticated sessions and critical workflows.
5. Review the complete remediation diff for privilege escalation and regression, and record command/output/commit for each check.

**RBAC release status: NOT VERIFIED.**
