import { prisma } from "../lib/prisma";

export interface DomainEvent<T = Record<string, unknown>> {
  name: string;
  occurredAt: string;
  institutionId: string | null;
  actorId: string | null;
  payload: T;
}

type Handler = (event: DomainEvent) => void | Promise<void>;

const handlers = new Map<string, Set<Handler>>();

export function subscribeDomainEvent(name: string, handler: Handler): () => void {
  const set = handlers.get(name) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(name, set);
  return () => {
    set.delete(handler);
    if (!set.size) handlers.delete(name);
  };
}

export interface OutboxDrainResult {
  claimed: number;
  processed: number;
  failed: number;
}

async function claimOutboxEvent() {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    institutionId: string | null;
    actorId: string | null;
    name: string;
    payload: unknown;
    occurredAt: Date;
    attempts: number;
  }>>`
    UPDATE "domain_event_outbox"
    SET "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id"
      FROM "domain_event_outbox"
      WHERE "processedAt" IS NULL
        AND "attempts" < 10
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "institutionId", "actorId", "name", "payload", "occurredAt", "attempts";
  `;
  return rows[0] ?? null;
}

export async function drainDomainEventOutbox(limit = 25): Promise<OutboxDrainResult> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit), 100));
  let claimed = 0;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < safeLimit; i += 1) {
    const row = await claimOutboxEvent();
    if (!row) break;
    claimed += 1;

    const event: DomainEvent = {
      name: row.name,
      occurredAt: row.occurredAt.toISOString(),
      institutionId: row.institutionId,
      actorId: row.actorId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    };

    const listeners = [
      ...(handlers.get(event.name) ?? []),
      ...(handlers.get("*") ?? []),
    ];

    try {
      for (const handler of listeners) {
        await handler(event);
      }
      await prisma.domainEventOutbox.update({
        where: { id: row.id },
        data: { processedAt: new Date(), lastError: null },
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      await prisma.domainEventOutbox.update({
        where: { id: row.id },
        data: {
          lastError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
        },
      }).catch(() => undefined);
    }
  }

  return { claimed, processed, failed };
}

export function publishDomainEvent<T extends Record<string, unknown>>(
  name: string,
  context: {
    institutionId?: string | null;
    actorId?: string | null;
    payload?: T;
  },
): void {
  const event: DomainEvent<T> = {
    name,
    occurredAt: new Date().toISOString(),
    institutionId: context.institutionId ?? null,
    actorId: context.actorId ?? null,
    payload: context.payload ?? ({} as T),
  };

  void prisma.domainEventOutbox.create({
    data: {
      institutionId: event.institutionId,
      actorId: event.actorId,
      name: event.name,
      payload: event.payload as object,
      occurredAt: new Date(event.occurredAt),
    },
  }).catch(() => {
    // The outbox must never break the originating business request.
  });

  const listeners = [
    ...(handlers.get(name) ?? []),
    ...(handlers.get("*") ?? []),
  ];

  for (const handler of listeners) {
    Promise.resolve(handler(event)).catch(() => {
      // Domain automation is deliberately isolated from the business request.
    });
  }
}
