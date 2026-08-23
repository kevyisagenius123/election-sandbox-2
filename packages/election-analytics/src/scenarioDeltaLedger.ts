import type {
  BehaviorModelUnit,
  BehaviorScenarioResult,
  BehaviorScenarioUnit,
  StatewidePresidentialResult,
  ThirdPartyCandidate,
} from "../../election-model/src/scenario.ts";
import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "../../election-replay/src/canonical.ts";
import { isSha256Fingerprint, sha256Fingerprint } from "../../election-replay/src/hash.ts";
import {
  createAnalyticCollection,
  createAnalyticEnvelope,
  type AnalyticEnvelope,
} from "./contracts.ts";
import {
  ANALYTIC_REGISTRY_VERSION,
  type AnalyticDefinitionId,
} from "./registry.ts";
import {
  SCENARIO_DELTA_LEDGER_SCHEMA_VERSION,
  SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION,
  type CreateScenarioDeltaLedgerInput,
  type FingerprintedScenarioDeltaLedger,
  type ScenarioCandidateVector,
  type ScenarioCountyDeltaRow,
  type ScenarioDeltaLedger,
  type ScenarioDeltaOperationId,
  type ScenarioDeltaPartition,
  type ScenarioOperationDelta,
  type ScenarioOperationLedgerRow,
  type ScenarioUnitDeltaRow,
  type ScenarioVoteDelta,
} from "./scenarioDeltaContracts.ts";

const operationIds = ["turnout", "preference", "third-party"] as const;
const vectorFields = [
  "harrisVotes",
  "trumpVotes",
  "steinVotes",
  "oliverVotes",
  "residualOtherVotes",
  "otherVotes",
  "totalVotes",
] as const;

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireText(value: string, label: string) {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) throw new Error(`${label} must be nonempty`);
  return normalized;
}

function requireSafeInteger(value: number, label: string, nonnegative = false) {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) {
    throw new Error(`${label} must be ${nonnegative ? "a non-negative " : "a "}safe integer`);
  }
  return value;
}

function zeroVector(): ScenarioCandidateVector {
  return {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
  };
}

function zeroDelta(): ScenarioVoteDelta {
  return { ...zeroVector(), harrisTrumpMarginVotes: 0 };
}

function candidateVector(unit: BehaviorModelUnit | BehaviorScenarioUnit): ScenarioCandidateVector {
  return {
    harrisVotes: unit.harrisVotes,
    trumpVotes: unit.trumpVotes,
    steinVotes: unit.steinVotes,
    oliverVotes: unit.oliverVotes,
    residualOtherVotes: unit.residualOtherVotes,
    otherVotes: unit.otherVotes,
    totalVotes: unit.totalVotes,
  };
}

function totalsVector(totals: BehaviorScenarioResult["totals"]): ScenarioCandidateVector {
  return { ...totals };
}

function addVectors<T extends ScenarioCandidateVector>(left: T, right: ScenarioCandidateVector): T {
  const sum = { ...left };
  for (const field of vectorFields) sum[field] += right[field];
  if ("harrisTrumpMarginVotes" in sum && "harrisTrumpMarginVotes" in right) {
    (sum as ScenarioVoteDelta).harrisTrumpMarginVotes += (
      right as ScenarioVoteDelta
    ).harrisTrumpMarginVotes;
  }
  return sum;
}

function subtractVectors(
  scenario: ScenarioCandidateVector,
  certified: ScenarioCandidateVector,
): ScenarioVoteDelta {
  const delta = zeroDelta();
  for (const field of vectorFields) delta[field] = scenario[field] - certified[field];
  delta.harrisTrumpMarginVotes = delta.harrisVotes - delta.trumpVotes;
  return delta;
}

function validateCandidateVector(vector: ScenarioCandidateVector, label: string, signed: boolean) {
  for (const field of vectorFields) requireSafeInteger(vector[field], `${label} ${field}`, !signed);
  if (vector.steinVotes + vector.oliverVotes + vector.residualOtherVotes !== vector.otherVotes) {
    throw new Error(`${label} named other votes do not reconcile`);
  }
  if (vector.harrisVotes + vector.trumpVotes + vector.otherVotes !== vector.totalVotes) {
    throw new Error(`${label} candidate votes do not reconcile`);
  }
  if ("harrisTrumpMarginVotes" in vector
    && vector.harrisTrumpMarginVotes !== vector.harrisVotes - vector.trumpVotes) {
    throw new Error(`${label} Harris-Trump margin does not reconcile`);
  }
}

