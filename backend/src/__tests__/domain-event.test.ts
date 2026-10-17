import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { subscribeDomainEvent, publishDomainEvent } from "../services/domainEvent.service";

async function waitFor(check: () => boolean, timeoutMs = 1000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for domain event");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("domain events fan out to exact and wildcard subscribers without sharing mutable state", async () => {
  const received: string[] = [];
  const unsubscribe = subscribeDomainEvent("test.enterprise", async (event) => {
    received.push(event.name);
  });
  const wildcard = subscribeDomainEvent("*", (event) => {
    received.push("*:" + event.name);
  });

  // This is a subscriber fan-out unit test, not a persistence integration
  // test. Leave tenant/actor foreign keys null rather than inventing IDs that
  // cannot exist in the database; PostgreSQL persistence is covered separately.
  publishDomainEvent("test.enterprise", {
    institutionId: null,
    actorId: null,
    payload: { resourceId: "resource-a" },
  });

  await waitFor(() => received.length === 2);
  assert.deepEqual(received.sort(), ["*:test.enterprise", "test.enterprise"]);

  unsubscribe();
  wildcard();
});

test("outbox claim uses a lease while handlers run", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "src/services/domainEvent.service.ts"), "utf8");
  const start = source.indexOf("async function claimOutboxEvent(");
  const end = source.indexOf("\nexport async function drainDomainEventOutbox(", start);
  assert.ok(start >= 0 && end > start, "Expected the claim query block");
  const claim = source.slice(start, end);
  assert.ok(claim.includes("make_interval(mins => 5)"), "Claim should install a five-minute lease.");
  assert.ok(claim.includes("institutionFilter"), "Claim should support institution-scoped draining for isolated tests.");
});
