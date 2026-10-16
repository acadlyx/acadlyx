# ACADLYX Mobile Feature Parity

## Status semantics

- FOUNDATION: an API-backed read-only discovery surface or route mapping exists. This does not mean CRUD is complete.
- PARTIAL: some functionality is implemented, but workflow states/actions or native integrations are missing.
- NOT IMPLEMENTED: there is no native workflow yet.
- SERVER ONLY: intentionally not treated as a user-facing workflow.

Source reviewed: backend/src/app.ts and the route modules on the feature branch's base commit 2dc568ec4416a295028cf64eaa7ee659b9258d89. The backend has 56 route mount calls across 55 unique API prefixes, because two routers are mounted under /lms. The mobile catalog is a first increment only.

| API surface | Native screen/action in this increment | Status and explicit gap |
|---|---|---|
| /health | No screen; service-level API endpoint | SERVER ONLY |
| /auth | Login, MFA, secure token persistence, refresh, logout and password change | PARTIAL; profile editing/photo and password recovery not wired. Recovery route not present in inspected auth router. |
| /workspace/context | Catalog only; no native context selector | NOT IMPLEMENTED |
| /my-work | Live home screen reads work summary and shows returned items | PARTIAL; work-item actions and deep links to native workflows are missing |
| /search | No integration with global search | NOT IMPLEMENTED; module list search is local |
| /workflow | No workflow queue/detail/approval screen | NOT IMPLEMENTED |
| /placements | Opportunity list surface | PARTIAL; applications, drives, offers, interviews, eligibility and lifecycle actions remain |
| /institutions | Generic read-only adapter listed in catalog | FOUNDATION; dedicated administration forms are missing |
| /users | Generic read-only adapter | FOUNDATION; user lifecycle/role mutation screens are missing |
| /campuses | Generic read-only adapter | FOUNDATION; scope-specific details and edits are missing |
| /departments | Generic read-only adapter | FOUNDATION; department lifecycle workflows are missing |
| /programs | Generic read-only adapter | FOUNDATION; programme lifecycle workflows are missing |
| /academic-years | Generic read-only adapter | FOUNDATION; create/update/current-year workflows are missing |
| /batches | Generic read-only adapter | FOUNDATION; dedicated CRUD is missing |
| /semesters | Generic read-only adapter | FOUNDATION; dedicated CRUD is missing |
| /sections | Generic read-only adapter | FOUNDATION; dedicated CRUD is missing |
| /courses | Generic read-only adapter | FOUNDATION; course authoring is missing |
| /course-offerings | Generic read-only adapter | FOUNDATION; faculty assignment/workload workflows are missing |
| /obe | Generic read-only adapter | PARTIAL; mapping, assessment, attainment calculation and approval are missing |
| /students | Student master list surface and role-gated self-service endpoint mapping | PARTIAL; master record forms, enrollment lifecycle and detail relations need dedicated screens |
| /faculty | Generic read-only adapter | FOUNDATION; profile/workload actions are missing |
| /admissions | Generic read-only adapter | FOUNDATION; admission application workflow and documents are missing |
| /hr | Generic employee-record adapter | PARTIAL; HR lifecycle, payroll features and permissions require module-specific implementation |
| /leave | Generic read-only adapter | PARTIAL; apply, approve, reject and transition screens are missing |
| /portal | Notifications list, mark-all-read action and documents route mapping | PARTIAL; individual mark-read action, creation and document lifecycle are missing |
| /library | Catalogue list surface | PARTIAL; issue, return, renew, reservation, damaged inventory and fines are missing |
| /calendar | Generic read-only adapter | FOUNDATION; calendar filters and create/edit workflows are missing |
| /registrations | Generic read-only adapter | FOUNDATION; registration submit/approve/reject workflows are missing |
| /enrollment-requests | Generic read-only adapter | FOUNDATION; workflow transition UI is missing |
| /movements | No dedicated mobile workflow | NOT IMPLEMENTED |
| /certificates | Generic read-only adapter | FOUNDATION; certificate request/issue lifecycle is missing |
| /attendance-sessions | Generic read-only adapter | PARTIAL; attendance marking, submission, correction, lock and approval are missing |
| /assignments | Generic list/detail read adapter | PARTIAL; creation, submission, review, grading and reopen are missing |
| /internal-marks | Generic read-only adapter | PARTIAL; mark entry, validation and approval are missing |
| /grades | Generic read-only adapter | PARTIAL; grade finalization/publication screens are missing |
| /directory | No dedicated directory UX yet | FOUNDATION only if endpoint is exposed in generic catalogue; typed workflow is missing |
| /examinations | Session read surface | PARTIAL; scheduling, rooms, seating, invigilators, hall tickets, approvals and publication remain |
| /attendance | No governance/correction workflow | NOT IMPLEMENTED |
| /lms (two routers) | Generic read-only adapter | PARTIAL; courses, materials, attempts, assessments and grading are not full workflows |
| /billing | No complete billing workflow | NOT IMPLEMENTED |
| /finance | Overview, invoices and payments read surfaces | PARTIAL; invoice lifecycle, payment entry, receipts, concessions, refunds, reconciliation, audit and export are not native workflows |
| /parent | No dedicated parent dashboard; backend endpoint is in route inventory | NOT IMPLEMENTED |
| /operations | Generic read-only adapter | FOUNDATION; action queue and maintenance lifecycle are missing |
| /security | No audit/security administration screen | NOT IMPLEMENTED |
| /subscriptions | No native platform subscription administration | NOT IMPLEMENTED |
| /intelligence | Generic read-only adapter | FOUNDATION; report catalogue, filter/query contracts and exports need dedicated implementation |
| /ask-acadlyx | No native assistant integration | NOT IMPLEMENTED |
| /erp | Notices/timetable list surfaces | PARTIAL; authoring/edits missing. Legacy examination write routes return 410 and must not be revived. |
| /imports | No native file-picker/preview/commit workflow | NOT IMPLEMENTED |
| /people-imports | No native file-picker/preview/commit workflow | NOT IMPLEMENTED |
| /exports | No format selection, download or export-audit screen | NOT IMPLEMENTED |
| /site-content | No CMS authoring/publish workflow | NOT IMPLEMENTED |
| /events | Generic read-only adapter | FOUNDATION; event authoring and attachments are missing |
| /institutional-cms | No CMS authoring/publish workflow | NOT IMPLEMENTED |
| /files | No upload/download/binary-preview workflows | NOT IMPLEMENTED |
| /payment-webhooks | Server-to-server handler; not exposed as a mobile action | SERVER ONLY |

## Current screen inventory

The source contains sign-in/MFA, native root/tabs navigation, home/My Work, module directory, a generic module list/detail renderer, notifications and account/password control screens. Student self-service endpoints are mapped for dashboard, attendance, marks, assignments and timetable but have not been smoke-tested.

## Definition of mobile completion

A generic screen or endpoint mapping is not full feature parity. Before a feature is marked complete, add dedicated mobile UI, typed request/response contract, validated inputs, permission and scope checks, loading/empty/error/success states, idempotent mutation behavior, query invalidation, and automated tests against an isolated institution. This matrix deliberately does not claim 100% parity.