function assertVectorEqual(
  actual: ScenarioCandidateVector,
  expected: ScenarioCandidateVector,
  label: string,
) {
  for (const field of vectorFields) {
    if (actual[field] !== expected[field]) throw new Error(`${label} ${field} does not reconcile`);
  }
  if ("harrisTrumpMarginVotes" in actual && "harrisTrumpMarginVotes" in expected
    && actual.harrisTrumpMarginVotes !== expected.harrisTrumpMarginVotes) {
    throw new Error(`${label} Harris-Trump margin does not reconcile`);
  }
}

function selectedThirdPartyField(candidate: ThirdPartyCandidate) {
  if (candidate === "residual_other") return "residualOtherVotes" as const;
  return `${candidate}Votes` as "steinVotes" | "oliverVotes";
}

function unitOperationDeltas(
  baseline: BehaviorModelUnit,
  scenario: BehaviorScenarioUnit,
  thirdPartyCandidate: ThirdPartyCandidate,
): readonly ScenarioOperationDelta[] {
  const turnout = zeroDelta();
  turnout.harrisVotes = scenario.turnoutHarrisVotes;
  turnout.trumpVotes = scenario.turnoutTrumpVotes;
  turnout.totalVotes = scenario.turnoutAddedVotes;
  turnout.harrisTrumpMarginVotes = turnout.harrisVotes - turnout.trumpVotes;

  const preference = zeroDelta();
  preference.harrisVotes = scenario.preferenceNetHarrisGain;
  preference.trumpVotes = -scenario.preferenceNetHarrisGain;
  preference.harrisTrumpMarginVotes = preference.harrisVotes - preference.trumpVotes;

  const totalDelta = subtractVectors(candidateVector(scenario), candidateVector(baseline));
  const thirdParty = zeroDelta();
  for (const field of vectorFields) {
    thirdParty[field] = totalDelta[field] - turnout[field] - preference[field];
  }
  thirdParty.harrisTrumpMarginVotes = thirdParty.harrisVotes - thirdParty.trumpVotes;
  if (thirdParty[selectedThirdPartyField(thirdPartyCandidate)] !== scenario.thirdPartyCandidateDelta) {
    throw new Error(`${scenario.id} third-party candidate delta does not reconcile`);
  }
  validateCandidateVector(turnout, `${scenario.id} turnout delta`, true);
  validateCandidateVector(preference, `${scenario.id} preference delta`, true);
  validateCandidateVector(thirdParty, `${scenario.id} third-party delta`, true);

  return Object.freeze([
    deepFreeze({ operationId: "turnout" as const, delta: turnout }),
    deepFreeze({ operationId: "preference" as const, delta: preference }),
    deepFreeze({ operationId: "third-party" as const, delta: thirdParty }),
  ]);
}

function sumOperation(
  rows: readonly Pick<ScenarioUnitDeltaRow, "operations">[],
  operationId: ScenarioDeltaOperationId,
) {
  return rows.reduce((sum, row) => {
    const operation = row.operations.find((candidate) => candidate.operationId === operationId);
    if (!operation) throw new Error(`Missing ${operationId} operation attribution`);
    return addVectors(sum, operation.delta);
  }, zeroDelta());
}

function sumRows(rows: readonly Pick<ScenarioUnitDeltaRow, "certified" | "scenario" | "delta">[]) {
  return rows.reduce((sum, row) => {
    sum.certified = addVectors(sum.certified, row.certified);
    sum.scenario = addVectors(sum.scenario, row.scenario);
    sum.delta = addVectors(sum.delta, row.delta);
    return sum;
  }, { certified: zeroVector(), scenario: zeroVector(), delta: zeroDelta() });
}

function aggregateOperations(rows: readonly Pick<ScenarioUnitDeltaRow, "operations">[]) {
  return Object.freeze(operationIds.map((operationId) => deepFreeze({
    operationId,
    delta: sumOperation(rows, operationId),
  })));
}

function aggregateCountyRows(units: readonly ScenarioUnitDeltaRow[]) {
  const byCounty = new Map<string, ScenarioUnitDeltaRow[]>();
  for (const unit of units) {
    if (!unit.countyFips) continue;
    const rows = byCounty.get(unit.countyFips) ?? [];
    rows.push(unit);
    byCounty.set(unit.countyFips, rows);
  }
  return [...byCounty.entries()]
    .sort(([left], [right]) => canonicalStringCompare(left, right))
    .map(([countyFips, rows]): ScenarioCountyDeltaRow => {
      const totals = sumRows(rows);
      const mappedCount = rows.filter((row) => row.mapStatus === "mapped").length;
      return deepFreeze({
        id: countyFips,
        countyFips,
        mapStatus: mappedCount === rows.length ? "mapped" : mappedCount === 0 ? "off-map" : "mixed",
        unitCount: rows.length,
        ...totals,
        operations: aggregateOperations(rows),
      });
    });
}

