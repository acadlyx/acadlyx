# ACADLYX Placement Automation Engine

## Scope

This change connects the current Placement APIs, Prisma records, authenticated student views, notification rows, calendar projection, and existing domain-event outbox. It does not add a second placement database or a separate event platform.

## Event and delivery path

The backend writes important placement state transitions and their `DomainEventOutbox` row in the same database transaction. The existing outbox consumer in `backend/src/services/domainEvent.service.ts` claims work with `FOR UPDATE SKIP LOCKED`, processes registered handlers, stores errors, and applies bounded exponential retry backoff. The Placement handler is registered by `backend/src/services/placementAutomation.service.ts` and is loaded by the running API entry point.

Implemented event paths include:

- Drive publication/opening, closing/cancellation, and public-facing drive edits.
- Application submission and application-stage transitions.
- Interview and assessment creation, assignment, publication, rescheduling, and cancellation.
- Placement activity creation, audience updates, publication, rescheduling, and cancellation.
- Offer issue, revision, response, withdrawal, joining verification, and response-deadline reminders.

In-app notifications use stable deduplication keys. Reprocessing an already processed outbox row cannot create another notification; notification inserts also use the database unique key and `skipDuplicates`. Notification links open the student's authenticated Placement view.

## Audience and security rules

Audience resolution uses active student enrollment plus the drive's configured campus, department, programme, batch, semester, graduation-year and eligibility rules, as applicable. Explicit student IDs are revalidated against the institution, Student role, active enrollment and the caller's permitted student scope. Unknown required academic information is not silently treated as eligibility.

The preview endpoint is `POST /api/v1/placements/audience/preview`. Interview, assessment and activity screens show a matching count and sample before scheduled/publication actions. The backend still validates the audience when persisting the activity; a client-side preview is not an authorization boundary.

The student calendar endpoint is `GET /api/v1/placements/my-calendar`. It returns a private projection sourced from the current placement records: eligible drives/deadlines, assigned interviews and assessments, targeted published/cancelled activities, and joining dates. Offer records remain scoped to their student; salary and offer documents are not placed in other students' calendar entries.

Drive and round deletes are intentionally conservative. Only unused drafts without candidate relationships can be permanently deleted. Published/historical activities should be cancelled or retained so audit history is not silently destroyed.

## Scheduled reminders and deployment

Offer response deadlines are checked by `processPlacementDeadlineReminders`, invoked during API startup and then every 60 seconds by the existing API process. The database reminder query is bounded and deduplicated; multiple API replicas cannot insert duplicate reminder notifications because the notification key is unique. No additional worker service is required for these reminders. The existing domain-event outbox drain must remain enabled in the deployed API/worker process.

The migration `20261015235900_placement_automation_reliability` adds outbox retry timestamps/indexing and the offer response-deadline field. The normal Prisma migration deployment step must apply it before new API code is started. In-app notifications are the baseline. This change does **not** claim email, SMS, push or WhatsApp delivery.

## Operational APIs

- `GET /api/v1/placements/automation/failures`: lists unprocessed Placement events that have failed at least once, filtered to the caller's scope.
- `POST /api/v1/placements/automation/failures/:id/retry`: requeues a failed event by resetting its bounded-attempt/backoff state; the original event and stable notification keys are retained.
- `DELETE /api/v1/placements/drives/:id`, `DELETE /api/v1/placements/visits/:id`, `DELETE /api/v1/placements/interviews/:id`, `DELETE /api/v1/placements/tests/:id`: safe draft-only deletion with audit logging.
- `PATCH /api/v1/placements/offers/:id`: audited offer revision while a student response is pending.

Every route retains authentication, feature entitlement, permission checks and service-level institution/campus/department/student scope checks.

## Verification

The PostgreSQL integration test `backend/src/__tests__/placement-automation.integration.test.ts` creates an isolated institution, student, opportunity and application; it inserts a real outbox event, runs the actual consumer and notification subscriber, and verifies the persisted notification plus idempotent re-drain. It runs when `RUN_POSTGRES_INTEGRATION=1` and `DATABASE_URL` is configured.

CI should run the repository's existing checks: `npx prisma validate`, `npx prisma migrate deploy`, backend `npm run typecheck`, `npm run build`, `npm run lint`, `npm test`, frontend `npm run typecheck`, `npm run lint`, and `npm run build`. An integration test is evidence for the covered path only; it is not proof of the remaining live placement journeys, provider delivery, or deployed browser behavior.
