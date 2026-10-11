# Chairman & Director Route-to-Action Inventory

Baseline: `879a0dc54797d2bee70ed5df80117af456e16c98`. This inventory is deliberately evidence-based: it lists existing route trees found in the repository and separates route existence from verified behavior.

| Workspace | Existing route | Intended capability | Initial verification |
|---|---|---|---|
| Chairman | `/chairman` | Executive command center | Page exists; dashboard reads `/erp/me/workspace`; scope of each statistic requires endpoint verification |
| Chairman | `/chairman/operations` | Operational overview | Page exists; destinations and backend actions require interaction audit |
| Chairman | `/chairman/fee-approvals` | Fee-structure decision queue | Page exists; uses canonical fee structure list/approve/reject API; test maker-checker and scope |
| Chairman | `/chairman/fees` | Finance overview | Page exists; verify query filters and tenant scope |
| Chairman | `/chairman/fees/collections` | Collections analytics | Page exists; verify aggregation and report scope |
| Chairman | `/chairman/examinations` | Examination oversight | Page exists; verify canonical lifecycle and role-specific authority |
| Chairman | `/chairman/intelligence` | Institutional intelligence | Page exists; verify all metrics are sourced and scoped |
| Chairman | `/chairman/obe` | Outcome-based education | Page exists; verify source queries and scope |
| Chairman | `/chairman/placements` | Placement outcomes | Page exists; verify sensitive student data minimization |
| Chairman | `/chairman/reports` | Institutional reports | Page exists; verify export authorization and context |
| Chairman | `/chairman/students` | Enrollment/student lifecycle | Page exists; verify institution scope per record |
| Director | `/director` | Campus command center | Page exists; dashboard reads `/erp/me/workspace`; campus scoping of statistics requires endpoint verification |
| Director | `/director/operations` | Campus operational overview | Page exists; some links currently lead to global routes such as `/students` and `/admissions`; must verify their campus scope |
| Director | `/director/fees` | Campus finance overview | Page exists; verify assigned-campus filter |
| Director | `/director/fees/collections` | Campus collections analytics | Page exists; verify aggregation and export scope |
| Director | `/director/examinations` | Campus examination oversight | Page exists; verify campus-level policy |
| Director | `/director/obe` | Campus OBE oversight | Page exists; verify campus scope |
| Director | `/director/placements` | Campus placement outcomes | Page exists; verify campus scope and field minimization |
| Director | `/director/reports` | Campus reporting | Page exists; verify exports |
| Director | `/director/students` | Campus student lifecycle | Page exists; verify entity and campus boundaries |
| Director | `/director/imports` | Campus import review | Page exists; verify mutations and upload scoping |

## Action inventory rule

For each interactive element, record: source page, label, destination/endpoint, required permission, scope resolver, validation, loading/error/success behavior, idempotency, audit event, and test ID. Do not mark an action complete merely because its button renders. This inventory remains an audit worklist until automated browser coverage exists for every visible action.


## Batch 3 route corrections (2026-10-11)
- `/chairman/operations` no longer imports and aliases the generic `/operations` page. It now presents a separate Chairman executive operations index linking only to existing Chairman routes: intelligence, fee approvals, finance, examinations, students, placements, and reports.
- `/director/operations` no longer links to global `/students` or `/admissions`. It links to existing Director-specific pages for students, examinations, OBE, fees, placements, reports, and imports.
- Added `backend/src/__tests__/chairman-director-route-contract.test.ts` to assert these page boundaries and verify that each linked route file exists.
- These are source-level route contract checks. They have not been executed here, and do not verify page behavior or backend scope for the destination APIs.


## Batch 6 Director fee approval route (2026-10-11)
- Added `/director/fee-approvals` as an independent Director page, linked from `/director/operations` and the Director dashboard.
- Backend fee-structure listing is restricted for Directors to program departments derived from assigned `CampusAccess` rows; approval and rejection mutations run an explicit scope assertion before changing status.
- Director RBAC now includes fee-structure read and approval permissions. Backend permission and scope checks remain authoritative; hiding the page is not relied upon as a security boundary.
- Caveat: structures lacking a `programId` are currently omitted from Director listing. Semester-only linkage and cross-campus mismatch scenarios need database-backed validation. Source-contract test assertions have not been executed.