function aggregateResidualRow(units: readonly ScenarioUnitDeltaRow[], stateCode: string) {
  const rows = units.filter((unit) => unit.countyFips === null);
  if (rows.length === 0) return null;
  return deepFreeze({
    id: `${stateCode}:statewide-residual`,
    mapStatus: "off-map" as const,
    unitCount: rows.length,
    ...sumRows(rows),
    operations: aggregateOperations(rows),
  });
}

function partition(
  id: ScenarioDeltaPartition["id"],
  rows: readonly ScenarioUnitDeltaRow[],
): ScenarioDeltaPartition {
  return deepFreeze({ id, unitCount: rows.length, delta: sumRows(rows).delta });
}

function buildLedgerAnalytics(ledger: Omit<ScenarioDeltaLedger, "analytics">) {
  const context = {
    sourceIds: ledger.sourceIds,
    transformVersion: SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION,
  } as const;
  const geography = { level: "state", id: ledger.stateCode } as const;
  const analytics: AnalyticEnvelope[] = [];
  for (const [semanticClass, endpoint] of [
    ["certified", ledger.certified],
    ["scenario", ledger.scenario],
  ] as const) {
    analytics.push(
      createAnalyticEnvelope({
        ...context,
        definitionId: `${semanticClass}.total-ballots`,
        value: endpoint.totalVotes,
        geography,
        candidateScope: ["all-candidates"],
      }),
      ...(["harris", "trump", "other"] as const).map((candidate) => createAnalyticEnvelope({
        ...context,
        definitionId: `${semanticClass}.candidate-votes`,
        value: endpoint[`${candidate}Votes`],
        geography,
        candidateScope: [candidate],
      })),
      createAnalyticEnvelope({
        ...context,
        definitionId: `${semanticClass}.harris-trump-margin-votes`,
        value: endpoint.harrisVotes - endpoint.trumpVotes,
        geography,
        candidateScope: ["harris", "trump"],
      }),
    );
  }
  const selectedCandidate = ledger.operations[2].selectedCandidate;
  if (!selectedCandidate) throw new Error("Third-party operation requires a selected candidate");
  const selectedCandidateId = selectedCandidate === "residual_other"
    ? "other-residual"
    : selectedCandidate;
  const operationDefinitions: readonly [AnalyticDefinitionId, number, readonly string[]][] = [
    ["scenario.turnout-requested-ballots", ledger.operations[0].requestedVolume, ["harris", "trump"]],
    ["scenario.turnout-realized-ballots", ledger.operations[0].realizedVolume, ["harris", "trump"]],
    ["scenario.preference-requested-transfers", ledger.operations[1].requestedVolume, ["harris", "trump"]],
    ["scenario.preference-realized-transfers", ledger.operations[1].realizedVolume, ["harris", "trump"]],
    ["scenario.third-party-requested-exchanges", ledger.operations[2].requestedVolume, [
      "harris", "trump", selectedCandidateId,
    ]],
    ["scenario.third-party-realized-exchanges", ledger.operations[2].realizedVolume, [
      "harris", "trump", selectedCandidateId,
    ]],
  ];
  for (const [definitionId, value, candidateScope] of operationDefinitions) {
    analytics.push(createAnalyticEnvelope({
      ...context,
      definitionId,
      value,
      geography,
      candidateScope,
    }));
  }
  analytics.push(createAnalyticEnvelope({
    ...context,
    definitionId: ledger.contributionDefinitionId,
    value: ledger.delta.harrisTrumpMarginVotes,
    geography,
    candidateScope: ["harris", "trump"],
    caveat: "County and reporting-unit breakdowns are carried by the canonical scenario delta ledger.",
  }));
  analytics.push(createAnalyticEnvelope({
    ...context,
    definitionId: "derived.electoral-vote-consequence",
    value: ledger.electoral.targetElectoralDelta,
    geography: { level: "national", id: "US" },
    candidateScope: [ledger.electoral.targetCandidate],
  }));
  return createAnalyticCollection(analytics);
}

function stateVectorFromUnits(units: readonly BehaviorModelUnit[]) {
  return units.reduce((sum, unit) => addVectors(sum, candidateVector(unit)), zeroVector());
}

