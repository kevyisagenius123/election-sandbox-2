import type {
  BehaviorModelUnit,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";

export const MICHIGAN_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION = 1;
export const MICHIGAN_DEMOGRAPHIC_RUNTIME_ENCODING = "mi-precinct-row-v1";
export const MICHIGAN_PRECINCT_ROW_FIELDS = [
  "geometryId",
  "censusVtdGeoid",
  "precinctName",
  "demographicMatchMethod",
  "registeredVoters",
  "votingAgePopulation",
  "hispanicAnyRace",
  "nonHispanicWhite",
  "nonHispanicBlack",
  "nonHispanicAsian",
  "nonHispanicOther",
  "exactSourceUnitCount",
  "canonicalSourceUnitCount",
  "harrisVotes",
  "trumpVotes",
  "steinVotes",
  "oliverVotes",
  "residualOtherVotes",
] as const;

export type MichiganDemographicMatchMethod =
  | "official_vtdst_bridge"
  | "registered_voter_weighted_vtd_split"
  | "unavailable";

export type MichiganDenominatorStatus =
  | "available"
  | "ballots_exceed_2020_vap"
  | "demographic_bridge_unavailable"
  | "no_mapped_2024_result";

export interface MichiganVotes {
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface MichiganDemographics {
  votingAgePopulation: number;
  hispanicAnyRace: number;
  nonHispanicWhite: number;
  nonHispanicBlack: number;
  nonHispanicAsian: number;
  nonHispanicOther: number;
}

export interface MichiganPrecinctDemographicRecord extends MichiganDemographics {
  geometryId: string;
  countyFips: string;
  censusVtdGeoid: string | null;
  precinctName: string;
  demographicMatchMethod: MichiganDemographicMatchMethod;
  registeredVoters: number;
  hasMappedResult: boolean;
  resultMatchMethod:
    | "exact_official_ward_key"
    | "unique_official_precinct_key"
    | "mixed"
    | null;
  sourceUnitCount: number;
  exactSourceUnitCount: number;
  canonicalSourceUnitCount: number;
  baselineVotes: MichiganVotes;
  turnoutCapacity: number;
  denominatorStatus: MichiganDenominatorStatus;
}

export interface MichiganResidualModelUnit extends MichiganVotes {
  id: string;
  countyFips: string | null;
  name: string;
  type: string;
}

export interface MichiganDemographicFoundation {
  stateCode: "MI";
  schemaVersion: number;
  encoding: typeof MICHIGAN_DEMOGRAPHIC_RUNTIME_ENCODING;
  generatedAt: string;
  electionId: string;
  source: {
    id: string;
    publisher: string;
    title: string;
    sourceUrl: string;
    documentationUrl: string;
    geographyVintage: string;
    table: string;
    pipelineVersion: string;
    limitations: string[];
  };
  join: {
    method: string;
    demographicVintage: string;
    geometryVintage: string;
    electionVintage: string;
    geometryFeatureCount: number;
    directVtdBridgeCount: number;
    weightedSplitGeometryCount: number;
    unavailableDemographicGeometryCount: number;
    mappedElectionGeometryCount: number;
    resultReportingUnitCoveragePct: number;
    statewidePaintedVoteCoveragePct: number;
  };
  totals: {
    statewideDemographics: MichiganDemographics;
    matchedDemographics: MichiganDemographics;
    mappedVotes: MichiganVotes;
    residualVotes: MichiganVotes;
    certifiedVotes: MichiganVotes;
    turnoutCapacity: number;
    denominatorStatus: {
      availablePrecinctCount: number;
      ballotsExceed2020VapPrecinctCount: number;
      demographicBridgeUnavailablePrecinctCount: number;
      noMappedResultPrecinctCount: number;
    };
  };
  precincts: MichiganPrecinctDemographicRecord[];
  residualUnits: MichiganResidualModelUnit[];
}

type JsonRecord = Record<string, unknown>;

function requireRecord(value: unknown, label: string): JsonRecord {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function requireNullableString(value: unknown, label: string) {
  return value == null ? null : requireString(value, label);
}

function requireNonnegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireNonnegativeNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
  return value;
}

function decodeVotes(values: readonly unknown[], offset: number, label: string): MichiganVotes {
  const harrisVotes = requireNonnegativeInteger(values[offset], `${label} Harris votes`);
  const trumpVotes = requireNonnegativeInteger(values[offset + 1], `${label} Trump votes`);
  const steinVotes = requireNonnegativeInteger(values[offset + 2], `${label} Stein votes`);
  const oliverVotes = requireNonnegativeInteger(values[offset + 3], `${label} Oliver votes`);
  const residualOtherVotes = requireNonnegativeInteger(
    values[offset + 4],
    `${label} residual Other votes`,
  );
  const otherVotes = steinVotes + oliverVotes + residualOtherVotes;
  return {
    harrisVotes,
    trumpVotes,
    steinVotes,
    oliverVotes,
    residualOtherVotes,
    otherVotes,
    totalVotes: harrisVotes + trumpVotes + otherVotes,
  };
}

function decodeVoteRecord(value: unknown, label: string): MichiganVotes {
  const record = requireRecord(value, label);
  const votes = decodeVotes([
    record.harrisVotes,
    record.trumpVotes,
    record.steinVotes,
    record.oliverVotes,
    record.residualOtherVotes,
  ], 0, label);
  if (requireNonnegativeInteger(record.otherVotes, `${label} Other votes`) !== votes.otherVotes) {
    throw new Error(`${label} Other votes do not reconcile`);
  }
  if (requireNonnegativeInteger(record.totalVotes, `${label} total votes`) !== votes.totalVotes) {
    throw new Error(`${label} total votes do not reconcile`);
  }
  return votes;
}

function decodeDemographicValues(
  values: readonly unknown[],
  offset: number,
  label: string,
): MichiganDemographics {
  const demographics = {
    votingAgePopulation: requireNonnegativeInteger(values[offset], `${label} VAP`),
    hispanicAnyRace: requireNonnegativeInteger(values[offset + 1], `${label} Hispanic VAP`),
    nonHispanicWhite: requireNonnegativeInteger(values[offset + 2], `${label} White VAP`),
    nonHispanicBlack: requireNonnegativeInteger(values[offset + 3], `${label} Black VAP`),
    nonHispanicAsian: requireNonnegativeInteger(values[offset + 4], `${label} Asian VAP`),
    nonHispanicOther: requireNonnegativeInteger(values[offset + 5], `${label} other VAP`),
  };
  if (
    demographics.hispanicAnyRace
      + demographics.nonHispanicWhite
      + demographics.nonHispanicBlack
      + demographics.nonHispanicAsian
      + demographics.nonHispanicOther
    !== demographics.votingAgePopulation
  ) {
    throw new Error(`${label} demographic cells do not reconcile`);
  }
  return demographics;
}

function decodeDemographicRecord(value: unknown, label: string) {
  const record = requireRecord(value, label);
  return decodeDemographicValues([
    record.votingAgePopulation,
    record.hispanicAnyRace,
    record.nonHispanicWhite,
    record.nonHispanicBlack,
    record.nonHispanicAsian,
    record.nonHispanicOther,
  ], 0, label);
}

function decodePrecinctRow(value: unknown, index: number): MichiganPrecinctDemographicRecord {
  if (!Array.isArray(value) || value.length !== MICHIGAN_PRECINCT_ROW_FIELDS.length) {
    throw new Error(`Michigan precinct row ${index} has an invalid field count`);
  }
  const geometryId = requireString(value[0], `Michigan precinct row ${index} geometry ID`);
  if (!/^WP-\d{3}-\d{5}-[0-9A-Z]+$/.test(geometryId)) {
    throw new Error(`${geometryId} is not a valid Michigan PRECINCTID`);
  }
  const countyFips = `26${geometryId.slice(3, 6)}`;
  const censusVtdGeoid = requireNullableString(value[1], `${geometryId} Census VTD GEOID`);
  const precinctName = requireString(value[2], `${geometryId} precinct name`);
  const demographicMatchMethod = requireString(
    value[3],
    `${geometryId} demographic match method`,
  ) as MichiganDemographicMatchMethod;
  if (![
    "official_vtdst_bridge",
    "registered_voter_weighted_vtd_split",
    "unavailable",
  ].includes(demographicMatchMethod)) {
    throw new Error(`${geometryId} has an unsupported demographic match method`);
  }
  if (
    demographicMatchMethod === "unavailable"
      ? censusVtdGeoid !== null
      : censusVtdGeoid == null || !/^26\d{9}$/.test(censusVtdGeoid)
  ) {
    throw new Error(`${geometryId} has an inconsistent Census VTD bridge`);
  }
  const registeredVoters = requireNonnegativeInteger(value[4], `${geometryId} registered voters`);
  const demographics = decodeDemographicValues(value, 5, geometryId);
  if (
    demographicMatchMethod === "unavailable"
    && Object.values(demographics).some((cell) => cell !== 0)
  ) {
    throw new Error(`${geometryId} has demographics without a valid bridge`);
  }
  const exactSourceUnitCount = requireNonnegativeInteger(value[11], `${geometryId} exact links`);
  const canonicalSourceUnitCount = requireNonnegativeInteger(value[12], `${geometryId} canonical links`);
  const sourceUnitCount = exactSourceUnitCount + canonicalSourceUnitCount;
  const hasMappedResult = sourceUnitCount > 0;
  const baselineVotes = decodeVotes(value, 13, geometryId);
  if (!hasMappedResult && baselineVotes.totalVotes !== 0) {
    throw new Error(`${geometryId} has votes without a mapped result unit`);
  }
  const denominatorStatus: MichiganDenominatorStatus = !hasMappedResult
    ? "no_mapped_2024_result"
    : demographicMatchMethod === "unavailable"
      ? "demographic_bridge_unavailable"
      : baselineVotes.totalVotes <= demographics.votingAgePopulation
        ? "available"
        : "ballots_exceed_2020_vap";
  return {
    geometryId,
    countyFips,
    censusVtdGeoid,
    precinctName,
    demographicMatchMethod,
    registeredVoters,
    ...demographics,
    hasMappedResult,
    resultMatchMethod: !hasMappedResult
      ? null
      : exactSourceUnitCount > 0 && canonicalSourceUnitCount > 0
        ? "mixed"
        : exactSourceUnitCount > 0
          ? "exact_official_ward_key"
          : "unique_official_precinct_key",
    sourceUnitCount,
    exactSourceUnitCount,
    canonicalSourceUnitCount,
    baselineVotes,
    turnoutCapacity: denominatorStatus === "available"
      ? demographics.votingAgePopulation - baselineVotes.totalVotes
      : 0,
    denominatorStatus,
  };
}

function decodeResidualUnit(value: unknown, index: number): MichiganResidualModelUnit {
  const label = `Michigan residual unit ${index}`;
  const record = requireRecord(value, label);
  const countyFips = record.countyFips == null
    ? null
    : requireString(record.countyFips, `${label} county FIPS`);
  if (countyFips != null && !/^26\d{3}$/.test(countyFips)) {
    throw new Error(`${label} has an invalid county FIPS`);
  }
  return {
    id: requireString(record.id, `${label} identifier`),
    countyFips,
    name: requireString(record.name, `${label} name`),
    type: requireString(record.type, `${label} type`),
    ...decodeVoteRecord(record, label),
  };
}

function emptyVotes(): MichiganVotes {
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

function addVotes(target: MichiganVotes, source: MichiganVotes) {
  for (const key of Object.keys(target) as (keyof MichiganVotes)[]) target[key] += source[key];
}

function emptyDemographics(): MichiganDemographics {
  return {
    votingAgePopulation: 0,
    hispanicAnyRace: 0,
    nonHispanicWhite: 0,
    nonHispanicBlack: 0,
    nonHispanicAsian: 0,
    nonHispanicOther: 0,
  };
}

function addDemographics(target: MichiganDemographics, source: MichiganDemographics) {
  for (const key of Object.keys(target) as (keyof MichiganDemographics)[]) {
    target[key] += source[key];
  }
}

function assertRecordEquals(actual: object, expected: object, label: string) {
  const actualRecord = actual as Record<string, number>;
  for (const [key, value] of Object.entries(expected as Record<string, number>)) {
    if (actualRecord[key] !== value) throw new Error(`${label} ${key} does not reconcile`);
  }
}

export function decodeMichiganDemographicFoundation(
  value: unknown,
): MichiganDemographicFoundation {
  const document = requireRecord(value, "Michigan demographic artifact");
  if (document.schemaVersion !== MICHIGAN_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION) {
    throw new Error(`Unsupported Michigan demographic schema ${String(document.schemaVersion)}`);
  }
  if (document.encoding !== MICHIGAN_DEMOGRAPHIC_RUNTIME_ENCODING) {
    throw new Error(`Unsupported Michigan demographic encoding ${String(document.encoding)}`);
  }
  if (
    !Array.isArray(document.precinctFields)
    || document.precinctFields.length !== MICHIGAN_PRECINCT_ROW_FIELDS.length
    || document.precinctFields.some((field, index) => field !== MICHIGAN_PRECINCT_ROW_FIELDS[index])
  ) {
    throw new Error("Michigan demographic precinct field contract is incompatible");
  }
  if (!Array.isArray(document.precinctRows) || !Array.isArray(document.residualUnits)) {
    throw new Error("Michigan demographic precinct or residual rows are missing");
  }
  const join = requireRecord(document.join, "Michigan demographic join");
  const geometryFeatureCount = requireNonnegativeInteger(
    join.geometryFeatureCount,
    "Michigan geometry feature count",
  );
  if (document.precinctRows.length !== geometryFeatureCount) {
    throw new Error("Michigan precinct row count does not match geometry coverage");
  }
  const precincts = document.precinctRows.map(
    (row, index) => decodePrecinctRow(row, index),
  );
  for (let index = 1; index < precincts.length; index += 1) {
    if (precincts[index - 1].geometryId >= precincts[index].geometryId) {
      throw new Error("Michigan precinct rows must have unique sorted geometry IDs");
    }
  }
  const residualUnits = document.residualUnits.map(
    (unit, index) => decodeResidualUnit(unit, index),
  );
  if (new Set(residualUnits.map((unit) => unit.id)).size !== residualUnits.length) {
    throw new Error("Michigan residual units contain duplicate identifiers");
  }

  const directVtdBridgeCount = requireNonnegativeInteger(
    join.directVtdBridgeCount,
    "Michigan direct VTD bridge count",
  );
  const weightedSplitGeometryCount = requireNonnegativeInteger(
    join.weightedSplitGeometryCount,
    "Michigan weighted-split geometry count",
  );
  const unavailableDemographicGeometryCount = requireNonnegativeInteger(
    join.unavailableDemographicGeometryCount,
    "Michigan unavailable demographic count",
  );
  const mappedElectionGeometryCount = requireNonnegativeInteger(
    join.mappedElectionGeometryCount,
    "Michigan mapped election geometry count",
  );
  if (
    directVtdBridgeCount
      !== precincts.filter((row) => row.demographicMatchMethod === "official_vtdst_bridge").length
    || weightedSplitGeometryCount
      !== precincts.filter((row) => row.demographicMatchMethod === "registered_voter_weighted_vtd_split").length
    || unavailableDemographicGeometryCount
      !== precincts.filter((row) => row.demographicMatchMethod === "unavailable").length
    || mappedElectionGeometryCount !== precincts.filter((row) => row.hasMappedResult).length
  ) {
    throw new Error("Michigan join coverage counts do not reconcile");
  }
  if (directVtdBridgeCount + weightedSplitGeometryCount + unavailableDemographicGeometryCount !== geometryFeatureCount) {
    throw new Error("Michigan demographic bridge coverage does not equal geometry count");
  }

  const totals = requireRecord(document.totals, "Michigan demographic totals");
  const statewideDemographics = decodeDemographicRecord(
    totals.statewideDemographics,
    "Michigan statewide demographics",
  );
  const matchedDemographics = decodeDemographicRecord(
    totals.matchedDemographics,
    "Michigan matched demographics",
  );
  const mappedVotes = decodeVoteRecord(totals.mappedVotes, "Michigan mapped votes");
  const residualVotes = decodeVoteRecord(totals.residualVotes, "Michigan residual votes");
  const certifiedVotes = decodeVoteRecord(totals.certifiedVotes, "Michigan certified votes");
  const turnoutCapacity = requireNonnegativeInteger(
    totals.turnoutCapacity,
    "Michigan turnout capacity",
  );
  const denominatorStatus = requireRecord(
    totals.denominatorStatus,
    "Michigan denominator status",
  );
  const availablePrecinctCount = requireNonnegativeInteger(
    denominatorStatus.availablePrecinctCount,
    "Michigan available precinct count",
  );
  const ballotsExceed2020VapPrecinctCount = requireNonnegativeInteger(
    denominatorStatus.ballotsExceed2020VapPrecinctCount,
    "Michigan over-capacity precinct count",
  );
  const demographicBridgeUnavailablePrecinctCount = requireNonnegativeInteger(
    denominatorStatus.demographicBridgeUnavailablePrecinctCount,
    "Michigan unavailable demographic precinct count",
  );
  const noMappedResultPrecinctCount = requireNonnegativeInteger(
    denominatorStatus.noMappedResultPrecinctCount,
    "Michigan no-result precinct count",
  );

  const decodedMappedVotes = emptyVotes();
  const decodedMatchedDemographics = emptyDemographics();
  precincts.forEach((precinct) => {
    if (precinct.hasMappedResult) addVotes(decodedMappedVotes, precinct.baselineVotes);
    if (precinct.demographicMatchMethod !== "unavailable") {
      addDemographics(decodedMatchedDemographics, precinct);
    }
  });
  assertRecordEquals(mappedVotes, decodedMappedVotes, "Michigan mapped votes");
  assertRecordEquals(
    matchedDemographics,
    decodedMatchedDemographics,
    "Michigan matched demographics",
  );
  for (const key of Object.keys(statewideDemographics) as (keyof MichiganDemographics)[]) {
    if (statewideDemographics[key] < matchedDemographics[key]) {
      throw new Error(`Michigan statewide demographics ${key} are below bridged coverage`);
    }
  }

  const decodedResidualVotes = emptyVotes();
  residualUnits.forEach((unit) => addVotes(decodedResidualVotes, unit));
  assertRecordEquals(residualVotes, decodedResidualVotes, "Michigan residual votes");
  const decodedCertifiedVotes = { ...decodedMappedVotes };
  addVotes(decodedCertifiedVotes, decodedResidualVotes);
  assertRecordEquals(certifiedVotes, decodedCertifiedVotes, "Michigan certified votes");
  if (turnoutCapacity !== precincts.reduce((sum, row) => sum + row.turnoutCapacity, 0)) {
    throw new Error("Michigan turnout capacity does not reconcile");
  }
  if (
    availablePrecinctCount !== precincts.filter((row) => row.denominatorStatus === "available").length
    || ballotsExceed2020VapPrecinctCount
      !== precincts.filter((row) => row.denominatorStatus === "ballots_exceed_2020_vap").length
    || demographicBridgeUnavailablePrecinctCount
      !== precincts.filter((row) => row.denominatorStatus === "demographic_bridge_unavailable").length
    || noMappedResultPrecinctCount
      !== precincts.filter((row) => row.denominatorStatus === "no_mapped_2024_result").length
  ) {
    throw new Error("Michigan denominator status counts do not reconcile");
  }
  if (
    availablePrecinctCount
      + ballotsExceed2020VapPrecinctCount
      + demographicBridgeUnavailablePrecinctCount
      + noMappedResultPrecinctCount
    !== geometryFeatureCount
  ) {
    throw new Error("Michigan denominator statuses do not cover every precinct");
  }

  const source = requireRecord(document.source, "Michigan demographic source");
  requireString(source.id, "Michigan demographic source identifier");
  requireString(source.pipelineVersion, "Michigan demographic pipeline version");
  return {
    stateCode: "MI",
    schemaVersion: MICHIGAN_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION,
    encoding: MICHIGAN_DEMOGRAPHIC_RUNTIME_ENCODING,
    generatedAt: requireString(document.generatedAt, "Michigan demographic generation time"),
    electionId: requireString(document.electionId, "Michigan demographic election"),
    source: source as unknown as MichiganDemographicFoundation["source"],
    join: {
      method: requireString(join.method, "Michigan join method"),
      demographicVintage: requireString(join.demographicVintage, "Michigan demographic vintage"),
      geometryVintage: requireString(join.geometryVintage, "Michigan geometry vintage"),
      electionVintage: requireString(join.electionVintage, "Michigan election vintage"),
      geometryFeatureCount,
      directVtdBridgeCount,
      weightedSplitGeometryCount,
      unavailableDemographicGeometryCount,
      mappedElectionGeometryCount,
      resultReportingUnitCoveragePct: requireNonnegativeNumber(
        join.resultReportingUnitCoveragePct,
        "Michigan result reporting-unit coverage",
      ),
      statewidePaintedVoteCoveragePct: requireNonnegativeNumber(
        join.statewidePaintedVoteCoveragePct,
        "Michigan statewide painted-vote coverage",
      ),
    },
    totals: {
      statewideDemographics,
      matchedDemographics,
      mappedVotes,
      residualVotes,
      certifiedVotes,
      turnoutCapacity,
      denominatorStatus: {
        availablePrecinctCount,
        ballotsExceed2020VapPrecinctCount,
        demographicBridgeUnavailablePrecinctCount,
        noMappedResultPrecinctCount,
      },
    },
    precincts,
    residualUnits,
  };
}

export function toMichiganBehaviorModelUnits(
  foundation: MichiganDemographicFoundation,
): BehaviorModelUnit[] {
  const mappedPrecincts: BehaviorModelUnit[] = foundation.precincts
    .filter((precinct) => precinct.hasMappedResult)
    .map((precinct) => ({
      id: `precinct-${precinct.geometryId}`,
      countyFips: precinct.countyFips,
      geometryId: precinct.geometryId,
      ...precinct.baselineVotes,
      turnoutDenominator: precinct.denominatorStatus === "available"
        ? precinct.votingAgePopulation
        : null,
      turnoutCapacity: precinct.denominatorStatus === "available"
        ? precinct.turnoutCapacity
        : 0,
    }));
  const residuals: BehaviorModelUnit[] = foundation.residualUnits.map((unit) => ({
    id: unit.id,
    countyFips: unit.countyFips,
    geometryId: null,
    harrisVotes: unit.harrisVotes,
    trumpVotes: unit.trumpVotes,
    steinVotes: unit.steinVotes,
    oliverVotes: unit.oliverVotes,
    residualOtherVotes: unit.residualOtherVotes,
    otherVotes: unit.otherVotes,
    totalVotes: unit.totalVotes,
    turnoutDenominator: null,
    turnoutCapacity: 0,
  }));
  return [...mappedPrecincts, ...residuals];
}

export function scenarioMichiganPrecinctMap(units: readonly BehaviorScenarioUnit[]) {
  return new Map(
    units
      .filter((unit): unit is BehaviorScenarioUnit & { geometryId: string } => (
        unit.geometryId != null
      ))
      .map((unit) => [unit.geometryId, unit]),
  );
}
