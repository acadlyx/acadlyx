# ACADLYX Protected Route Rendering Audit

## Findings

### Root cause

ACADLYX authentication credentials are intentionally stored in per-tab `sessionStorage` so multiple accounts can remain authenticated independently in different browser tabs.

That has an important architectural consequence: Next.js server middleware cannot authenticate a request using the current tab's session because `sessionStorage` exists only in the browser tab. Replacing it with an origin-wide cookie would reintroduce the multi-tab account collision that was fixed previously.

The protected-route flash therefore came from client-side guards running after protected page components had already been mounted. Several pages also performed dashboard API requests from `useEffect` before the shared dashboard shell had resolved the current identity.

### Safe architecture after this change

1. `DashboardShell` is fail-closed and renders no workspace chrome or children until an authenticated user exists.
2. A centralized `ProtectedRouteBoundary` validates the current tab's session and route authorization before protected route children are mounted during client navigation.
3. The boundary uses the centralized RBAC registry in `frontend/src/lib/navigation.ts`; it does not introduce a second role system.
4. Authentication failures redirect to `/login`.
5. Authenticated users without route permission are redirected to their authorized workspace.
6. Session expiry follows the existing secure refresh/logout path; if refresh cannot establish the session, the route remains empty and the user is sent to `/login`.
7. Protected child effects cannot start from the route boundary while authentication is unresolved.
8. API endpoints remain independently protected by backend authentication, permission checks, and institution scope.

### Why Next.js middleware was not used for identity validation

The current ACADLYX browser session model is tab-scoped. Middleware executes on the server and cannot read browser `sessionStorage`. A shared authentication cookie would make the four-account-in-four-tabs requirement impossible.

Next.js documentation recommends server-side route protection when a server-readable session exists; that model does not apply to ACADLYX's tab-scoped browser credential model without changing the session architecture.

### Protected route families audited

- /superadmin
- /admin
- /student/**
- /faculty/**
- /parent/**
- /chairman
- /director
- /management
- /dean
- /registrar
- /hod/**
- /accounts
- /hr
- /admissions/**
- /applications
- /examination/**
- /examinations/**
- /library/**
- /placements/**
- /it
- /imports
- /operations/**
- /timetable/**
- /reports/**
- /intelligence
- /students/**
- /user-management
- /calendar/**
- /notices
- /notifications
- /fees/**
- /obe/**
- /payments/**
- /course-registration/**
- /student-promotion/**
- /certificates/**
- /results/**
- /assignments/**
- /attendance/**
- /marks/**
- /courses/**
- /academics/**
- /employees
- /leave-management/**
- /account-security
- /site-content

Public routes remain outside the protection boundary:

- /
- /about
- /contact
- /team
- /login
- /forgot-password
- /reset-password

## OBE / PO audit

ACADLYX already contains a full Programme Outcome (PO) / Programme Specific Outcome (PSO) creation flow alongside Course Outcomes (COs).

Existing backend endpoints:

- `GET /obe/programs/:programId/outcomes`
- `POST /obe/programs/:programId/outcomes`
- `PATCH /obe/outcomes/:id`

The OBE UI already exposes a **Programme Outcomes / PSOs** add module with:

- PO / PSO selector
- outcome code
- description
- Add action
- programme-scoped backend validation
- duplicate PO/PSO-code protection
- CO–PO/PSO mapping matrix

No duplicate PO module was introduced because the requested functionality already exists.

## Security note

Frontend route protection is a rendering/UX boundary, not the API security boundary. Backend endpoints continue to require bearer authentication and permission checks. Tenant/institution scope remains enforced server-side.