function validateStateEndpoint(
  endpoint: StatewidePresidentialResult,
  vector: ScenarioCandidateVector,
  label: string,
) {
  if (endpoint.harrisVotes !== vector.harrisVotes
    || endpoint.trumpVotes !== vector.trumpVotes
    || endpoint.otherVotes !== vector.otherVotes
    || endpoint.totalVotes !== vector.totalVotes) {
    throw new Error(`${label} endpoint does not reconcile to detailed units`);
  }
  requireSafeInteger(endpoint.harrisElectoralVotes, `${label} Harris electoral votes`, true);
  requireSafeInteger(endpoint.trumpElectoralVotes, `${label} Trump electoral votes`, true);
}

export function createScenarioDeltaLedger(input: CreateScenarioDeltaLedgerInput): ScenarioDeltaLedger {
  const stateCode = requireText(input.actualState.code, "State code").toUpperCase();
  if (input.scenarioState.code !== stateCode) throw new Error("Scenario state code does not match baseline");
  if (input.scenario.units.length !== input.baselineUnits.length) {
    throw new Error("Scenario delta ledger requires the same baseline and scenario units");
  }
  const baselineById = new Map<string, BehaviorModelUnit>();
  for (const unit of input.baselineUnits) {
    const id = requireText(unit.id, "Baseline unit identity");
    if (baselineById.has(id)) throw new Error(`Duplicate baseline unit ${id}`);
    baselineById.set(id, unit);
  }
  const scenarioById = new Map<string, BehaviorScenarioUnit>();
  for (const unit of input.scenario.units) {
    const id = requireText(unit.id, "Scenario unit identity");
    if (scenarioById.has(id)) throw new Error(`Duplicate scenario unit ${id}`);
    scenarioById.set(id, unit);
  }
  if ([...baselineById.keys()].some((id) => !scenarioById.has(id))) {
    throw new Error("Scenario delta ledger unit identities do not reconcile");
  }

  const units = [...baselineById.keys()].sort(canonicalStringCompare).map((id): ScenarioUnitDeltaRow => {
    const baseline = baselineById.get(id)!;
    const scenario = scenarioById.get(id)!;
    if (baseline.countyFips !== scenario.countyFips || baseline.geometryId !== scenario.geometryId) {
      throw new Error(`${id} changed its geography identity`);
    }
    const certified = candidateVector(baseline);
    const scenarioVector = candidateVector(scenario);
    validateCandidateVector(certified, `${id} certified`, false);
    validateCandidateVector(scenarioVector, `${id} scenario`, false);
    const delta = subtractVectors(scenarioVector, certified);
    const operations = unitOperationDeltas(baseline, scenario, input.scenario.thirdParty.candidate);
    const operationTotal = operations.reduce((sum, operation) => addVectors(sum, operation.delta), zeroDelta());
    assertVectorEqual(operationTotal, delta, `${id} operation attribution`);
    return deepFreeze({
      id,
      countyFips: baseline.countyFips,
      geometryId: baseline.geometryId,
      mapStatus: baseline.geometryId ? "mapped" : "off-map",
      certified,
      scenario: scenarioVector,
      delta,
      operations,
    });
  });

  const certified = stateVectorFromUnits(input.baselineUnits);
  const scenario = totalsVector(input.scenario.totals);
  validateCandidateVector(certified, `${stateCode} certified`, false);
  validateCandidateVector(scenario, `${stateCode} scenario`, false);
  validateStateEndpoint(input.actualState, certified, "Certified state");
  validateStateEndpoint(input.scenarioState, scenario, "Scenario state");
  assertVectorEqual(sumRows(units).certified, certified, `${stateCode} certified units`);
  assertVectorEqual(sumRows(units).scenario, scenario, `${stateCode} scenario units`);
  const delta = subtractVectors(scenario, certified);

  const operationDeltas = Object.fromEntries(operationIds.map((operationId) => [
    operationId,
    sumOperation(units, operationId),
  ])) as Record<ScenarioDeltaOperationId, ScenarioVoteDelta>;
  const operations: readonly ScenarioOperationLedgerRow[] = Object.freeze([
    deepFreeze({
      operationId: "turnout" as const,
      requestedVolume: input.scenario.turnout.requestedVotes,
      realizedVolume: input.scenario.turnout.addedVotes,
      selectedCandidate: null,
      delta: operationDeltas.turnout,
    }),
    deepFreeze({
      operationId: "preference" as const,
      requestedVolume: input.scenario.preference.requestedTransfer,
      realizedVolume: input.scenario.preference.realizedTransfer,
      selectedCandidate: null,
      delta: operationDeltas.preference,
    }),
    deepFreeze({
      operationId: "third-party" as const,
      requestedVolume: input.scenario.thirdParty.requestedCandidateDelta,
      realizedVolume: input.scenario.thirdParty.realizedCandidateDelta,
      selectedCandidate: input.scenario.thirdParty.candidate,
      delta: operationDeltas["third-party"],
    }),
  ]);
  const operationTotal = operations.reduce((sum, operation) => addVectors(sum, operation.delta), zeroDelta());
  assertVectorEqual(operationTotal, delta, `${stateCode} operation ledger`);
  if (operations[0].delta.harrisVotes !== input.scenario.turnout.harrisVotes
    || operations[0].delta.trumpVotes !== input.scenario.turnout.trumpVotes
    || operations[1].delta.harrisVotes !== input.scenario.preference.realizedTransfer
    || operations[2].delta.harrisVotes !== input.scenario.thirdParty.harrisVoteDelta
    || operations[2].delta.trumpVotes !== input.scenario.thirdParty.trumpVoteDelta) {
    throw new Error(`${stateCode} operation audit values do not reconcile`);
  }

  const counties = Object.freeze(aggregateCountyRows(units));
  const statewideResidual = aggregateResidualRow(units, stateCode);
  const mappedUnits = units.filter((unit) => unit.mapStatus === "mapped");
  const offMapUnits = units.filter((unit) => unit.mapStatus === "off-map");
  const statewideResidualUnits = units.filter((unit) => unit.countyFips === null);
  const partitions = Object.freeze([
    partition("mapped", mappedUnits),
    partition("off-map", offMapUnits),
    partition("statewide-residual", statewideResidualUnits),
  ]);
  const totalElectoralVotes = input.actualState.harrisElectoralVotes + input.actualState.trumpElectoralVotes;
  if (input.scenarioState.harrisElectoralVotes + input.scenarioState.trumpElectoralVotes !== totalElectoralVotes) {
    throw new Error("Scenario Electoral College allocation does not reconcile");
  }
  const candidateElectoralVotes = (state: StatewidePresidentialResult) => (
    input.targetCandidate === "harris" ? state.harrisElectoralVotes : state.trumpElectoralVotes
  );
  const electoral = deepFreeze({
    targetCandidate: input.targetCandidate,
    actualHarrisElectoralVotes: input.actualState.harrisElectoralVotes,
    actualTrumpElectoralVotes: input.actualState.trumpElectoralVotes,
    scenarioHarrisElectoralVotes: input.scenarioState.harrisElectoralVotes,
    scenarioTrumpElectoralVotes: input.scenarioState.trumpElectoralVotes,
    targetElectoralDelta: candidateElectoralVotes(input.scenarioState) - candidateElectoralVotes(input.actualState),
    winnerChanged: (input.actualState.harrisVotes > input.actualState.trumpVotes)
      !== (input.scenarioState.harrisVotes > input.scenarioState.trumpVotes),
  });
  const sourceIds = Object.freeze([...new Set(input.sourceIds.map((source) => requireText(source, "Source identity")))]
    .sort(canonicalStringCompare));
  if (sourceIds.length !== input.sourceIds.length || sourceIds.length === 0) {
    throw new Error("Source identities must be nonempty and unique");
  }
  const withoutAnalytics = {
    schemaVersion: SCENARIO_DELTA_LEDGER_SCHEMA_VERSION,
    registryVersion: ANALYTIC_REGISTRY_VERSION,
    transformVersion: SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION,
    stateCode,
    sourceIds,
    contributionDefinitionId: "derived.geography-margin-contribution-votes" as const,
    certified,
    scenario,
    delta,
    operations,
    units: Object.freeze(units),
    counties,
    statewideResidual,
    partitions,
    electoral,
  } as const;
  return deepFreeze({ ...withoutAnalytics, analytics: buildLedgerAnalytics(withoutAnalytics) });
}

