# ACADLYX Full Repository Audit — Production-Readiness Continuation

**Audit date:** 2026-10-10  
**Repository:** `acadlyx/acadlyx`  
**Verified production branch:** `production-upgrade-2026-09-20`  
**Verified production HEAD at baseline:** `b48cd1dd3ead99b7008095b532dff7e4639b2267`  
**Remediation branch created from that HEAD:** `production-readiness-completion-2026-10-10`  
**Decision:** **NO-GO — multiple mandatory gates remain unverified.**  
**Production changes:** none. No merge, deployment, production migration, live setting change, or repository security setting change was performed.

## 1. Method and evidence boundary

Repository metadata and file contents were read through the GitHub integration. The recursive Git tree was not truncated. A writable local checkout, isolated application runtime, browser automation, and disposable PostgreSQL service were not available to this assistant during this continuation. Therefore, source edits made through the GitHub Contents API and hosted CI are distinguished from tests that would require a running application/database. No local test execution or browser verification is claimed.

The production commit has a successful configured CI run: [run 38041145591](https://github.com/acadlyx/acadlyx/actions/runs/38041145591). The observed jobs passed backend typecheck/build/lint/tests, frontend typecheck/lint/build, Prisma migration validation against a clean PostgreSQL 16 database, and configured production smoke checks. This is exact-commit CI evidence, not proof of untested concurrency, existing-data migrations, or recovery behavior.

## 2. Repository inventory

| Inventory | Observed count | Interpretation |
|---|---:|---|
| Git tree entries | 1150 | Complete recursive tree response; not truncated |
| Frontend App Router page/layout source files | 233 | All paths are enumerated in the UI audit appendix |
| Backend route/controller source files | 90 | File inventory only; endpoint-by-endpoint authorization not yet proved |
| Backend service source files | 83 | File inventory only; domain behavior not fully integration-tested |
| Prisma models | 107 | Model names extracted from current schema |
| Test-related paths | 28 | Path-pattern inventory; not equivalent to test count or coverage |
| CSS/SCSS/Sass files | 5 | `frontend/src/app/acadlyx-contrast.css`, `frontend/src/app/acadlyx-dashboard-tokens.css`, `frontend/src/app/acadlyx-modal-responsive.css`, `frontend/src/app/acadlyx-responsive.css`, `frontend/src/app/globals.css` |

## 3. Architecture signals confirmed from source

- Frontend and backend are separate packages with independent lockfiles and build scripts.
- Backend uses Express, TypeScript, Prisma and PostgreSQL; Prisma schema declares 107 models.
- Backend CI previously configured a PostgreSQL URL for the test job but did not provision PostgreSQL in that job. A separate migration job did provision PostgreSQL, which did not make a database available to backend tests.
- The backend quality workflow has now been changed on this remediation branch to provision PostgreSQL 16 and run `prisma migrate deploy` before the backend test command. This makes a disposable migrated database available to tests; it does **not** itself add or prove database integration/concurrency tests.
- Production quality workflow includes a production smoke job gated to pushes on the production branch; pull-request runs do not execute that live smoke job.
- Finance source resolves Director scope through `getDirectorCampusIds`; a code path exists, but HTTP-level access denial and filter-manipulation tests remain unverified.
- The library service computes policy-driven fines/replacement charges and links fine records to financial invoices; exactly-once reconciliation under concurrent retries remains unverified.
- Existing audit reports explicitly record unrun HTTP isolation, real financial concurrency, populated-data migration, restore, end-to-end workflow, and capacity tests.

## 4. Highest-priority release blockers

1. Real PostgreSQL payment/refund concurrency with overlapping independent connections and persisted-state assertions.
2. Authenticated HTTP isolation tests for institutions, campuses, departments, students, parents, files, exports and nested resources.
3. Library-to-finance exactly-once behavior under concurrent retries and reversals.
4. Populated legacy-data migration compatibility.
5. A real backup/restore rehearsal with measured duration and explicit, approved RPO/RTO targets.
6. Route-by-route UI/CSS trace and visual verification.
7. Representative workload measurements for the stated 10,000+ student capacity.
8. Production branch protection and required-check governance. Branch settings were not changed because the task explicitly disallows unauthorized security-setting changes.

## 5. Commands and checks evidenced

| Check | Evidence | Result |
|---|---|---|
| Backend typecheck/build/lint/tests | [Production CI run 38041145591](https://github.com/acadlyx/acadlyx/actions/runs/38041145591) | Passed on `b48cd1dd3ead99b7008095b532dff7e4639b2267` |
| Frontend typecheck/lint/build | Same exact-SHA run | Passed on `b48cd1dd3ead99b7008095b532dff7e4639b2267` |
| Prisma clean-database migrations | Same exact-SHA run; PostgreSQL 16 service in migration job | Passed on `b48cd1dd3ead99b7008095b532dff7e4639b2267` |
| Production deployment smoke | Same exact-SHA run | Passed as configured; does not substitute for E2E business tests |
| Backend PostgreSQL test service | Workflow edit on this branch, commit to be recorded in final branch state | Added in workflow source; candidate CI still required |
| Payment/refund DB concurrency | Not run here | UNVERIFIED |
| HTTP tenant/scope isolation | Not run here | UNVERIFIED |
| Populated-data migration | Not run here | UNVERIFIED |
| Backup/restore | Not run here | UNVERIFIED |
| Browser visual verification | No browser automation available here | UNVERIFIED |

## 6. Remediation branch safety

All new edits in this continuation are made to `production-readiness-completion-2026-10-10`, created from the exact production HEAD above. Production remains unchanged. The final branch SHA must be recorded after all commits and its own CI must pass; CI from a parent SHA is not proof for later edits.

## 7. Release decision

**NO-GO.** Green build and configured smoke checks are necessary but insufficient while critical data-integrity, authorization, migration, restore, visual and capacity gates are unverified. This report deliberately does not claim a 100% readiness score.


## Final-candidate evidence rule

The GitHub PR head is authoritative for final verification. Because each commit changes the candidate SHA, do not reuse checks from a predecessor commit as final evidence. Before any release decision, record the current branch HEAD and inspect all required check runs attached to that exact SHA. The current report is intentionally not a GO approval.
