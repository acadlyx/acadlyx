# ACADLYX Universal Export — Coverage and Verification Audit

Branch: `universal-export-system-2026-10-11`  
Purpose: isolated implementation and verification only. This document does not authorize merge or deployment.

## Shared export formats

The shared export writer supports:
- **XLSX** — generated with the existing `xlsx` package.
- **CSV** — quoted fields, UTF-8 BOM, and formula-injection protection for text fields. Numeric negatives remain numeric.
- **DOCX** — generated as an Office Open XML document.
- **PDF** — generated as a readable multi-page PDF.
- **JSON** — structured machine-readable data.
- **Print** — escaped HTML print views in the browser. Attendance uses its dedicated scoped API for print data.

The shared endpoint remains `GET /exports/:type`. Attendance continues to use its dedicated route `GET /exports/attendance` and its existing server-side filters and scope.

## Implemented export datasets

The backend catalog currently includes 45 explicit data types:

- **People and academics:** users, students, faculty, departments, programs, academic years, semesters, sections, courses, course offerings, exams, marks, attendance, parent links, campuses, assignments, assignment submissions, timetable, notices, admission applications.
- **Finance:** invoices/fees, paid fees, outstanding dues, fee structures, fee heads, payment records, receipts, transactions, refunds, concessions, finance audit.
- **Library:** book catalogue, copies/inventory, issues/circulation, fines.
- **HR:** employees and leave requests.
- **Calendar and events:** calendar events, institutional events, event media.
- **Placement:** companies, drives, openings, applications, offers.

The data query allowlist is explicit. Internal security material (tokens, sessions, permission tables, outbox events, raw worker jobs, secrets) is not exposed as generic exports.

## Contextual page controls currently integrated

| Workspace | Export UI | Filters / selection wired |
|---|---|---|
| Admin user directory | Yes | Current search and role-category filter; all-filtered export |
| Student management | Yes | Search, status, department, program, semester, section; current page and selected IDs |
| Admin academic master data | Yes | Search and applicable campus/department/program/semester context; current page |
| Attendance reporting | Yes | Existing attendance filters and scoped report endpoint; all matching filtered records |
| Examinations / marks | Yes | Dataset follows active examination view; all-filtered |
| Accounts / Finance | Yes | Fee structures, invoices, paid fees, payments/collections, dues, heads, receipts, transactions, refunds, concessions, and audit views; invoice search plus all-filtered options |
| Timetable | Yes | Department, program, semester and section context |
| Notices | Yes | All-filtered; page currently has no list-level filter state to propagate |
| Library | Yes | Catalogue/copies, circulation/issues, fines; all-filtered |
| Admissions | Yes | Search, status, program and academic-year filters |
| HR | Yes | Employee search, status, department and employment type; leave requests all-filtered |
| Calendar | Yes | Search, event type, audience and dates |
| Faculty assignments | Yes | Assignment and submission datasets; all-filtered |
| Placement | Yes | Companies, drives, openings, applications and offers; all-filtered |
| Admin Events & Gallery | Yes | Institutional events and event media; all-filtered |

The UI control exposes current-page and selected-row choices only when the containing table supplies page metadata or selected row IDs. The current selected-row table wiring is implemented for the Student Management table; it is not yet universally wired for every other table.

## Authorization and integrity

- Per-dataset permission checks are applied at the export route and service boundary.
- Every model query remains institution-scoped.
- Academic exports for scoped Director/Dean/HOD/Faculty roles apply department, faculty-offering, and student enrollment scope as appropriate.
- Scoped academic exports remove selected private student/faculty fields rather than assuming a read permission grants unrestricted profile export.
- Successful generic exports record a `DATA_EXPORT` audit event with format, row count, selection type, page metadata, selected count, and filter field names. Filter values are intentionally omitted from audit metadata.
- Finance invoice exports report `amount`, canonical `paidAmount`, `refundedAmount`, and a balance based on the net invoice `paidAmount`. Processed refunds already reduce `paidAmount`; the refund is not subtracted a second time.
- Empty fee structures are retained by left-joining their items and fee heads.

## Large-export behavior and limitations

Synchronous exports are bounded to 50,000 rows for XLSX/CSV/JSON and 10,000 rows for DOCX/PDF. Requests above those limits return HTTP 413 with an explicit message instead of silently truncating a download. **Background export jobs, resumable downloads, and notification-on-completion are not implemented.** The generic exporter currently materializes and filters records in bounded database batches before file generation; it is not a database-streaming/constant-memory export pipeline.

The format writer tests validate non-empty and empty XLSX, CSV escaping/formula safety, numeric negative CSV values, DOCX ZIP/OOXML structure, PDF header/page-tree/EOF markers, JSON parsing, and refund-aware balance calculation. Those unit checks are not substitutes for live browser download tests, database-backed export reconciliation, or authorization integration tests.

## Verification state

At a previous isolated branch head, GitHub Actions reported backend Prisma/typecheck/build/lint/test and frontend production build passing. Subsequent edits were made to the same isolated branch, so the earlier green result does **not** establish that the newest branch head passes. CI must finish on the latest commit before declaring these changes verified.

Not yet established:
- all applicable pages in the entire application have contextual export controls;
- all 45 datasets have page-specific selected-row and current-page integration;
- all visible list filters across every page exactly match export filters;
- live authenticated downloads for all six output modes across all datasets;
- representative database-backed fee/refund/concession reconciliation against the ledger;
- large-dataset behavior beyond the synchronous limits;
- latest-commit CI is fully green.

## Release posture

**Not ready to merge or deploy** until CI is green on the final isolated head and the unverified integration/coverage items above are completed. Production branch and deployment were not changed by this work.