function normalizedCandidateVector(
  vector: ScenarioCandidateVector,
  label: string,
): ScenarioCandidateVector {
  const normalized = Object.fromEntries(vectorFields.map((field) => [
    field,
    requireSafeInteger(vector[field], `${label} ${field}`, true),
  ])) as unknown as ScenarioCandidateVector;
  validateCandidateVector(normalized, label, false);
  return normalized;
}

function normalizedDelta(vector: ScenarioVoteDelta, label: string): ScenarioVoteDelta {
  const normalized = {
    ...Object.fromEntries(vectorFields.map((field) => [
      field,
      requireSafeInteger(vector[field], `${label} ${field}`),
    ])),
    harrisTrumpMarginVotes: requireSafeInteger(
      vector.harrisTrumpMarginVotes,
      `${label} Harris-Trump margin`,
    ),
  } as unknown as ScenarioVoteDelta;
  validateCandidateVector(normalized, label, true);
  return normalized;
}

function normalizedOperationDeltas(
  operations: readonly ScenarioOperationDelta[],
  label: string,
) {
  if (operations.length !== operationIds.length) throw new Error(`${label} must contain three operations`);
  const byId = new Map(operations.map((operation) => [operation.operationId, operation]));
  if (byId.size !== operationIds.length) throw new Error(`${label} contains duplicate operations`);
  return Object.freeze(operationIds.map((operationId) => {
    const operation = byId.get(operationId);
    if (!operation) throw new Error(`${label} is missing ${operationId}`);
    return deepFreeze({
      operationId,
      delta: normalizedDelta(operation.delta, `${label} ${operationId}`),
    });
  }));
}

