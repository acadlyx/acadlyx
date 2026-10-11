# Chairman & Director Production Readiness

## Decision: NO-GO pending verification

This branch is not declared production-ready. The first targeted correction addresses a confirmed scope bypass, but does not satisfy the full acceptance matrix.

### Verified evidence
- Repository: `acadlyx/acadlyx`.
- Baseline production branch head observed: `879a0dc54797d2bee70ed5df80117af456e16c98`.
- Isolated implementation branch created: `chairman-director-enterprise-workspaces-2026-10-11`.
- Existing `CampusAccess` lookup in `backend/src/services/accessScope.service.ts` is the intended source of Director campus IDs.
- `backend/src/services/erp.service.ts` previously returned from `assertStudentScope` for every role in `MANAGEMENT_ROLES`; that list included DIRECTOR. This allowed a Director to skip the assigned-campus student enrollment check.
- The implementation branch changes that helper to resolve Director department IDs from CampusAccess and require an active enrollment in one of those departments before allowing access. It also tenant-binds management access other than explicit SUPER_ADMIN.
- Added `backend/src/__tests__/director-student-scope.contract.test.ts` as a source-level regression guard. This test has not been executed in this environment and does not replace database-backed tests.
- Updated Chairman finance navigation entries to route to `/chairman/fees` and `/chairman/fees/collections` instead of generic shared routes.

### Not yet verified
- Local working-tree status and uncommitted changes (the available method is GitHub repository API, not the user's local checkout).
- Frontend build, TypeScript, lint, backend test suite, integration tests, migrations, browser E2E, and live API tests.
- Chairman institution membership relationships where a Chairman can have multiple institutions.
- Every analytics aggregate, search, export, and mutation in both workspaces.
- Every visible navigation action and return destination.
- Financial thresholds, maker-checker rules, stale-state concurrency, and idempotency across all approval workflows.
- Session revocation/cache invalidation and cross-role cache isolation.
- LMS and Events & Gallery regression behavior.

## Batch log

### Batch 1 — Repository verification and architecture discovery
- Confirmed repository API access and fetched the named production branch head.
- Created the implementation branch from the exact observed production commit; production ref was not written by this operation.
- Inspected the Chairman/Director route trees, dashboards, fee approval page, shared workspace endpoint, and scope helper.
- Identified a Director student-record scope bypass and documented the existing route inventory.
- Exit gate: partially met. Branch isolation and initial gap evidence are established; local worktree and reproducible local test baseline are unavailable through the repository API.

### Batch 2 — Scope and authorization foundation (partial)
- Corrected the Director path in `assertStudentScope` so the Director role no longer inherits the management bypass.
- Director student access now requires an active enrollment whose program department is derived from assigned campus IDs.
- Management shortcut is tenant-bound except for explicit SUPER_ADMIN.
- Added a source-level regression contract test; it remains unexecuted. Cross-campus behavior, Chairman multi-institution assignment, and endpoint-wide scope are not verified.
- Exit gate: NOT PASSED pending runtime and integration tests.

### Batch 3 — Workspace routing (partial)
- Chairman finance sidebar links now remain under the Chairman route namespace for finance overview and collections.
- Existing Chairman/Director routes remain separate; additional generic links and the Director operations destinations still require a full route/action audit.
- Exit gate: NOT PASSED.

### Remaining batches
- Batch 3: separate route trees, effective navigation, shell continuity, and scoped context.
- Batch 4: real institutional/campus aggregates and data freshness.
- Batch 5: independent backend-backed approval queues and transactional decisions.
- Batch 6: risk/action/compliance intelligence with real data.
- Batch 7: automated route/button interaction audit.
- Batch 8: security and regression tests.
- Batch 9: complete release verification.

## Test commands to run in a writable checkout
- `cd backend && npm test`
- `cd backend && npm run typecheck`
- `cd backend && npm run lint`
- `cd frontend && npm run validate:source`
- `cd frontend && npm run typecheck`
- `cd frontend && npm run build`

Record command output and environment details; do not convert unavailable checks into passes.


## Latest repository verification (2026-10-11)
- Implementation branch head: `b13497bfb5e6df3a501b3e97140559d128ffac01`.
- Production branch head re-read after the implementation writes: `879a0dc54797d2bee70ed5df80117af456e16c98` (unchanged).
- GitHub compare reports implementation branch `ahead` by 8 commits and `behind` by 0.
- GitHub combined commit statuses returned no status checks; workflow-run lookup returned no runs for this commit. This is **not** evidence of a passing build or test suite.
- The available access path writes repository files through the GitHub API; it does not expose the user's local working tree or a runnable checkout in this session. No local build, typecheck, lint, unit test, database test, or browser test has been claimed as executed.
