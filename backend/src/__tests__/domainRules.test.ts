/**
 * Domain-rule tests for the money- and transcript-affecting
 * calculations: library fines and the grade scale. Both are pure
 * functions, so they are tested without a database.
 *
 * Run with: npm test
 */
import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  FINE_PER_DAY,
  LOST_BOOK_FINE,
  computeFine,
} from "../services/library.service";
import {
  GRADE_BANDS,
  PASS_PERCENTAGE,
  bandFor,
} from "../services/grading.service";

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 86_400_000);

describe("library fines", () => {
  test("no fine before or on the due date", () => {
    assert.equal(computeFine(daysFromNow(3)), 0);
    assert.equal(computeFine(new Date()), 0);
  });

  test("fine accrues per whole overdue day", () => {
    assert.equal(computeFine(daysFromNow(-1)), FINE_PER_DAY);
    assert.equal(computeFine(daysFromNow(-4)), FINE_PER_DAY * 4);
  });

  test("fine is capped at the replacement cost", () => {
    assert.equal(computeFine(daysFromNow(-3650)), LOST_BOOK_FINE);
  });
});

describe("grade scale", () => {
  test("bands are ordered from highest to lowest", () => {
    for (let i = 1; i < GRADE_BANDS.length; i += 1) {
      assert.ok(
        GRADE_BANDS[i - 1].min > GRADE_BANDS[i].min,
        "each band must sit strictly below the one above it"
      );
      assert.ok(GRADE_BANDS[i - 1].points > GRADE_BANDS[i].points);
    }
  });

  test("the pass mark maps to the lowest passing band", () => {
    const band = bandFor(PASS_PERCENTAGE);
    assert.ok(band.points > 0, "the pass mark must earn grade points");
    assert.equal(bandFor(PASS_PERCENTAGE - 0.1).points, 0);
  });

  test("boundaries are inclusive at the lower edge", () => {
    assert.equal(bandFor(90).letter, "O");
    assert.equal(bandFor(89.9).letter, "A+");
    assert.equal(bandFor(100).letter, "O");
    assert.equal(bandFor(0).letter, "F");
  });
});
