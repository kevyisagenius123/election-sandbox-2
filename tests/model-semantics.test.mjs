import assert from "node:assert/strict";
import test from "node:test";

import { getStateModelSemantics } from "../src/data/modelSemantics.ts";

const supportedStates = ["PA", "MI", "WI"];

test("every detailed state exposes all three explicit Swingometer operation contracts", () => {
  for (const stateCode of supportedStates) {
    const semantics = getStateModelSemantics(stateCode);
    assert.equal(semantics.stateCode, stateCode);
    assert.deepEqual(Object.keys(semantics.operations), ["turnout", "preference", "third-party"]);
    for (const operation of Object.values(semantics.operations)) {
      assert.ok(operation.populationBasis.length > 10);
      assert.ok(operation.changes.length > 10);
      assert.ok(operation.preserves.length > 10);
      assert.ok(operation.boundary.length > 10);
    }
  }
});

test("turnout semantics preserve each state's distinct demographic evidence contract", () => {
  const pa = getStateModelSemantics("PA");
  const mi = getStateModelSemantics("MI");
  const wi = getStateModelSemantics("WI");
  assert.match(pa.turnoutPopulationLabel, /Census voting-age population/);
  assert.match(mi.turnoutPopulationLabel, /bridge/);
  assert.match(wi.turnoutPopulationLabel, /LTSB.*estimate/);
  assert.match(pa.denominatorDisclosure, /not CVAP/);
  assert.match(mi.denominatorDisclosure, /weighted splits/);
  assert.match(wi.denominatorDisclosure, /not CVAP/);
  assert.notEqual(pa.geographyDisclosure, mi.geographyDisclosure);
  assert.notEqual(mi.geographyDisclosure, wi.geographyDisclosure);
});

test("preference and third-party contracts state the ballot invariants plainly", () => {
  const semantics = getStateModelSemantics("PA");
  assert.match(semantics.operations.preference.preserves, /Total ballots/);
  assert.match(semantics.operations.preference.preserves, /third-party totals stay fixed/);
  assert.match(semantics.operations["third-party"].preserves, /ballot total stays fixed/);
  assert.match(semantics.operations.preference.boundary, /full feasible statewide transfer/);
  assert.match(semantics.operations["third-party"].boundary, /zero candidate votes/);
});
