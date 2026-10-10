# ACADLYX UI, CSS and Design-System Audit

**Baseline SHA:** `b48cd1dd3ead99b7008095b532dff7e4639b2267`  
**Branch:** `production-readiness-completion-2026-10-10`  
**Date:** 2026-10-10  
**Gate status:** INCOMPLETE — all discovered routes are inventoried below, but no route is represented as visually verified without browser evidence.

## 1. Evidence boundary

The recursive Git tree returned 1150 entries without truncation and includes 233 frontend App Router page/layout files. Browser automation, running test credentials, synthetic fixture services and screenshot comparison were not available in this continuation. Therefore, this document establishes route accounting and an audit queue; it does not claim visual completion.

## 2. Stylesheets discovered

- `frontend/src/app/acadlyx-contrast.css`
- `frontend/src/app/acadlyx-dashboard-tokens.css`
- `frontend/src/app/acadlyx-modal-responsive.css`
- `frontend/src/app/acadlyx-responsive.css`
- `frontend/src/app/globals.css`

The presence of `globals.css`, dashboard tokens, contrast CSS and responsive/modal CSS means the intended relationships and import order must be verified before removing or consolidating any rule. A global utility override or hard-coded value is not automatically a defect. No broad CSS deletion or arbitrary redesign is made without rendered regression evidence.

## 3. Required verification protocol

For each route below, record:
1. Root/nested layout and role/session guard.
2. Imported global CSS, token stylesheet, CSS modules, inline styles and third-party styles.
3. Expected shared shell/navigation and active route.
4. Desktop and mobile viewport dimensions, theme if supported, and synthetic role fixture.
5. Loading, empty, error, success and permission-denied states applicable to that route.
6. Browser console/network errors, missing assets, overflow, focus/keyboard behavior and screenshot evidence.
7. Any defect, its minimal root-cause fix, affected routes, and before/after visual regression result.

## 4. Current source-level risk list

These are investigation targets, not assertions that each has already caused a visible defect:
- Global selectors and utility-class overrides in `globals.css`, including any `!important` declarations.
- Color/spacing duplication between global tokens and `acadlyx-dashboard-tokens.css`.
- Import order and leakage among contrast, responsive and modal stylesheets.
- Role-specific dashboard shell persistence and route-derived active navigation.
- Narrow-screen sidebar overlays, scroll locking, wide data tables and modal overflow.
- Inconsistent form validation/feedback, loading, empty, error and permission-denied states.
- Hard-coded visual values outside the canonical token layer.

## 5. Route-by-route inventory

**Legend:** `INVENTORY CONFIRMED` means the path exists in the baseline tree. `NOT VISUALLY VERIFIED` means no browser render evidence is available in this run. Every discovered route is listed; none is silently omitted.

| Source route file | Inventory | Visual status | Required follow-up |
|---|---|---|---|
| `frontend/src/app/about/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/academics/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/account-security/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/audit/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/collections/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/concessions/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/dues/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/fee-heads/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/fee-structures/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/invoices/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/invoices/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/payments/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/receipts/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/refunds/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/accounts/transactions/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/[module]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/academic-years/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/calendar/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/campuses/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/course-offerings/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/courses/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/departments/[departmentId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/departments/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/documents/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/events-gallery/[id]/edit/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/events-gallery/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/events-gallery/new/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/events-gallery/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/imports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/institutional-cms/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/layout.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/notices/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/notifications/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/parent-links/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/programs/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/sections/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/semesters/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/student-setup/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/users/[userId]/edit/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/users/[userId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/users/deleted/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admin/users/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admissions/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admissions/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/admissions/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/applications/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/calendar/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/certificates/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/fees/collections/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/intelligence/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/chairman/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/club-president/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/club/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/cms/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/contact/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/course-registration/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/dean/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/fees/collections/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/imports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/director/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/employees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/enrollment/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/erp/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/events-gallery/[id]/edit/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/events-gallery/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/events-gallery/new/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/events-gallery/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/examination/admit-card-templates/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/examination/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/examination/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/examination/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty-management/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/assignments/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/assignments/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/attendance/[courseOfferingId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/attendance/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/courses/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/marks/[courseOfferingId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/marks/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/faculty/profile/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/fees/collections/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/fees/receipts/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/forgot-password/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/forms/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/attendance/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/course-registration-requests/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/enrollment-requests/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/faculty/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/intelligence/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hod/timetable/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hr/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/hr/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/imports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/imports/students/complete/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/institution-settings/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/institutionalcms/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/intelligence/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/it/imports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/it/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/leave-management/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/circulation/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/copies/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/policies/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/library/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/lms/[offeringId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/lms/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/lms/parent/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/lms/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/lms/settings/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/login/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/management/intelligence/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/management/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/management/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/management/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/management/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/my-work/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/notices/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/notifications/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/parent/children/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/parent/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/parent/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/parent/profile/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/parent/students/[studentId]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/payments/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/companies/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/drives/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/interviews/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/offers/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/openings/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/tests/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/placements/visits/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/profile/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/registrar/academic-masters/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/registrar/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/registrar/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/registrar/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/registrar/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/reports/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/reset-password/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/results/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/site-content/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/staff/operations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/staff/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student-promotion/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/academic/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/admit-cards/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/assignments/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/assignments/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/attendance/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/calendar/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/certificates/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/course-registration/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/documents/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/enrollment/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/examinations/admit-cards/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/examinations/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/examinations/performance/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/examinations/registration/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/examinations/results/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/fees/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/leave/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/library/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/marks/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/notifications/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/obe/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/placements/profile/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/profile/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/results/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/student/timetable/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/students/[id]/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/students/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/audit/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/institutions/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/placements/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/plans/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/superadmin/users/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/team/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/timetable/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/today/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/user-deletion-approvals/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |
| `frontend/src/app/user-management/page.tsx` | Inventory confirmed | NOT VISUALLY VERIFIED | Route-specific CSS/layout trace and desktop/mobile render evidence not yet captured |

## 6. Completion criteria

The UI gate can close only when every listed route has either (a) a successful rendered verification with role/fixture and desktop/mobile evidence, or (b) a precise blocker and documented alternative verification. All unintended inconsistencies must be fixed and the affected routes rerendered. At present, visual gate is **UNVERIFIED** and the release decision remains **NO-GO**.


## Implementation continuation — 2026-10-10

### Browser verification implementation update

Added frontend/e2e/public-smoke.spec.mjs and a CI job that starts the application against an isolated API/database. The suite inspects the public homepage and inline login form at desktop/mobile widths, checks horizontal overflow, submits invalid credentials against the real isolated API, checks the error state, detects browser runtime/console errors, and preserves screenshots/test logs as an artifact.

This is automation added, not yet counted as visually verified until the browser job completes successfully on the exact final candidate SHA. The earlier inventory of 233 page/layout source files remains an inventory only; no blanket visual pass is claimed. Authenticated role dashboards and critical authenticated actions remain unverified by this public/login smoke suite.

Verified on exact implementation commit fecdb003f3742957e4c7e0c0f2d7a27b5b04ad12: [ACADLYX Production Quality run 38075258304](https://github.com/acadlyx/acadlyx/actions/runs/38075258304) completed successfully. Backend suite: 144 tests passed, 0 failed, 0 skipped. PostgreSQL migrations, backend typecheck/build/lint, and frontend typecheck/lint/production build passed. This is isolated CI evidence, not staging or production evidence. New performance, populated migration, and browser gates were added after this evidence and must pass on the exact final SHA.
