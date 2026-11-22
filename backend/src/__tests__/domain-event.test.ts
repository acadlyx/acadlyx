import { strict as assert } from "node:assert";
import test from "node:test";
import { dispatchDomainEvent, subscribeDomainEvent } from "../services/domainEvent.service";

test("domain events fan out to exact and wildcard subscribers without sharing mutable state", async () => {
  const received: string[] = [];
  const unsubscribe = subscribeDomainEvent("test.enterprise", async (event) => {
    received.push(event.name);
  });
  const wildcard = subscribeDomainEvent("*", (event) => {
    received.push("*:" + event.name);
  });

  await dispatchDomainEvent({
    name: "test.enterprise",
    occurredAt: new Date().toISOString(),
    institutionId: null,
    actorId: null,
    payload: { resourceId: "resource-a" },
  });
  assert.deepEqual(received.sort(), ["*:test.enterprise", "test.enterprise"]);

  unsubscribe();
  wildcard();
});
