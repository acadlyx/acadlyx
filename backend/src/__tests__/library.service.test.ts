import assert from "node:assert/strict";
import test from "node:test";
import { computeFine, FINE_PER_DAY, LOST_BOOK_FINE } from "../services/library.service";

test("library fine accrues only after the due date", () => {
  const due = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(computeFine(due, new Date("2026-10-01T12:00:00.000Z")), 0);
  assert.equal(computeFine(due, new Date("2026-10-02T12:00:00.000Z")), FINE_PER_DAY);
});

test("library fine is capped at replacement charge", () => {
  const due = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(computeFine(due, new Date("2027-01-01T00:00:00.000Z")), LOST_BOOK_FINE);
});
