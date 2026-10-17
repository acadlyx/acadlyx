# ACADLYX Frontend UI/UX Execution Tracker

Last updated: 2026-10-18

## Scope and protection

This tracker covers the existing web frontend only: UI consistency, responsive behavior, accessibility, navigation usability, and interaction quality. Work is confined to `frontend/` and frontend documentation. Do not modify backend authorization, APIs, database schema, migrations, infrastructure, the protected production baseline, `main`, or PR #77 status. No merge or deployment is authorized.

- Repository: `acadlyx/acadlyx`
- Authorized branch: `native-mobile-parity-2026-10-17`
- Protected baseline: `production-upgrade-2026-09-20`
- Local execution limitation: no writable repository checkout is mounted in this session. Remote changes were made through the connected GitHub repository integration. Local shell commands, package scripts, local browser execution, and screenshot inspection have therefore **not** been run; rely only on exact-head CI evidence for automated checks.

## Route progress counts

Counts are intentionally not guessed before the route inventory is enumerated from the actual App Router and role navigation:

| Measure | Current count |
|---|---:|
| Routes audited | 0 (inventory not yet enumerated) |
| Routes implemented | 0 individual routes (checkpoint is shared-shell work) |
| Routes browser-verified | 0 |
| Routes pending audit/verification | Not yet quantifiable until inventory exists |

The counts above do not mean the whole frontend has been inspected or is complete. The shared foundation review started with `frontend/package.json`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/acadlyx-dashboard-tokens.css`, `src/app/acadlyx-contrast.css`, `src/app/acadlyx-responsive.css`, `src/app/acadlyx-modal-responsive.css`, `src/components/ui/AcadlyxDesignSystem.tsx`, `src/components/dashboard/DashboardShell.tsx`, `src/components/dashboard/UnifiedDashboardFrame.tsx`, `src/lib/navigation.ts`, and `scripts/validate-source.mjs`.

## Checkpoint FUI-001 — Shared dashboard brand consistency

- Status: `IMPLEMENTED_UNVERIFIED` until exact-head CI passes; browser verification remains pending.
- Confirmed defect: the global brand tokens are warm beige with a dark-green primary, but the shared dashboard navigation's active state, active shadow, sidebar, fallback brand mark, profile avatar, and profile shortcut used blue accents or a separate navy palette.
- Implemented:
  - Reconciled dashboard sidebar, hover, active, text, border, focus, and shadow tokens with the existing green/beige brand palette.
  - Replaced blue utility accents in `UnifiedDashboardFrame.tsx` with existing semantic CSS variables for brand and focus styling.
  - Added design-token source-contract assertions to `frontend/scripts/validate-source.mjs` so the active sidebar palette and shared-shell semantic colors are checked by the existing source-validation command.
- Files changed:
  - `frontend/src/app/acadlyx-dashboard-tokens.css`
  - `frontend/src/components/dashboard/UnifiedDashboardFrame.tsx`
  - `frontend/scripts/validate-source.mjs`
- Code checkpoint: `afe9b343a81c57093c59cf25ce07afc68d20ce6d` (the tracker commit that follows this code checkpoint will have a newer SHA).
- Source inspection performed: fetched the updated files from the authorized remote branch and checked the expected green tokens, absence of the prior blue active-state token/shadow, absence of the specified blue utility classes in the shared shell, and presence of the validation guards. This is a source-content check, **not** a run of `npm run validate:source`.
- Local tests: not run; no writable checkout.
- Exact-head CI, TypeScript, lint, build and browser status: pending final checkpoint verification.
- Routes affected: the shared authenticated dashboard shell globally; no individual route behavior or authorization rule was changed.
- Remaining work: confirm CI on the final exact SHA; exercise the changed shell in browsers at 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 px; verify keyboard focus and reduced-motion behavior; build a definitive role-aware route inventory; count audited/implemented/browser-verified/pending routes separately.

## Next implementation queue

1. Resolve exact-head CI for FUI-001 and repair any real regression without weakening validation.
2. Inventory actual public/authentication and authenticated routes from the App Router and navigation configuration.
3. Fix the next confirmed shared-shell issue, then progress through high-usage screens and route families with focused regression coverage.
4. Do not mark a route browser-verified from a build or source-contract check alone.