## Batch 7 — Separate intelligence workspaces and multi-campus scope (2026-10-11)
- Replaced the Chairman intelligence route's generic-page alias with a dedicated Chairman-only workspace and created a separate Director-only intelligence workspace.
- Both pages call the authenticated intelligence API, show missing/unavailable values as unavailable rather than inventing zeros, and route to role-specific destination pages.
- Added the Director intelligence link to Director operations and the Director dashboard.
- Fixed the command-center scope handling for leadership users assigned multiple departments: the API now applies the full server-derived department set to aggregate queries and at-risk student selection when no single department is selected. A requested department is still checked against the allowed set; an empty assignment never falls back to institution-wide results.
- Added source-contract assertions for independent role boundaries and multi-department filtering. These assertions are committed but have not been executed in a writable checkout.
- Remaining validation: confirm Prisma generated types, endpoint permission behavior, aggregate correctness, and live multi-campus fixtures through build and database-backed tests.


## Batch 8 — Role-specific finance and examination landing routes (partial; 2026-10-11)
- Replaced `/chairman/fees` and `/director/fees` aliases of the generic Fees page with separate role-guarded pages. Both read canonical fee-structure records; Director visibility depends on the server-side CampusAccess scope filter. Approval actions remain on the dedicated approval page.
- Replaced `/chairman/examinations` and `/director/examinations` aliases of the generic Examination Cell page with independent role-guarded oversight pages backed by `/erp/me/workspace`. These pages are read-only summaries and link only to their respective role-specific workspaces; they do not pretend to replace the full Examination Cell operational lifecycle.
- Extended route-contract assertions for role boundaries, removal of generic-page aliases, and canonical/scoped data sources.
- Remaining gap: full operational exam scheduling/marks/result workflows are not reimplemented in these oversight routes. Before exposing any such mutations here, verify endpoint-level Director campus scope and workflow permissions. All runtime checks remain pending.


## Batch 9 — Examination lifecycle, scoped reports/exports, and decision integrity (2026-10-11)
- Added independent Chairman and Director examination operations pages, copied into separate route files and guarded by the matching role. They expose the existing session creation, schedule creation, marks entry/review, approval, lock, result publication, hall-ticket, incident, and revaluation workflows. The Director route relies on server-side scope checks rather than UI-only filtering.
- Tightened Director examination scope at the service boundary for session creation/updates, session reads/status changes, schedule edits, seating, invigilation assignments, hall-ticket generation/status, marks history, marks approval, locking, publication, revaluation decisions, incidents, and mark-correction decisions.
- Removed an unscoped Director session-list condition that treated an empty department target as institution-wide visibility. Director session lists now use CampusAccess-derived campus/department targets or schedules actually within the assigned departments.
- Scoped Director revaluation, incident, and mark-correction queues by assigned departments. The incident list now receives the authenticated actor.
- Added compare-and-set/row-lock guards for mark approval, schedule locking/publication, revaluation decisions, incident decisions, correction decisions, hall-ticket changes, and session status changes. Mark/decision history and critical audit rows are written inside the relevant transaction.
- Enabled campus-scoped Director finance exports for fee structures and student-linked invoice/payment/receipt/transaction/refund/concession data. Institution-wide fee-head and finance-audit exports remain unavailable to Directors. Fixed attendance report option/data scope so Director results use CampusAccess-derived department IDs; empty scope uses a no-match filter.
- Added PostgreSQL-backed integration coverage for CampusAccess department resolution, fee structure lists/downloads, institutional aggregate metrics, and attendance report options. The consolidated verification workflow now runs on this isolated branch, starts PostgreSQL, deploys migrations, and runs backend/frontend checks.
- Verification remains pending for the latest commit until GitHub Actions completes. No PR has been merged and the production branch has not been modified.
