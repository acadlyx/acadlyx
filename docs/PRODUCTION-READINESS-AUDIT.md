# ACADLYX Production Readiness Audit

**Status:** NOT YET RELEASE-READY  
**Evidence date:** 2026-10-11  
**Working ref:** `production-readiness-completion-2026-10-10`  
**Protected ref:** `production-upgrade-2026-09-20` (not merged, deployed, or intentionally modified by this remediation)

## Checkout and history evidence

- The remediation branch name was absent at the beginning of this continuation and was created as a separate GitHub branch from `production-upgrade-2026-09-20`.
- The initial compare reported the branch and protected branch at the same commit (`b374877fc0763c140524b96216d5e765132014df`) before remediation commits. Remote API writes then added the commits listed in the change history; the protected ref was not the write target.
- Candidate `f994ac1db1db79ab9bf32d2b52e689a10c2836b0` is an ancestor of the remediation branch: compare reports merge base `f994ac1...`, candidate base with 131 commits ahead and zero behind. It is also an ancestor of the protected branch history; this does not prove release readiness.
- A writable local checkout could not be obtained in this execution environment. Direct Git access failed because `github.com` could not be resolved from the container. Authenticated GitHub repository APIs were available and were used to inspect and write only to the named remediation branch. This is a remote branch edit, **not** a local checkout.

## Implemented fix and source evidence

### Student Library authorization dependency

- `backend/src/config/rbac.ts`: removed the staff-only `students.read` dependency from `library.borrow`. The permission is described in the permission catalogue as personal library services; the student self-service loan route derives the borrower from the authenticated actor, and `listMyLoans` filters by both institution and `actor.id`.
- `backend/src/__tests__/library-access.test.ts`: replaced the prior assertion that explicitly expected students to fail the `students.read` dependency with a regression assertion that self-service `library.borrow` has no missing dependency. Added a guard that staff `library.manage` still requires `students.read`.
- This change does not grant a new role permission or add a blanket bypass. It narrows the dependency for the self-service permission; staff library management retains its existing dependency.

## Critical workflows reviewed but not yet runtime-verified

### Student examination performance

Source inspection found the canonical service `getStudentExamPerformance` scopes both current and legacy marks by institution and student, includes only `APPROVED`/`PUBLISHED` workflow marks, and avoids double-counting legacy exams already represented by the new schedule workflow. Student self-service routes use `actor.id`. The UI combines exam performance and internal marks using `Promise.allSettled` and reports a partial failure rather than treating all failures as an empty result.

This is source-level evidence only. A real authenticated HTTP/browser test against a migrated test database is still required to establish that seeded marks appear for a real student and remain hidden until permitted by the publication workflow.

### Accounts Fee Structures

Source inspection confirms `GET /erp/fee-structures` requires `fees.structure.read`, and creation requires `fees.structure.manage`; the Accounts role has these exact permissions and the UI calls `/erp/fee-structures`. Fee structure and head services check canonical permissions. This does not establish that the end-to-end setup flow works: academic-year, semester, program lookup, persistence, tenant/campus/department scope, and downstream assignment still require authenticated runtime verification.

## Commands and test results

No application test command was executed in this environment: there is no writable local checkout, Node/npm workspace, database, or browser runtime attached to this execution. Do not interpret remote source inspection as test execution.

Commands that must be run in a verified checkout (and recorded with output):

- `npm --prefix backend test -- --test-name-pattern="student self-service borrowing|student performance|fee-structure"` — focused regression tests; adapt to the repository's actual test runner syntax if necessary.
- `npm --prefix backend run typecheck`
- `npm --prefix backend test`
- `npm --prefix frontend run build`
- `npx playwright test` from `frontend` with isolated test database and authenticated fixtures.

The remote GitHub Actions workflow-run query for remediation commit `ad71a362d4f92b474fc469740a099e39f4caea94` returned no associated workflow runs at the time checked, and its combined status returned no statuses. No successful CI result is claimed for these changes.

## Financial integrity, HTTP authorization, browser, load, and recovery gates

The following release gates remain **unverified**:

1. Authenticated HTTP tests for actual role/permission combinations; cross-institution access; campus/department scope; manipulated IDs; positive and negative access cases.
2. Financial concurrency, retry, rollback, idempotency, and persisted ledger consistency against PostgreSQL.
3. Authenticated desktop and mobile browser workflows for Library circulation/fines, examination marks/results, Accounts fee structure create/edit/approve/assign, and related audit trails.
4. Complete application HTTP/API load test with realistic authentication, read/write mix, tenant/scope filters, latency percentiles, error rates, throughput, and resource saturation. Database-only benchmarks are not 10,000-user readiness evidence.
5. Staging backup restoration with integrity checks, migration forward/backward compatibility review, deployment smoke tests, and a timed recovery exercise.
6. Complete module inventory and security review of the final diff.

The backend script `npm run perf:finance` is a finance/database benchmark and is not a substitute for application-level load testing. Do not report 10,000-user readiness from that script alone.

## Release acceptance criteria

Release review remains blocked until all applicable gates above have reproducible evidence, CI passes on the final remediation head, the complete diff is reviewed for tenant/RBAC/financial regressions, staging restore and recovery are demonstrated, and unresolved risks have an explicit owner and acceptance decision. No production migration, destructive operation, merge, or deployment is authorized by this audit.

**Recommendation: NOT YET RELEASE-READY.**
