# ACADLYX Navigation Audit — 2026-10-08

Repository-wide static navigation hardening for `production-upgrade-2026-09-20`.

- HOD Fees, Attendance, Students, Faculty, Timetable, Reports and Institutional Intelligence use HOD-owned destinations.
- Chairman, Director, Dean and HOD fee collection actions use role-scoped destinations.
- Student links for Chairman, Director, Dean, Registrar, HOD, Admissions, Librarian and Placement no longer land on the Admin-only student master page.
- Specialist reports use role-owned report workspaces.
- Student Placement uses `/student/placements`.
- Management quick actions use Management-owned Operations, Intelligence and Reports.
- Management and Staff are distinct roles; Staff no longer redirects to Accounts.
- CMS has its own workspace navigation entry.
- Role-owned destinations inherit the source navigation permission/entitlement contract.
- Overview uses exact matching; nested pages own their active state.

Live browser traversal across every role/tenant/device is not available through the repository connector; CI and authenticated runtime testing remain the final verification gates.
