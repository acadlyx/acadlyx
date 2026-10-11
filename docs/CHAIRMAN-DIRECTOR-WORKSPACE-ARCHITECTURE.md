# ACADLYX Chairman & Director Workspace Architecture

Baseline: `production-upgrade-2026-09-20` at `879a0dc54797d2bee70ed5df80117af456e16c98` (2026-10-11). Implementation branch: `chairman-director-enterprise-workspaces-2026-10-11`.

## Authorization contract

All protected operations follow **ROLE → WORKSPACE → INSTITUTION/CAMPUS CONTEXT → ENTITY → ACTION**. The browser is a presentation layer, not a security boundary. The backend must derive actor identity from the authenticated context and must apply tenant, campus, resource, permission, and workflow-state constraints before reading or mutating data.

### Chairman
- Scope: institution(s) explicitly assigned by server-side identity/relationships. No unrelated tenant access.
- Can read and analyze institutional aggregates only after source queries have been tenant-scoped.
- Approval authority is action-specific; viewing or analyzing is not approval authority.
- Financial and other consequential decisions must use canonical workflow endpoints, validations, separation-of-duties rules, and audit events.

### Director
- Scope: only active campuses assigned through the existing `CampusAccess` relationship with `scope = DIRECTOR`.
- Department lists are derived from those campus IDs; department assignments are not a substitute for campus authority.
- Every student/entity lookup and aggregate must filter through the assigned-campus scope.
- Campus-level recommendation is distinct from institution-level final approval.

## Existing implementation discovered

- Dedicated route trees already exist under `frontend/src/app/chairman/` and `frontend/src/app/director/`, including dashboard, operations, examination, fees, reports, placement, OBE, and student pages.
- The current dashboard components both call `/erp/me/workspace`; this endpoint is a shared data source and must not be treated as proof that all returned statistics are appropriately scoped.
- `backend/src/services/accessScope.service.ts` has `getDirectorCampusIds` and derives Director departments from campus assignments.
- The student scope helper in `backend/src/services/erp.service.ts` previously allowed any role in `MANAGEMENT_ROLES` to bypass record scope; because DIRECTOR was in that list, it bypassed the campus check. The implementation branch now checks Director campus enrollment before any management shortcut.
- Existing fee-structure approval APIs and the Chairman fee-approval page are canonical functionality to preserve, not duplicate.

## Workspace boundaries

- Chairman operational routes belong under `/chairman/**`; Director operational routes belong under `/director/**`.
- Shared infrastructure is limited to authenticated API clients, dashboard shell/layout primitives, and canonical domain APIs that independently enforce scope.
- A route's role guard and hidden navigation are UX controls only. Every API read, detail, aggregate, export, and mutation independently enforces backend scope.
- No client-provided actor ID, institution ID, campus ID, or role is trusted without server-side relationship validation.

## Data quality

Metrics must distinguish a true zero from unavailable, stale, or incomplete source data. Reports should state their period and freshness. Do not substitute hardcoded arrays or invented recommendations for domain data.

## Validation status

This architecture document records code inspection and a targeted security correction. A remote GitHub write is not equivalent to a writable local checkout or executable test environment. Build, TypeScript, lint, integration, browser, database, and live tenant-isolation checks remain unverified until run against the implementation branch.
