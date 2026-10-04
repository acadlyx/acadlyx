# ACADLYX Master ERP Overhaul — Architecture Audit

Branch: `production-upgrade-2026-09-20`

## Executive finding

ACADLYX already has a strong multi-tenant/RBAC foundation and several mature domain services, but the product surface is still fragmented. The main architectural opportunity is not a rewrite: it is to make existing services authoritative and place an action-oriented orchestration layer above them.

## Existing strengths

- Tenant ownership is explicit on core records through `institutionId`.
- Authentication resolves the current user from the verified session rather than trusting client tenant/role fields.
- RBAC has a centralized permission catalogue and server-side authorization middleware.
- Academic master data has explicit ownership: institution → department → program → academic year/semester/section → course offering.
- Attendance, assignments, internal marks, fees, admissions, notifications, files and examinations already have dedicated backend services/routes.
- Workspace data already has caching/deduplication on the frontend.
- Performance indexes have been added for several hot paths.
- File storage has a provider abstraction and tenant-scoped FileAsset records.
- Examination code already contains a controlled state-machine direction for newer examination tables.

## Fragmentation discovered

### Dashboards

There are multiple dashboard entry patterns:

- role-specific app routes;
- `InstitutionRoleDashboard`;
- `RoleWorkspaceLanding`;
- `DashboardShell`;
- specialist pages;
- leadership pages;
- the legacy aggregated ERP workspace.

These should remain as domain implementations but should converge on one workspace contract.

### Navigation

Navigation is already permission-aware, but several route families are role aliases/overrides. This is useful for compatibility, but the long-term direction should be one canonical navigation registry with role-owned destinations.

### Workspace data

`/erp/me/workspace` is a compatibility-heavy aggregate. It is useful for snapshot data but should not become a giant query that preloads every module. Action-oriented data should be requested independently.

### Exports

A centralized `export.service.ts` already exists and correctly queries the database without frontend pagination. The binary response path is also centralized. The main reliability improvements implemented here are explicit non-empty validation, row-count headers, content length, and a real empty-result workbook instead of a blank-looking workbook.

### Examination

The repository contains both a legacy `Exam/ExamResult` Prisma model and newer examination workflow tables accessed by the examination service. The newer workflow is the correct direction for stateful examination operations. Admit-card template/PDF/ZIP infrastructure is not yet present in the inspected branch and should be added without duplicating the examination state machine.

## KEEP

- Existing authentication and RBAC boundary.
- Tenant-scoped Prisma relationships.
- Academic master-data hierarchy.
- Dedicated domain services.
- Existing examination state-machine implementation.
- Existing file-storage abstraction.
- Existing import preview/commit flow.
- Existing audit logging.
- Existing frontend request cache/deduplication.

## MERGE / CONSOLIDATE

- Role dashboard entry experiences into a common action-oriented workspace shell.
- Repeated operational navigation into role-owned destinations.
- Export binary generation into the centralized export service.
- Notifications and pending actions into a common My Work surface.
- Dashboard snapshots and domain pages through explicit, small API contracts.

## SIMPLIFY

- Replace long lists of modules as the first landing experience with Today/My Work/priority actions.
- Use known role, department, program, section and current academic context as defaults.
- Keep advanced configuration behind contextual actions instead of primary navigation.
- Prefer profile-level contextual actions over module-hopping.

## MOVE TO ADVANCED

- Deep master-data maintenance.
- Institution-wide configuration.
- Rare bulk corrections.
- Historical audit exploration.
- Advanced reporting filters.
- Template administration.

## REMOVE / AVOID

- New parallel dashboard data models that duplicate authoritative records.
- New role-specific copies of the same business rule.
- Client-supplied tenant ownership as an authorization decision.
- Export implementations that depend on current frontend pagination.
- Placeholder file-generation responses.

## Implemented in this overhaul slice

1. Database-driven `My Work` backend service.
2. Tenant-scoped `GET /api/v1/my-work` endpoint.
3. Role-aware live tasks for faculty, HOD, accounts, HR, admissions, examination, students and management.
4. `/my-work` action center in the frontend.
5. My Work surfaced from every role workspace landing.
6. Central export hardening:
   - non-empty buffer validation;
   - explicit empty-result workbook;
   - XLSX worksheet filter metadata;
   - column sizing;
   - content length;
   - exported row count;
   - frontend zero-byte/type validation.

## P0/P1 work still required

The following must not be considered complete merely because the current build can compile:

- End-to-end PDF/admit-card generation validation.
- Reusable admit-card template data model/editor.
- Bulk generation job architecture.
- ZIP generation and validation.
- Examination eligibility → schedule → admit-card → marks → results integration.
- Global search with RBAC-aware routing.
- Central notification/action routing.
- Role-specific Today views.
- Full navigation consolidation.
- Import validation matrix across all supported data types.
- Full XLSX integration test matrix.
- Real-data workflow tests for all role families.
- Production build/type/test execution against the deployment environment.

## Definition of completion

The overhaul is complete only after P0 broken-file workflows, P1 information architecture, P2 workflow simplification, P3 automation, P4 role dashboards and P5 document infrastructure have all been verified against real tenant-scoped data.


## Second implementation pass

- Added a dependency-free A4 PDF renderer for issued hall tickets.
- Added authenticated binary download support in the frontend.
- Replaced the student admit-card print-only action with a real PDF download.
- Added tenant-scoped admit-card template storage through a Prisma deployment migration.
- Added template CRUD service/API and an Examination Cell template workspace.
- Added a navigation entry for template administration.
- Added a structural PDF regression test.
- The existing examination service remains the source of truth for eligibility, seating, release state and paper data; the PDF layer consumes that data rather than duplicating it.

### Deliberate limitation

The current PDF renderer is a reliable baseline document renderer, not yet a visual drag-and-drop editor. The template configuration is now persisted and exposed through CRUD, but the next pass should connect template configuration to rendering and add live A4 preview, photos, logos, QR verification and bulk/ZIP generation.