function assertSignedRealization(requested: number, realized: number, label: string) {
  if (Math.abs(realized) > Math.abs(requested)
    || (realized !== 0 && Math.sign(realized) !== Math.sign(requested))) {
    throw new Error(`${label} realized volume cannot exceed or reverse its request`);
  }
}

function validateStateOperationSemantics(operations: readonly ScenarioOperationLedgerRow[]) {
  const turnout = operations[0];
  if (turnout.requestedVolume < 0 || turnout.realizedVolume < 0
    || turnout.realizedVolume > turnout.requestedVolume
    || turnout.delta.totalVotes !== turnout.realizedVolume
    || turnout.delta.harrisVotes < 0
    || turnout.delta.trumpVotes < 0
    || turnout.delta.harrisVotes + turnout.delta.trumpVotes !== turnout.realizedVolume
    || turnout.delta.otherVotes !== 0) {
    throw new Error("Turnout operation volume and vote delta do not reconcile");
  }

  const preference = operations[1];
  assertSignedRealization(preference.requestedVolume, preference.realizedVolume, "Preference operation");
  if (preference.delta.harrisVotes !== preference.realizedVolume
    || preference.delta.trumpVotes !== -preference.realizedVolume
    || preference.delta.otherVotes !== 0
    || preference.delta.totalVotes !== 0) {
    throw new Error("Preference operation volume and vote delta do not reconcile");
  }

  const thirdParty = operations[2];
  assertSignedRealization(thirdParty.requestedVolume, thirdParty.realizedVolume, "Third-party operation");
  const selectedField = selectedThirdPartyField(thirdParty.selectedCandidate!);
  const otherNamedFields = ["steinVotes", "oliverVotes", "residualOtherVotes"] as const;
  if (thirdParty.delta[selectedField] !== thirdParty.realizedVolume
    || otherNamedFields.some((field) => field !== selectedField && thirdParty.delta[field] !== 0)
    || thirdParty.delta.otherVotes !== thirdParty.realizedVolume
    || thirdParty.delta.totalVotes !== 0) {
    throw new Error("Third-party operation volume and vote delta do not reconcile");
  }
}

