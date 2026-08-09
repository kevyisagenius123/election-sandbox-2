import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProbabilityVector,
  assertResultReconciles,
  largestRemainder,
} from "../packages/election-model/src/invariants.ts";

test("largest remainder preserves the required integer total", () => {
  const allocated = largestRemainder([10.4, 5.4, 4.2], 20);
  assert.deepEqual(allocated, [11, 5, 4]);
  assert.equal(allocated.reduce((sum, value) => sum + value, 0), 20);
});

test("reporting-unit totals must reconcile", () => {
  assert.doesNotThrow(() => assertResultReconciles({
    reportingUnitId: "pa-erie-12-03",
    contestId: "2024-president",
    votes: [
      { candidateId: "harris", partyId: "democratic", votes: 530 },
      { candidateId: "trump", partyId: "republican", votes: 460 },
      { candidateId: "other", partyId: null, votes: 10 },
    ],
    totalVotes: 1000,
    ballotMode: null,
  }));

  assert.throws(() => assertResultReconciles({
    reportingUnitId: "broken-unit",
    contestId: "2024-president",
    votes: [{ candidateId: "harris", partyId: "democratic", votes: 9 }],
    totalVotes: 10,
    ballotMode: null,
  }), /candidates sum to 9/);
});

test("candidate probabilities must be a valid vector", () => {
  assert.doesNotThrow(() => assertProbabilityVector([0.49, 0.48, 0.03]));
  assert.throws(() => assertProbabilityVector([0.6, 0.5]), /sum to/);
  assert.throws(() => assertProbabilityVector([1.1, -0.1]), /between zero and one/);
});
