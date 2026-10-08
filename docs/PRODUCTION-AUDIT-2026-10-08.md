# ACADLYX Full Platform Production Audit — 2026-10-08

## Scope

Repository-wide static audit plus live Supabase production-database verification on `production-upgrade-2026-09-20`.

This document records evidence available through the repository/connected production database. It does not claim browser-authenticated E2E coverage where credentials/runtime traversal are unavailable.

## Confirmed root causes / fixes in this pass

### Library

1. **Damaged-copy inventory bug**
   - `returnBook` previously incremented `availableCopies` for DAMAGED books.
   - A damaged copy must leave circulation.
   - Fixed to reduce aggregate `totalCopies` without returning the copy to available stock.
   - Lost and damaged operations remain transactional and tenant-scoped.

2. **Missing late-return fine workflow**
   - Added authorized `POST /library/loans/:id/impose-late-fine`.
   - Requires `library.manage` and the Library entitlement.
   - Only active overdue ISSUED loans can be charged.
   - Uses the canonical Fees invoice architecture.
   - Uses a deterministic source event key so retries cannot create duplicate financial obligations.
   - Existing settled amounts are preserved when an overdue amount is refreshed.

3. **Student library balance correctness**
   - Student/library loan responses now expose the canonical outstanding invoice balance.
   - Student UI uses that balance instead of treating historical `fineAmount` as the current amount due.

### Authorization / access denial

4. **Stale cached RBAC could cause false access denial**
   - `DashboardShell` used cached `/auth/me` permissions for immediate route authorization while refreshing them in the background.
   - After RBAC/entitlement changes, a stale cache could redirect a legitimately authorized user to their workspace with an access-denied experience.
   - Fixed route authorization to wait for one fresh `/auth/me` reconciliation while still using the cached user for immediate rendering.

## Production database verification

- Active institutions: 1.
- Library entitlement: enabled for the active institution.
- Fees entitlement: enabled for the active institution.
- STUDENT role has `library.read` and `library.borrow`.
- Library permissions catalog contains read, borrow, manage and fine-waiver capabilities.
- Library issues: 1.
- Library fines: 1.
- Library-sourced fee invoices: 1.
- Orphan library fines: 0.
- Cross-institution library fine mismatches: 0.
- Library inventory rows with negative/invalid stock relationships: 0.
- Prisma migrations applied: 63.
- Prisma migration history rows: 64, including one historical migration that was rolled back after a SQL syntax failure and subsequently superseded/recovered.
- Latest applied migration: `20261008140000_placement_drive_opportunity_link`.
- Supabase security advisors: 0 findings.
- Supabase performance advisors report informational index/foreign-key findings across the wider schema; these require workload-based prioritization and must not be blindly indexed.

## Verification limitations

The connected repository interface cannot execute the complete local Node/Next.js toolchain in this session. The current branch therefore requires a fresh GitHub Actions/CI run after these changes before claiming frontend/backend build, lint, typecheck and test success.

Authenticated browser traversal of every role/device/module is also unavailable through the repository connector. In particular, the following require final runtime execution:

- student Library browser journey;
- librarian circulation journey;
- lost/damaged/fine end-to-end financial settlement;
- Fees/Examination/Course Registration/Placement/CMS role journeys;
- adversarial two-tenant authorization;
- mobile visual traversal at all requested breakpoints;
- production deployment smoke after the latest commits.

## Acceptance posture

**Not yet 100% production-verified.**

The code changes in this audit target root causes rather than weakening RBAC or replacing backend operations with mock data.
