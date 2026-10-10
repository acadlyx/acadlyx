import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  computeFine,
  calculateLostCharge,
  calculateDamagedCharge,
} from "../services/library.service";

const policy = {
  maxActiveLoans: 5,
  defaultLoanDays: 14,
  maxRenewals: 2,
  gracePeriodDays: 0,
  dailyFine: 5,
  fineCap: 200,
  lostChargeType: "REPLACEMENT_VALUE",
  lostAdministrativeCharge: 0,
  damagedChargeType: "PERCENTAGE",
  damagedChargePercent: 25,
  damagedFixedCharge: 0,
  reservationHoldDays: 3,
} as const;

test("library fine uses the persisted transaction policy, not a global rate", () => {
  const due = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(computeFine(due, { dailyFine: 5, fineCap: 200, gracePeriodDays: 0 }, new Date("2026-10-03T12:00:00.000Z")), 10);
  assert.equal(computeFine(due, { dailyFine: 20, fineCap: 500, gracePeriodDays: 0 }, new Date("2026-10-03T12:00:00.000Z")), 40);
});

test("library fine honors configurable grace period and cap", () => {
  const due = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(computeFine(due, { dailyFine: 10, fineCap: 500, gracePeriodDays: 2 }, new Date("2026-10-03T12:00:00.000Z")), 0);
  assert.equal(computeFine(due, { dailyFine: 10, fineCap: 25, gracePeriodDays: 0 }, new Date("2026-10-10T12:00:00.000Z")), 25);
});

test("lost-book charges use actual copy/book value", () => {
  assert.equal(
    calculateLostCharge(
      { currentValue: 300, replacementValue: 300, acquisitionCost: 250 },
      { defaultReplacementValue: 300, defaultCurrentValue: 280 },
      policy
    ),
    300
  );
  assert.equal(
    calculateLostCharge(
      { currentValue: 2500, replacementValue: 2500, acquisitionCost: 2200 },
      { defaultReplacementValue: 300, defaultCurrentValue: 280 },
      policy
    ),
    2500
  );
});

test("lost-book fixed policy uses configured charge", () => {
  assert.equal(
    calculateLostCharge(
      { currentValue: 2500, replacementValue: 2500, acquisitionCost: 2200 },
      { defaultReplacementValue: 300, defaultCurrentValue: 280 },
      { ...policy, lostChargeType: "FIXED", lostAdministrativeCharge: 175 }
    ),
    175
  );
});

test("damaged-book percentage and fixed policies are configurable", () => {
  assert.equal(
    calculateDamagedCharge(
      { currentValue: 1000, replacementValue: 1200 },
      { defaultReplacementValue: 1200 },
      policy
    ),
    300
  );
  assert.equal(
    calculateDamagedCharge(
      { currentValue: 1000, replacementValue: 1200 },
      { defaultReplacementValue: 1200 },
      { ...policy, damagedChargeType: "FIXED", damagedFixedCharge: 350 }
    ),
    350
  );
  assert.equal(
    calculateDamagedCharge(
      { currentValue: 1000, replacementValue: 1200 },
      { defaultReplacementValue: 1200 },
      { ...policy, damagedChargeType: "NONE" }
    ),
    0
  );
});

test("per-copy replacement value overrides the book default", () => {
  assert.equal(
    calculateLostCharge(
      { currentValue: 900, replacementValue: 2500, acquisitionCost: 700 },
      { defaultReplacementValue: 300, defaultCurrentValue: 280 },
      policy
    ),
    2500
  );
});

test("cancelling a reservation does not masquerade as a physical book return", () => {
  const source = fs.readFileSync(path.resolve(process.cwd(), "src/services/library.service.ts"), "utf8");
  const start = source.indexOf("export async function cancelReservation(");
  const end = source.indexOf("\\nexport async function returnBook(", start);
  assert.ok(start >= 0 && end > start, "Expected reservation cancellation service");
  const cancellation = source.slice(start, end);
  assert.match(cancellation, /status: "CANCELLED"/);
  assert.match(cancellation, /returnedAt: null/);
  assert.doesNotMatch(cancellation, /status: "RETURNED"/);
});
