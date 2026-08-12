import type {
  BehaviorModelUnit,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";

export interface PennsylvaniaVtdDemographicRecord {
  geoid: string;
  countyFips: string;
  vtdCode: string;
  censusName: string;
  displayName: string;
  votingAgePopulation: number;
  hispanicAnyRace: number;
  nonHispanicWhite: number;
  nonHispanicBlack: number;
  nonHispanicAsian: number;
  nonHispanicOther: number;
  hasMappedResult: boolean;
  resultMatchMethod: "exact_vtd_identifier" | "exact_canonical_name" | "mixed" | null;
  sourceUnitCount: number;
  exactSourceUnitCount: number;
  canonicalSourceUnitCount: number;
  baselineVotes: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  turnoutCapacity: number;
  denominatorStatus:
    | "available"
    | "ballots_exceed_2020_vap"
    | "no_mapped_2024_result";
}

export interface PennsylvaniaCountyDemographicSummary {
  countyFips: string;
  vtdCount: number;
  mappedVtdCount: number;
  demographics: {
    votingAgePopulation: number;
    hispanicAnyRace: number;
    nonHispanicWhite: number;
    nonHispanicBlack: number;
    nonHispanicAsian: number;
    nonHispanicOther: number;
  };
  mappedVotes: PennsylvaniaVtdDemographicRecord["baselineVotes"];
  turnoutCapacity: number;
}

export interface PennsylvaniaResidualModelUnit {
  id: string;
  countyFips: string | null;
  name: string;
  type: string;
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface PennsylvaniaDemographicFoundation {
  stateCode: "PA";
  schemaVersion: number;
  encoding: "vtd-row-v1";
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
    mappedElectionGeometryCount: number;
    unavailableElectionGeometryCount: number;
    resultReportingUnitCoveragePct: number;
  };
  totals: {
    statewideDemographics: {
      votingAgePopulation: number;
      hispanicAnyRace: number;
      nonHispanicWhite: number;
      nonHispanicBlack: number;
      nonHispanicAsian: number;
      nonHispanicOther: number;
    };
    matchedDemographics: PennsylvaniaCountyDemographicSummary["demographics"];
    mappedVotes: PennsylvaniaVtdDemographicRecord["baselineVotes"];
    residualVotes: PennsylvaniaVtdDemographicRecord["baselineVotes"];
    certifiedVotes: PennsylvaniaVtdDemographicRecord["baselineVotes"];
    turnoutCapacity: number;
    denominatorStatus: {
      availableVtdCount: number;
      ballotsExceed2020VapVtdCount: number;
      noMappedResultVtdCount: number;
    };
  };
  counties: PennsylvaniaCountyDemographicSummary[];
  vtds: PennsylvaniaVtdDemographicRecord[];
  residualUnits: PennsylvaniaResidualModelUnit[];
}

export const PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION = 3;
export const PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING = "vtd-row-v1";
export const PENNSYLVANIA_VTD_ROW_FIELDS = [
  "geoid",
  "censusName",
  "displayNameOverride",
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

function requireNonnegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function decodeVotes(values: readonly unknown[], offset: number, label: string) {
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

function decodeVoteRecord(value: unknown, label: string) {
  const record = requireRecord(value, label);
  const harrisVotes = requireNonnegativeInteger(record.harrisVotes, `${label} Harris votes`);
  const trumpVotes = requireNonnegativeInteger(record.trumpVotes, `${label} Trump votes`);
  const steinVotes = requireNonnegativeInteger(record.steinVotes, `${label} Stein votes`);
  const oliverVotes = requireNonnegativeInteger(record.oliverVotes, `${label} Oliver votes`);
  const residualOtherVotes = requireNonnegativeInteger(
    record.residualOtherVotes,
    `${label} residual Other votes`,
  );
  const otherVotes = requireNonnegativeInteger(record.otherVotes, `${label} Other votes`);
  const totalVotes = requireNonnegativeInteger(record.totalVotes, `${label} total votes`);
  if (steinVotes + oliverVotes + residualOtherVotes !== otherVotes) {
    throw new Error(`${label} named Other votes do not reconcile`);
  }
  if (harrisVotes + trumpVotes + otherVotes !== totalVotes) {
    throw new Error(`${label} candidate votes do not reconcile`);
  }
  return {
    harrisVotes,
    trumpVotes,
    steinVotes,
    oliverVotes,
    residualOtherVotes,
    otherVotes,
    totalVotes,
  };
}

function decodeDemographicRecord(value: unknown, label: string) {
  const record = requireRecord(value, label);
  const demographics = {
    votingAgePopulation: requireNonnegativeInteger(
      record.votingAgePopulation,
      `${label} voting-age population`,
    ),
    hispanicAnyRace: requireNonnegativeInteger(
      record.hispanicAnyRace,
      `${label} Hispanic VAP`,
    ),
    nonHispanicWhite: requireNonnegativeInteger(
      record.nonHispanicWhite,
      `${label} White VAP`,
    ),
    nonHispanicBlack: requireNonnegativeInteger(
      record.nonHispanicBlack,
      `${label} Black VAP`,
    ),
    nonHispanicAsian: requireNonnegativeInteger(
      record.nonHispanicAsian,
      `${label} Asian VAP`,
    ),
    nonHispanicOther: requireNonnegativeInteger(
      record.nonHispanicOther,
      `${label} other VAP`,
    ),
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

function decodeResidualUnit(value: unknown, index: number): PennsylvaniaResidualModelUnit {
  const label = `Pennsylvania residual unit ${index}`;
  const record = requireRecord(value, label);
  const countyFips = record.countyFips == null
    ? null
    : requireString(record.countyFips, `${label} county FIPS`);
  if (countyFips != null && !/^42\d{3}$/.test(countyFips)) {
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

function decodeCountySummary(
  value: unknown,
  index: number,
): PennsylvaniaCountyDemographicSummary {
  const label = `Pennsylvania county summary ${index}`;
  const record = requireRecord(value, label);
  const countyFips = requireString(record.countyFips, `${label} FIPS`);
  if (!/^42\d{3}$/.test(countyFips)) throw new Error(`${label} has an invalid FIPS`);
  const vtdCount = requireNonnegativeInteger(record.vtdCount, `${countyFips} VTD count`);
  const mappedVtdCount = requireNonnegativeInteger(
    record.mappedVtdCount,
    `${countyFips} mapped VTD count`,
  );
  if (mappedVtdCount > vtdCount) throw new Error(`${countyFips} mapped VTD count exceeds total`);
  return {
    countyFips,
    vtdCount,
    mappedVtdCount,
    demographics: decodeDemographicRecord(record.demographics, `${countyFips} demographics`),
    mappedVotes: decodeVoteRecord(record.mappedVotes, `${countyFips} mapped votes`),
    turnoutCapacity: requireNonnegativeInteger(
      record.turnoutCapacity,
      `${countyFips} turnout capacity`,
    ),
  };
}

function emptyVoteTotals() {
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

function addVoteTotals(
  target: ReturnType<typeof emptyVoteTotals>,
  source: PennsylvaniaVtdDemographicRecord["baselineVotes"],
) {
  target.harrisVotes += source.harrisVotes;
  target.trumpVotes += source.trumpVotes;
  target.steinVotes += source.steinVotes;
  target.oliverVotes += source.oliverVotes;
  target.residualOtherVotes += source.residualOtherVotes;
  target.otherVotes += source.otherVotes;
  target.totalVotes += source.totalVotes;
}

function emptyDemographicTotals() {
  return {
    votingAgePopulation: 0,
    hispanicAnyRace: 0,
    nonHispanicWhite: 0,
    nonHispanicBlack: 0,
    nonHispanicAsian: 0,
    nonHispanicOther: 0,
  };
}

function addDemographicTotals(
  target: ReturnType<typeof emptyDemographicTotals>,
  source: PennsylvaniaCountyDemographicSummary["demographics"],
) {
  target.votingAgePopulation += source.votingAgePopulation;
  target.hispanicAnyRace += source.hispanicAnyRace;
  target.nonHispanicWhite += source.nonHispanicWhite;
  target.nonHispanicBlack += source.nonHispanicBlack;
  target.nonHispanicAsian += source.nonHispanicAsian;
  target.nonHispanicOther += source.nonHispanicOther;
}

function assertRecordEquals(
  actual: object,
  expected: object,
  label: string,
) {
  const actualRecord = actual as Record<string, number>;
  for (const [key, value] of Object.entries(expected as Record<string, number>)) {
    if (actualRecord[key] !== value) throw new Error(`${label} ${key} does not reconcile`);
  }
}

function decodeVtdRow(value: unknown, index: number): PennsylvaniaVtdDemographicRecord {
  if (!Array.isArray(value) || value.length !== PENNSYLVANIA_VTD_ROW_FIELDS.length) {
    throw new Error(`Demographic VTD row ${index} has an invalid field count`);
  }
  const geoid = requireString(value[0], `Demographic VTD row ${index} GEOID`);
  if (!/^42\d{3}[0-9A-Z]{6}$/.test(geoid)) {
    throw new Error(`Demographic VTD row ${index} has an invalid Pennsylvania GEOID`);
  }
  const censusName = requireString(value[1], `${geoid} Census name`);
  const displayNameOverride = value[2] == null
    ? null
    : requireString(value[2], `${geoid} display-name override`);
  const votingAgePopulation = requireNonnegativeInteger(value[3], `${geoid} VAP`);
  const hispanicAnyRace = requireNonnegativeInteger(value[4], `${geoid} Hispanic VAP`);
  const nonHispanicWhite = requireNonnegativeInteger(value[5], `${geoid} White VAP`);
  const nonHispanicBlack = requireNonnegativeInteger(value[6], `${geoid} Black VAP`);
  const nonHispanicAsian = requireNonnegativeInteger(value[7], `${geoid} Asian VAP`);
  const nonHispanicOther = requireNonnegativeInteger(value[8], `${geoid} other VAP`);
  if (
    hispanicAnyRace
      + nonHispanicWhite
      + nonHispanicBlack
      + nonHispanicAsian
      + nonHispanicOther
    !== votingAgePopulation
  ) {
    throw new Error(`${geoid} demographic cells do not reconcile to VAP`);
  }
  const exactSourceUnitCount = requireNonnegativeInteger(value[9], `${geoid} exact links`);
  const canonicalSourceUnitCount = requireNonnegativeInteger(
    value[10],
    `${geoid} canonical links`,
  );
  const sourceUnitCount = exactSourceUnitCount + canonicalSourceUnitCount;
  const hasMappedResult = sourceUnitCount > 0;
  const baselineVotes = decodeVotes(value, 11, geoid);
  if (!hasMappedResult && baselineVotes.totalVotes !== 0) {
    throw new Error(`${geoid} has votes without a mapped election source`);
  }
  const denominatorStatus = hasMappedResult
    ? baselineVotes.totalVotes <= votingAgePopulation
      ? "available"
      : "ballots_exceed_2020_vap"
    : "no_mapped_2024_result";
  return {
    geoid,
    countyFips: geoid.slice(0, 5),
    vtdCode: geoid.slice(5),
    censusName,
    displayName: displayNameOverride ?? censusName,
    votingAgePopulation,
    hispanicAnyRace,
    nonHispanicWhite,
    nonHispanicBlack,
    nonHispanicAsian,
    nonHispanicOther,
    hasMappedResult,
    resultMatchMethod: !hasMappedResult
      ? null
      : exactSourceUnitCount > 0 && canonicalSourceUnitCount > 0
        ? "mixed"
        : exactSourceUnitCount > 0
          ? "exact_vtd_identifier"
          : "exact_canonical_name",
    sourceUnitCount,
    exactSourceUnitCount,
    canonicalSourceUnitCount,
    baselineVotes,
    turnoutCapacity: denominatorStatus === "available"
      ? votingAgePopulation - baselineVotes.totalVotes
      : 0,
    denominatorStatus,
  };
}

function sumVtdVotes(vtds: readonly PennsylvaniaVtdDemographicRecord[]) {
  const totals = emptyVoteTotals();
  vtds.forEach((vtd) => addVoteTotals(totals, vtd.baselineVotes));
  return totals;
}

export function decodePennsylvaniaDemographicFoundation(
  value: unknown,
): PennsylvaniaDemographicFoundation {
  const document = requireRecord(value, "Pennsylvania demographic artifact");
  if (document.schemaVersion !== PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION) {
    throw new Error(`Unsupported Pennsylvania demographic schema ${String(document.schemaVersion)}`);
  }
  if (document.encoding !== PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING) {
    throw new Error(`Unsupported Pennsylvania demographic encoding ${String(document.encoding)}`);
  }
  if (
    !Array.isArray(document.vtdFields)
    || document.vtdFields.length !== PENNSYLVANIA_VTD_ROW_FIELDS.length
    || document.vtdFields.some((field, index) => field !== PENNSYLVANIA_VTD_ROW_FIELDS[index])
  ) {
    throw new Error("Pennsylvania demographic VTD field contract is incompatible");
  }
  if (!Array.isArray(document.vtdRows)) {
    throw new Error("Pennsylvania demographic VTD rows are missing");
  }
  const join = requireRecord(document.join, "Pennsylvania demographic join");
  const expectedVtdCount = requireNonnegativeInteger(
    join.geometryFeatureCount,
    "Pennsylvania demographic geometry count",
  );
  if (document.vtdRows.length !== expectedVtdCount) {
    throw new Error(
      `Pennsylvania demographic artifact contains ${document.vtdRows.length} VTD rows; expected ${expectedVtdCount}`,
    );
  }
  const vtds = document.vtdRows.map(decodeVtdRow);
  for (let index = 1; index < vtds.length; index += 1) {
    if (vtds[index - 1].geoid >= vtds[index].geoid) {
      throw new Error("Pennsylvania demographic VTD rows must have unique sorted GEOIDs");
    }
  }
  const mappedCount = vtds.filter((vtd) => vtd.hasMappedResult).length;
  const expectedMappedCount = requireNonnegativeInteger(
    join.mappedElectionGeometryCount,
    "Pennsylvania mapped VTD count",
  );
  const expectedUnavailableCount = requireNonnegativeInteger(
    join.unavailableElectionGeometryCount,
    "Pennsylvania unavailable VTD count",
  );
  if (mappedCount !== expectedMappedCount || vtds.length - mappedCount !== expectedUnavailableCount) {
    throw new Error("Pennsylvania demographic result coverage does not reconcile");
  }
  if (!Array.isArray(document.counties) || !Array.isArray(document.residualUnits)) {
    throw new Error("Pennsylvania demographic county or residual summaries are missing");
  }
  const counties = document.counties.map(decodeCountySummary);
  const residualUnits = document.residualUnits.map(decodeResidualUnit);
  if (new Set(counties.map((county) => county.countyFips)).size !== counties.length) {
    throw new Error("Pennsylvania demographic county summaries contain duplicate FIPS codes");
  }
  const vtdCountyFips = new Set(vtds.map((vtd) => vtd.countyFips));
  if (
    counties.length !== vtdCountyFips.size
    || counties.some((county) => !vtdCountyFips.has(county.countyFips))
  ) {
    throw new Error("Pennsylvania demographic county summaries do not cover every VTD county");
  }
  if (new Set(residualUnits.map((unit) => unit.id)).size !== residualUnits.length) {
    throw new Error("Pennsylvania demographic residual units contain duplicate identifiers");
  }
  const totals = requireRecord(document.totals, "Pennsylvania demographic totals");
  const statewideDemographics = decodeDemographicRecord(
    totals.statewideDemographics,
    "Pennsylvania statewide demographics",
  );
  const matchedDemographics = decodeDemographicRecord(
    totals.matchedDemographics,
    "Pennsylvania matched demographics",
  );
  const mappedVotes = decodeVoteRecord(totals.mappedVotes, "Pennsylvania mapped votes");
  const residualVotes = decodeVoteRecord(totals.residualVotes, "Pennsylvania residual votes");
  const certifiedVotes = decodeVoteRecord(totals.certifiedVotes, "Pennsylvania certified votes");
  const denominatorStatus = requireRecord(
    totals.denominatorStatus,
    "Pennsylvania denominator status",
  );
  const availableVtdCount = requireNonnegativeInteger(
    denominatorStatus.availableVtdCount,
    "Pennsylvania available VTD count",
  );
  const ballotsExceed2020VapVtdCount = requireNonnegativeInteger(
    denominatorStatus.ballotsExceed2020VapVtdCount,
    "Pennsylvania over-capacity VTD count",
  );
  const noMappedResultVtdCount = requireNonnegativeInteger(
    denominatorStatus.noMappedResultVtdCount,
    "Pennsylvania unavailable-result VTD count",
  );
  const turnoutCapacity = requireNonnegativeInteger(
    totals.turnoutCapacity,
    "Pennsylvania turnout capacity",
  );
  const decodedMappedVotes = sumVtdVotes(vtds);
  assertRecordEquals(mappedVotes, decodedMappedVotes, "Pennsylvania mapped votes");
  const decodedStatewideDemographics = emptyDemographicTotals();
  const decodedMatchedDemographics = emptyDemographicTotals();
  vtds.forEach((vtd) => {
    addDemographicTotals(decodedStatewideDemographics, vtd);
    if (vtd.hasMappedResult) addDemographicTotals(decodedMatchedDemographics, vtd);
  });
  assertRecordEquals(
    statewideDemographics,
    decodedStatewideDemographics,
    "Pennsylvania statewide demographics",
  );
  assertRecordEquals(
    matchedDemographics,
    decodedMatchedDemographics,
    "Pennsylvania matched demographics",
  );

  const decodedResidualVotes = emptyVoteTotals();
  residualUnits.forEach((unit) => addVoteTotals(decodedResidualVotes, unit));
  assertRecordEquals(residualVotes, decodedResidualVotes, "Pennsylvania residual votes");
  const decodedCertifiedVotes = { ...decodedMappedVotes };
  addVoteTotals(decodedCertifiedVotes, decodedResidualVotes);
  assertRecordEquals(certifiedVotes, decodedCertifiedVotes, "Pennsylvania certified votes");

  const decodedTurnoutCapacity = vtds.reduce((sum, vtd) => sum + vtd.turnoutCapacity, 0);
  if (turnoutCapacity !== decodedTurnoutCapacity) {
    throw new Error("Pennsylvania demographic turnout capacity does not reconcile");
  }
  if (
    availableVtdCount !== vtds.filter((vtd) => vtd.denominatorStatus === "available").length
    || ballotsExceed2020VapVtdCount
      !== vtds.filter((vtd) => vtd.denominatorStatus === "ballots_exceed_2020_vap").length
    || noMappedResultVtdCount
      !== vtds.filter((vtd) => vtd.denominatorStatus === "no_mapped_2024_result").length
  ) {
    throw new Error("Pennsylvania demographic denominator counts do not reconcile");
  }

  for (const county of counties) {
    const countyVtds = vtds.filter((vtd) => vtd.countyFips === county.countyFips);
    const countyMappedVtds = countyVtds.filter((vtd) => vtd.hasMappedResult);
    if (
      county.vtdCount !== countyVtds.length
      || county.mappedVtdCount !== countyMappedVtds.length
    ) {
      throw new Error(`${county.countyFips} VTD coverage does not reconcile`);
    }
    const countyDemographics = emptyDemographicTotals();
    countyVtds.forEach((vtd) => addDemographicTotals(countyDemographics, vtd));
    assertRecordEquals(
      county.demographics,
      countyDemographics,
      `${county.countyFips} demographics`,
    );
    assertRecordEquals(
      county.mappedVotes,
      sumVtdVotes(countyMappedVtds),
      `${county.countyFips} mapped votes`,
    );
    if (
      county.turnoutCapacity
      !== countyVtds.reduce((sum, vtd) => sum + vtd.turnoutCapacity, 0)
    ) {
      throw new Error(`${county.countyFips} turnout capacity does not reconcile`);
    }
  }

  const source = requireRecord(document.source, "Pennsylvania demographic source");
  requireString(source.id, "Pennsylvania demographic source identifier");
  requireString(source.pipelineVersion, "Pennsylvania demographic pipeline version");

  return {
    stateCode: "PA",
    schemaVersion: PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_SCHEMA_VERSION,
    encoding: PENNSYLVANIA_DEMOGRAPHIC_RUNTIME_ENCODING,
    generatedAt: requireString(document.generatedAt, "Pennsylvania demographic generation time"),
    electionId: requireString(document.electionId, "Pennsylvania demographic election"),
    source: source as unknown as PennsylvaniaDemographicFoundation["source"],
    join: join as unknown as PennsylvaniaDemographicFoundation["join"],
    totals: {
      statewideDemographics,
      matchedDemographics,
      mappedVotes,
      residualVotes,
      certifiedVotes,
      turnoutCapacity,
      denominatorStatus: {
        availableVtdCount,
        ballotsExceed2020VapVtdCount,
        noMappedResultVtdCount,
      },
    },
    counties,
    vtds,
    residualUnits,
  };
}

let demographicFoundationPromise: Promise<PennsylvaniaDemographicFoundation> | null = null;

function publicUrl(path: string) {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}

export function loadPennsylvaniaDemographicFoundation() {
  if (!demographicFoundationPromise) {
    demographicFoundationPromise = fetch(publicUrl("data/pa/2020/vtd-demographics.json"))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Demographic foundation request failed with ${response.status}`);
        }
        return response.json();
      })
      .then(decodePennsylvaniaDemographicFoundation)
      .catch((error: unknown) => {
        demographicFoundationPromise = null;
        throw error;
      });
  }
  return demographicFoundationPromise;
}

export function toBehaviorModelUnits(
  foundation: PennsylvaniaDemographicFoundation,
): BehaviorModelUnit[] {
  const mappedVtds: BehaviorModelUnit[] = foundation.vtds
    .filter((vtd) => vtd.hasMappedResult)
    .map((vtd) => ({
      id: `vtd-${vtd.geoid}`,
      countyFips: vtd.countyFips,
      geometryId: vtd.geoid,
      ...vtd.baselineVotes,
      turnoutDenominator: vtd.denominatorStatus === "available"
        ? vtd.votingAgePopulation
        : null,
      turnoutCapacity: vtd.denominatorStatus === "available"
        ? vtd.turnoutCapacity
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
  return [...mappedVtds, ...residuals];
}

export function scenarioVtdMap(units: readonly BehaviorScenarioUnit[]) {
  return new Map(
    units
      .filter((unit): unit is BehaviorScenarioUnit & { geometryId: string } =>
        unit.geometryId != null)
      .map((unit) => [unit.geometryId, unit]),
  );
}
