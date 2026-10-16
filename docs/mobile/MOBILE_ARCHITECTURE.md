# ACADLYX Mobile Architecture

## Current implementation status

An initial native app foundation is being developed on branch native-mobile-parity-2026-10-17, based on protected branch production-upgrade-2026-09-20 at commit 2dc568ec4416a295028cf64eaa7ee659b9258d89. The protected branch has not been changed.

Technology selection: Expo SDK 57, React Native 0.86, React 19.2 and TypeScript, subject to dependency alignment with Expo Doctor. SDK 58 had just been released; SDK 57 was chosen as the initial supported line while the native foundations are assembled. Exact compatible versions must be resolved and a lockfile committed in a connected build environment.

## Source layout

~~~
mobile/
  App.tsx
  app.json
  package.json
  src/
    api/client.ts
    api/payload.ts
    auth/AuthProvider.tsx
    modules/catalog.ts
    navigation/RootNavigator.tsx
    screens/
      HomeScreen.tsx
      LoginScreen.tsx
      ModuleScreen.tsx
      ModulesScreen.tsx
      AssignmentsScreen.tsx
      NoticesScreen.tsx
      TimetableScreen.tsx
      NotificationsScreen.tsx
      ProfileScreen.tsx
    ui/theme.ts
  scripts/mobile-contract.test.mjs
~~~

## Data flow

1. Sign in through the existing POST /api/v1/auth/login endpoint. MFA-enrolled accounts continue through POST /auth/mfa/verify.
2. Access and refresh tokens are stored with Expo SecureStore. The app does not use local storage or expose privileged database credentials.
3. Protected requests use the existing bearer-token API contract. On one 401 response, the client attempts the existing POST /auth/refresh flow once; if renewal fails, it clears local credentials.
4. Existing API envelopes with success and data fields are unwrapped by the client.
5. Authenticated reads are requested from existing API routes. TanStack Query uses in-memory caching only; the query client is cleared when the authenticated user changes.
6. Backend services, authorization middleware, Prisma transactions and the existing PostgreSQL database remain authoritative. The mobile app does not connect directly to PostgreSQL or Supabase.

## Authorization

The signed-in user and exact roles/permissions are returned by the backend. The module catalog uses known permission keys for navigation usability, not as a security boundary. Every API request must still be authorized server-side against institution, campus, department, programme, academic year/session, batch, semester, section, student ownership and workflow scope.

Context selection is not implemented. Therefore multi-workspace users must not consider their mobile experience release-ready until the app integrates GET /api/v1/workspace/context and invalidates all context-sensitive queries after a permitted scope change.

## Reliability and privacy

- HTTP requests have bounded timeouts and user-safe network/server error messages.
- Mutations receive an X-Idempotency-Key by default, but this does not replace endpoint-specific idempotency or transactional guarantees.
- React Query mutation retries are disabled.
- The generic record view suppresses identifiers and field names matching common credential/secrets patterns. New screens require a field-by-field privacy review.
- No offline writes are queued or shown as successful.
- The generic record screen is read-only. It does not generate CRUD forms or infer approval behavior.

## Current UI

The mobile design tokens use deep green actions, warm neutral surfaces, readable typography and native navigation. The original logo from `frontend/public/branding/acadlyx-logo.png` is included at `mobile/assets/acadlyx-logo.png` and used on sign-in. Dedicated square app-icon, adaptive-icon artwork, splash screen and store artwork still need to be generated from approved brand assets.

## Architectural gaps

The foundation has not been compiled or run on a device in this environment. Dedicated assignment, notice and timetable workflows have been added from inspected backend contracts, but require compile, device and isolated API verification. Module-specific contracts, context switching, dedicated role dashboards, remaining workflow forms, file operations, push/deep links, offline policy and integration/E2E tests remain. Full feature parity is not claimed.