# ACADLYX Anti-AI Design Overhaul — Source Implementation Report

Date: 2026-11-23  
Repository: acadlyx/acadlyx  
Working branch: website-anti-ai-design-overhaul-2026-11-23  
Base branch: production-upgrade-2026-09-20  
Base commit: ad18b070ad2dd940d1b11f1d106c91e38418064c  
Latest implementation commit at report creation: 974273f8ce2aa040e55bf81d85819803aace0b3f

## Scope and evidence boundary

A recursive Git tree inventory of the base branch contained 1,372 repository entries, including 773 frontend source entries, 301 App Router page/layout source files, 87 component files and five primary application stylesheets.

This implementation directly examined the source for eight route files: /, /about, /contact, /partners, /updates, /team, /login and /academics. It examined 13 shared UI, public-site and dashboard components, plus all five primary stylesheets and the root layout.

**The full 301-route inventory is not equivalent to a full manual route audit.** The changes below target shared sources and a complete subset of public routes. The remaining route-specific source, interaction and visual audits are still open.

No local executable checkout or browser was available through the GitHub source-editing session. Therefore TypeScript, lint, source validation, production build, browser screenshots, responsive viewport checks, axe/WCAG scans and performance measurements were not run. No runtime pass is claimed.

## Implemented changes

### Public website and navigation

- Reworked the homepage into an asymmetric editorial composition with a specific education ERP statement, real product domains and direct sign-in action.
- Added an implementation-specific public stylesheet using the existing institutional green and warm-neutral brand foundation; no new dependency or stock image was added.
- Reworked About, Contact, Partners, Updates and Team into different content structures rather than repeating a three-card layout.
- Replaced the team page's fallback use of the ACADLYX logo as a person's portrait with initials when no genuine image is published.
- Restored existing public routes to the CMS navigation allow-list: Partners, Updates and Team.
- Added current-route indication, aria-controls, aria-expanded, and Escape-to-close behavior to the mobile public navigation.
- Kept CMS values, published media and external links data-driven. Did not add customers, reviews, partnership claims or outcome statistics.

### Authentication

- Restyled the inline login form with the ACADLYX identity and a compact responsive layout.
- Kept the existing credential login, MFA challenge/verification, loading/error handling, and workspaceHome role-based redirect calls.
- Retained the forgot-password destination.
- Source-level preservation was checked; live authentication was not executed.

### Shared authenticated design system

- Replaced blue focus color on the common global controls with the institutional green focus token; used a warm high-contrast focus color on the dark sidebar.
- Replaced the dashboard sidebar's blue active state and blue glow with a forest-green active state and restrained accent marker.
- Removed identical rounded-square backgrounds from the shared sidebar icons.
- Removed shadows from shared dashboard/sidebar surfaces, reduced global shadow strength, removed shared modal backdrop blur, and reduced the global primary button glow.
- Adjusted shared heading weights and introduced a display serif stack with system-font fallbacks; no remote font dependency was added.
- Reworked DashboardPageHeader and the common PageHeader hierarchy to use open layouts and separators instead of card containers.
- Flattened the workspace context header and recommendation list.
- Removed the decorative dash icon from the shared empty state.
- Mapped common blue, indigo, violet and sky primary button utility classes to the existing brand green. This is limited to interactive primary controls; informational/status colors are not globally recolored.
- Retained the existing responsive shell and modal stylesheets rather than rewriting broad selectors without browser evidence.

## Source files changed

1. frontend/src/app/layout.tsx
2. frontend/src/app/public-site.css (new)
3. frontend/src/app/page.tsx
4. frontend/src/app/about/page.tsx
5. frontend/src/app/contact/page.tsx
6. frontend/src/app/partners/page.tsx
7. frontend/src/app/updates/page.tsx
8. frontend/src/app/team/page.tsx
9. frontend/src/app/globals.css
10. frontend/src/app/acadlyx-dashboard-tokens.css
11. frontend/src/app/acadlyx-contrast.css
12. frontend/src/components/public/PublicSiteShell.tsx
13. frontend/src/components/public/InlineLogin.tsx
14. frontend/src/components/dashboard/DashboardPageHeader.tsx
15. frontend/src/components/dashboard/WorkspaceContextHeader.tsx
16. frontend/src/components/dashboard/RecommendationCard.tsx
17. frontend/src/components/ui/AcadlyxDesignSystem.tsx

No backend, database, authorization, route-guard, API contract or production infrastructure files were changed.

## Twenty-issue tracker

Status terms:
- **Addressed in inspected scope**: source-level change is implemented for the named inspected surfaces; not a claim about every route.
- **Partially addressed**: shared or selected surfaces changed; broader page/component coverage remains.
- **Not verified**: evidence is insufficient to determine site-wide completion.

