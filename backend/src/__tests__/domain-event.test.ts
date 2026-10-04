import { strict as assert } from "node:assert";
import test from "node:test";
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

  publishDomainEvent("test.enterprise", {
    institutionId: "institution-a",
    actorId: "actor-a",
    payload: { resourceId: "resource-a" },
  });

  await waitFor(() => received.length === 2);
  assert.deepEqual(received.sort(), ["*:test.enterprise", "test.enterprise"]);

  unsubscribe();
  wildcard();
});
