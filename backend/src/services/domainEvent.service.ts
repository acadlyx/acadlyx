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