| # | Design issue | Status | Evidence / remaining scope |
|---:|---|---|---|
| 1 | Purple-blue gradients | Partially addressed | Public pages use the institutional green/warm-neutral system; common primary button utility classes are mapped to green and focus tokens are green. A full repository sweep of every page-specific gradient/background remains open. |
| 2 | Dark-mode glow effects | Partially addressed | Shared sidebar active glow, shared card/sidebar shadows, common primary hover glow and modal backdrop blur were removed/reduced. Other module-specific effects were not exhaustively inspected. |
| 3 | 3D blobs and glassmorphism | Partially addressed | No decorative 3D or glass treatment is used in the redesigned public pages; shared modal blur was removed. All module-specific overlays/backgrounds remain to be checked. |
| 4 | Generic stock imagery | Partially addressed | The public team fallback no longer impersonates portraits with the product logo; published CMS imagery is retained. No complete image-by-image inventory was performed. |
| 5 | Repetitive generic icons | Partially addressed | Shared sidebar icon containers and the generic empty-state dash icon were removed. Other route-specific icon usage remains unreviewed. |
| 6 | Generic centered hero | Addressed in inspected scope | Homepage now uses a left-led asymmetric product introduction and a structured platform-coverage index. |
| 7 | Meaningless bento grids | Addressed in inspected scope | Homepage has no bento feature grid; public informational listings use editorial rows. Other internal routes were not exhaustively inventoried for bento layouts. |
| 8 | Excessive rounded cards | Partially addressed | Shared page headers, context headers and recommendation rows are open/divided layouts; common shadows and radii were reduced. Many operational modules still use intentional or legacy card wrappers. |
| 9 | Identical section ordering | Addressed in inspected scope | Home, About, Contact, Partners, Updates and Team have different information structures. Other route families require page-by-page review. |
| 10 | Default typography | Partially addressed | Shared tokens now use a deliberate system sans stack with a serif display stack and no remote font dependency. Cross-platform render consistency and language coverage need browser review. |
| 11 | Weak typographic hierarchy | Partially addressed | Shared page/dashboard headings, card titles and buttons have more restrained weights and scales. Page-level Tailwind overrides remain outside the inspected subset. |
| 12 | Poor line lengths | Addressed in inspected scope | Public body copy and shared page descriptions have constrained reading widths. Long-form and dense operational routes still need review. |
| 13 | Mechanical spacing | Partially addressed | Distinct spacing and responsive composition were added to the public routes and shared page headers. Other route-specific spacing remains unreviewed. |
| 14 | Generic headlines | Addressed in inspected scope | Generic public homepage fallback was replaced with an education ERP-specific statement; route fallback headings explain their destinations. CMS-authored copy is intentionally preserved. |
| 15 | Buzzword-heavy copy | Addressed in inspected scope | Public fallback description now names actual platform areas and role-scoped workspaces. All CMS-published copy and internal route copy remain unreviewed. |
| 16 | Generic CTA labels | Addressed in inspected scope | Homepage CTA explicitly opens sign-in; secondary link names the About destination; partner/update links identify their external action. Site-wide CTA inventory remains open. |
| 17 | Fake social proof | Not verified site-wide | No fabricated social proof was added, and the redesigned homepage does not rely on unsupported testimonials or metrics. Existing CMS content and every route's statistics/claims were not audited. |
| 18 | Dead buttons and placeholders | Not verified site-wide | Public mobile navigation and the real sign-in/MFA flow were source-reviewed. No full control-by-control interaction audit was run for all 301 routes. |
| 19 | Broken responsive layouts | Partially addressed | Public layouts have mobile/tablet breakpoints and the existing shared responsive safeguards were retained. The requested 320–1920px browser matrix was not executed. |
| 20 | Excessive decorative animation | Partially addressed | The redesigned public site introduces no decorative animation and includes reduced-motion styling; shared backdrop blur/glow were reduced. Other module-specific animation and motion components remain unreviewed. |

## Verification ledger

| Check | Result |
|---|---|
| Confirmed exact base branch and SHA | Completed |
| Created isolated working branch from exact base | Completed |
| Source tree inventory | Completed; 1,372 entries, not equivalent to manual review |
| Public route source review | 6 public pages inspected and reworked |
| Additional route source review | Login redirect and Academics page inspected |
| Shared component review | 13 components examined |
| Primary stylesheet review | 5 stylesheets examined |
| Authentication/MFA source preservation | Source-level checks only; not run live |
| Backend/API/permission changes | None made |
| TypeScript/typecheck | Not run |
| Lint | Not run |
| validate:source | Not run |
| Production build | Not run |
| Browser tests/screenshots | Not run |
| 320/360/375/390/430/768/1024/1280/1440/1920px viewport checks | Not run |
| Keyboard/axe/WCAG checks | Not run |
| Lighthouse/Core Web Vitals/bundle measurements | Not run |
| Deployment/production branch modification | Not performed |

## Remaining work

1. Complete the route-by-route audit of the remaining App Router pages and their page-specific components.
2. Search every module for unsupported images, unverified customer claims, generic copy, dead links, inert controls, placeholder content and decorative gradients/animations.
3. Verify all button/form/modal/filter/pagination behaviors with authenticated role fixtures and backend responses.
4. Render all requested viewport widths and inspect tables, dialogs, nested navigation, forms and dashboards.
5. Run the frontend source validator, TypeScript, lint and production build on the exact candidate commit.
6. Run keyboard and screen-reader checks, contrast measurements and performance comparisons.
7. Re-review every page changed by shared CSS for unintended cascade or contrast regressions.

## Release status

**PARTIAL IMPLEMENTATION — NOT READY TO CERTIFY AS A COMPLETE WEBSITE OVERHAUL.**

The isolated branch contains a substantive public-site redesign and shared design-system refinements. It does not yet have evidence to mark all 20 issues resolved across all 301 route files. Do not merge or deploy based solely on this report.
