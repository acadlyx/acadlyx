import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { logger } from "../utils/logger";

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
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
  const lockToken = randomUUID();
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    institutionId: string | null;
    actorId: string | null;
    name: string;
    payload: unknown;
    occurredAt: Date;
    attempts: number;
    lockToken: string;
  }>>`
    UPDATE "domain_event_outbox"
    SET "attempts" = "attempts" + 1,
        "lastAttemptAt" = CURRENT_TIMESTAMP,
        "lockedAt" = CURRENT_TIMESTAMP,
        "lockToken" = ${lockToken}
    WHERE "id" = (
      SELECT "id"
      FROM "domain_event_outbox"
      WHERE "processedAt" IS NULL
        AND "deadLetteredAt" IS NULL
        AND "attempts" < 10
        AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
        AND ("lockedAt" IS NULL OR "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes')
      ORDER BY "nextAttemptAt" NULLS FIRST, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "institutionId", "actorId", "name", "payload", "occurredAt", "attempts", "lockToken";
  `;
  return rows[0] ?? null;
}

export async function dispatchDomainEvent(event: DomainEvent): Promise<void> {
  const listeners = [
    ...(handlers.get(event.name) ?? []),
    ...(handlers.get("*") ?? []),
  ];
  for (const handler of listeners) {
    await handler(event);
  }
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
      id: row.id,
      name: row.name,
      occurredAt: row.occurredAt.toISOString(),
      institutionId: row.institutionId,
      actorId: row.actorId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
    };

    try {
      await dispatchDomainEvent(event);
      const acknowledged = await prisma.domainEventOutbox.updateMany({
        where: { id: row.id, lockToken: row.lockToken, processedAt: null },
        data: {
          processedAt: new Date(),
          lastError: null,
          nextAttemptAt: null,
          lockedAt: null,
          lockToken: null,
        },
      });
      if (acknowledged.count > 0) processed += 1;
    } catch (error) {
      failed += 1;
      const delayMs = Math.min(15 * 60_000, 5_000 * (2 ** Math.min(Math.max(row.attempts - 1, 0), 8)));
      await prisma.domainEventOutbox.updateMany({
        where: { id: row.id, lockToken: row.lockToken, processedAt: null },
        data: {
          lastError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
          nextAttemptAt: row.attempts < 10 ? new Date(Date.now() + delayMs) : null,
          deadLetteredAt: row.attempts >= 10 ? new Date() : null,
          lockedAt: null,
          lockToken: null,
        },
      }).catch(() => undefined);
      if (row.attempts >= 10) {
        logger.error("Domain event moved to dead-letter state after retry exhaustion", {
          eventId: row.id,
          name: row.name,
          institutionId: row.institutionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
    id: randomUUID(),
    name,
    occurredAt: new Date().toISOString(),
    institutionId: context.institutionId ?? null,
    actorId: context.actorId ?? null,
    payload: context.payload ?? ({} as T),
  };

  void prisma.domainEventOutbox.create({
    data: {
      id: event.id,
      institutionId: event.institutionId,
      actorId: event.actorId,
      name: event.name,
      payload: event.payload as object,
      occurredAt: new Date(event.occurredAt),
    },
  }).catch((error) => {
    logger.error("Failed to persist domain event to outbox", {
      name: event.name,
      institutionId: event.institutionId,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  // The durable outbox is the single delivery path. Dispatching here as well
  // would notify subscribers immediately and then again when the outbox drains.
}