export function validateScenarioDeltaLedger(candidate: ScenarioDeltaLedger): ScenarioDeltaLedger {
  if (candidate.schemaVersion !== SCENARIO_DELTA_LEDGER_SCHEMA_VERSION
    || candidate.registryVersion !== ANALYTIC_REGISTRY_VERSION
    || candidate.transformVersion !== SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION) {
    throw new Error("Scenario delta ledger version is incompatible");
  }
  const stateCode = requireText(candidate.stateCode, "State code").toUpperCase();
  const sourceIds = Object.freeze(candidate.sourceIds
    .map((source) => requireText(source, "Source identity"))
    .sort(canonicalStringCompare));
  if (sourceIds.length === 0 || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error("Source identities must be nonempty and unique");
  }
  if (candidate.contributionDefinitionId !== "derived.geography-margin-contribution-votes") {
    throw new Error("Scenario contribution definition is incompatible");
  }
  const certified = normalizedCandidateVector(candidate.certified, `${stateCode} certified`);
  const scenario = normalizedCandidateVector(candidate.scenario, `${stateCode} scenario`);
  const delta = normalizedDelta(candidate.delta, `${stateCode} delta`);
  assertVectorEqual(delta, subtractVectors(scenario, certified), `${stateCode} endpoint delta`);

  if (candidate.operations.length !== operationIds.length) {
    throw new Error("Scenario delta ledger must contain three state operations");
  }
  const operationById = new Map(candidate.operations.map((operation) => [operation.operationId, operation]));
  if (operationById.size !== operationIds.length) throw new Error("State operation ledger contains duplicates");
  const operations = Object.freeze(operationIds.map((operationId): ScenarioOperationLedgerRow => {
    const operation = operationById.get(operationId);
    if (!operation) throw new Error(`State operation ledger is missing ${operationId}`);
    const selectedCandidate = operationId === "third-party"
      ? operation.selectedCandidate
      : null;
    if (operationId === "third-party"
      && !["stein", "oliver", "residual_other"].includes(selectedCandidate ?? "")) {
      throw new Error("Third-party operation candidate is invalid");
    }
    if (operationId !== "third-party" && operation.selectedCandidate !== null) {
      throw new Error(`${operationId} cannot select a third-party candidate`);
    }
    return deepFreeze({
      operationId,
      requestedVolume: requireSafeInteger(operation.requestedVolume, `${operationId} requested volume`),
      realizedVolume: requireSafeInteger(operation.realizedVolume, `${operationId} realized volume`),
      selectedCandidate: selectedCandidate as ThirdPartyCandidate | null,
      delta: normalizedDelta(operation.delta, `${operationId} state delta`),
    });
  }));
  validateStateOperationSemantics(operations);
  assertVectorEqual(
    operations.reduce((sum, operation) => addVectors(sum, operation.delta), zeroDelta()),
    delta,
    `${stateCode} state operations`,
  );

  const unitIds = new Set<string>();
  const units = Object.freeze(candidate.units.map((unit): ScenarioUnitDeltaRow => {
    const id = requireText(unit.id, "Reporting-unit identity");
    if (unitIds.has(id)) throw new Error(`Duplicate reporting-unit identity ${id}`);
    unitIds.add(id);
    const countyFips = unit.countyFips === null ? null : requireText(unit.countyFips, `${id} county`);
    const geometryId = unit.geometryId === null ? null : requireText(unit.geometryId, `${id} geometry`);
    const mapStatus = geometryId ? "mapped" as const : "off-map" as const;
    if (unit.mapStatus !== mapStatus) throw new Error(`${id} map status is inconsistent`);
    const unitCertified = normalizedCandidateVector(unit.certified, `${id} certified`);
    const unitScenario = normalizedCandidateVector(unit.scenario, `${id} scenario`);
    const unitDelta = normalizedDelta(unit.delta, `${id} delta`);
    assertVectorEqual(unitDelta, subtractVectors(unitScenario, unitCertified), `${id} endpoint delta`);
    const unitOperations = normalizedOperationDeltas(unit.operations, `${id} operations`);
    assertVectorEqual(
      unitOperations.reduce((sum, operation) => addVectors(sum, operation.delta), zeroDelta()),
      unitDelta,
      `${id} operations`,
    );
    return deepFreeze({
      id,
      countyFips,
      geometryId,
      mapStatus,
      certified: unitCertified,
      scenario: unitScenario,
      delta: unitDelta,
      operations: unitOperations,
    });
  }).sort((left, right) => canonicalStringCompare(left.id, right.id)));
  const unitTotals = sumRows(units);
  assertVectorEqual(unitTotals.certified, certified, `${stateCode} certified unit total`);
  assertVectorEqual(unitTotals.scenario, scenario, `${stateCode} scenario unit total`);
  assertVectorEqual(unitTotals.delta, delta, `${stateCode} delta unit total`);
  for (const operation of operations) {
    assertVectorEqual(
      operation.delta,
      sumOperation(units, operation.operationId),
      `${stateCode} ${operation.operationId} unit total`,
    );
  }

  const counties = Object.freeze(aggregateCountyRows(units));
  const statewideResidual = aggregateResidualRow(units, stateCode);
  const partitions = Object.freeze([
    partition("mapped", units.filter((unit) => unit.mapStatus === "mapped")),
    partition("off-map", units.filter((unit) => unit.mapStatus === "off-map")),
    partition("statewide-residual", units.filter((unit) => unit.countyFips === null)),
  ]);
  const electoral = deepFreeze({
    targetCandidate: candidate.electoral.targetCandidate,
    actualHarrisElectoralVotes: requireSafeInteger(candidate.electoral.actualHarrisElectoralVotes, "Actual Harris EV", true),
    actualTrumpElectoralVotes: requireSafeInteger(candidate.electoral.actualTrumpElectoralVotes, "Actual Trump EV", true),
    scenarioHarrisElectoralVotes: requireSafeInteger(candidate.electoral.scenarioHarrisElectoralVotes, "Scenario Harris EV", true),
    scenarioTrumpElectoralVotes: requireSafeInteger(candidate.electoral.scenarioTrumpElectoralVotes, "Scenario Trump EV", true),
    targetElectoralDelta: requireSafeInteger(candidate.electoral.targetElectoralDelta, "Target EV delta"),
    winnerChanged: candidate.electoral.winnerChanged,
  });
  if (!(electoral.targetCandidate === "harris" || electoral.targetCandidate === "trump")) {
    throw new Error("Electoral target candidate is invalid");
  }
  if (typeof electoral.winnerChanged !== "boolean") throw new Error("Winner-change flag is invalid");
  if (electoral.actualHarrisElectoralVotes + electoral.actualTrumpElectoralVotes
    !== electoral.scenarioHarrisElectoralVotes + electoral.scenarioTrumpElectoralVotes) {
    throw new Error("Scenario Electoral College allocation does not reconcile");
  }
  const expectedTargetDelta = electoral.targetCandidate === "harris"
    ? electoral.scenarioHarrisElectoralVotes - electoral.actualHarrisElectoralVotes
    : electoral.scenarioTrumpElectoralVotes - electoral.actualTrumpElectoralVotes;
  if (electoral.targetElectoralDelta !== expectedTargetDelta) {
    throw new Error("Target Electoral College consequence does not reconcile");
  }
  const expectedWinnerChanged = (certified.harrisVotes > certified.trumpVotes)
    !== (scenario.harrisVotes > scenario.trumpVotes);
  if (electoral.winnerChanged !== expectedWinnerChanged) {
    throw new Error("Winner-change consequence does not reconcile");
  }

  const withoutAnalytics = {
    schemaVersion: SCENARIO_DELTA_LEDGER_SCHEMA_VERSION,
    registryVersion: ANALYTIC_REGISTRY_VERSION,
    transformVersion: SCENARIO_DELTA_LEDGER_TRANSFORM_VERSION,
    stateCode,
    sourceIds,
    contributionDefinitionId: "derived.geography-margin-contribution-votes" as const,
    certified,
    scenario,
    delta,
    operations,
    units,
    counties,
    statewideResidual,
    partitions,
    electoral,
  } as const;
  const analytics = buildLedgerAnalytics(withoutAnalytics);
  const normalized = deepFreeze({ ...withoutAnalytics, analytics });
  if (canonicalSerialize(normalized as unknown as CanonicalValue)
    !== canonicalSerialize(candidate as unknown as CanonicalValue)) {
    throw new Error("Scenario delta ledger contains noncanonical or inconsistent content");
  }
  return normalized;
}

export function serializeScenarioDeltaLedger(ledger: ScenarioDeltaLedger) {
  return canonicalSerialize(validateScenarioDeltaLedger(ledger) as unknown as CanonicalValue);
}

export async function fingerprintScenarioDeltaLedger(
  ledger: ScenarioDeltaLedger,
): Promise<FingerprintedScenarioDeltaLedger> {
  return deepFreeze({
    ledger,
    fingerprint: await sha256Fingerprint(serializeScenarioDeltaLedger(ledger)),
  });
}

export function serializeFingerprintedScenarioDeltaLedger(
  value: FingerprintedScenarioDeltaLedger,
) {
  return canonicalSerialize(value as unknown as CanonicalValue);
}

export async function deserializeFingerprintedScenarioDeltaLedger(serialized: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Scenario delta ledger is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Scenario delta ledger is malformed");
  const candidate = parsed as FingerprintedScenarioDeltaLedger;
  if (!isSha256Fingerprint(candidate.fingerprint)) {
    throw new Error("Scenario delta ledger fingerprint is invalid");
  }
  const actualFingerprint = await sha256Fingerprint(
    canonicalSerialize(candidate.ledger as unknown as CanonicalValue),
  );
  if (actualFingerprint !== candidate.fingerprint) {
    throw new Error("Scenario delta ledger fingerprint or content is invalid");
  }
  return deepFreeze({
    ledger: validateScenarioDeltaLedger(candidate.ledger),
    fingerprint: candidate.fingerprint,
  });
}

export function rankScenarioDeltaRows<T extends { id: string; delta: ScenarioVoteDelta; operations: readonly ScenarioOperationDelta[] }>(
  rows: readonly T[],
  options: {
    operationId?: ScenarioDeltaOperationId;
    direction?: "absolute" | "harris" | "trump";
  } = {},
) {
  const direction = options.direction ?? "absolute";
  const margin = (row: T) => options.operationId
    ? row.operations.find((operation) => operation.operationId === options.operationId)?.delta.harrisTrumpMarginVotes ?? 0
    : row.delta.harrisTrumpMarginVotes;
  return Object.freeze([...rows].sort((left, right) => {
    const leftMargin = margin(left);
    const rightMargin = margin(right);
    const score = direction === "absolute"
      ? Math.abs(rightMargin) - Math.abs(leftMargin)
      : direction === "harris"
        ? rightMargin - leftMargin
        : leftMargin - rightMargin;
    return score || rightMargin - leftMargin || canonicalStringCompare(left.id, right.id);
  }));
}
