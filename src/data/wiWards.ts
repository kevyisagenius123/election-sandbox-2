import type { BehaviorModelUnit } from "../../packages/election-model/src/scenario.ts";

export const WISCONSIN_WARD_RUNTIME_SCHEMA_VERSION = 1;
export const WISCONSIN_WARD_RUNTIME_ENCODING = "wi-ward-row-v1";
export const WISCONSIN_WARD_ROW_FIELDS = [
  "geometryId",
  "wardName",
  "hasMappedResult",
  "votingAgePopulation",
  "harrisVotes",
  "trumpVotes",
  "steinVotes",
  "oliverVotes",
  "residualOtherVotes",
] as const;

export interface WisconsinVotes {
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export type WisconsinDenominatorStatus =
  | "available"
  | "ballots_exceed_2020_vap"
  | "no_mapped_2024_result";

export interface WisconsinWardRecord {
  geometryId: string;
  countyFips: string;
  wardName: string;
  hasMappedResult: boolean;
  votingAgePopulation: number;
  baselineVotes: WisconsinVotes;
  turnoutCapacity: number;
  denominatorStatus: WisconsinDenominatorStatus;
  sourceUnitCount: number;
  exactSourceUnitCount: number;
  canonicalSourceUnitCount: number;
  resultMatchMethod: "official_ltsb_population_disaggregation" | null;
  demographicMatchMethod: "official_ltsb_2020_vap_estimate" | null;
}

export interface WisconsinWardFoundation {
  stateCode: "WI";
  schemaVersion: number;
  encoding: typeof WISCONSIN_WARD_RUNTIME_ENCODING;
  generatedAt: string;
  electionId: string;
  source: Record<string, unknown>;
  join: {
    method: string;
    demographicVintage: string;
    geometryVintage: string;
    electionVintage: string;
    geometryFeatureCount: number;
    mappedElectionGeometryCount: number;
    resultReportingUnitCoveragePct: number;
    statewidePaintedVoteCoveragePct: number;
  };
  totals: {
    statewideVotingAgePopulation: number;
    mappedVotes: WisconsinVotes;
    residualVotes: WisconsinVotes;
    certifiedVotes: WisconsinVotes;
    turnoutCapacity: number;
    denominatorStatus: {
      availableWardCount: number;
      ballotsExceed2020VapWardCount: number;
      noMappedResultWardCount: number;
    };
  };
  wards: WisconsinWardRecord[];
  residualUnits: [];
}

type JsonRecord = Record<string, unknown>;

function requireRecord(value: unknown, label: string): JsonRecord {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function requireString(value: unknown, label: string) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  return value;
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
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

function decodeVotes(values: readonly unknown[], offset: number, label: string): WisconsinVotes {
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

function decodeVoteRecord(value: unknown, label: string): WisconsinVotes {
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

function addVotes(target: WisconsinVotes, source: WisconsinVotes) {
  target.harrisVotes += source.harrisVotes;
  target.trumpVotes += source.trumpVotes;
  target.steinVotes += source.steinVotes;
  target.oliverVotes += source.oliverVotes;
  target.residualOtherVotes += source.residualOtherVotes;
  target.otherVotes += source.otherVotes;
  target.totalVotes += source.totalVotes;
}

function emptyVotes(): WisconsinVotes {
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

function sameVotes(left: WisconsinVotes, right: WisconsinVotes) {
  return Object.keys(left).every((key) => (
    left[key as keyof WisconsinVotes] === right[key as keyof WisconsinVotes]
  ));
}

export function decodeWisconsinWardFoundation(value: unknown): WisconsinWardFoundation {
  const document = requireRecord(value, "Wisconsin ward foundation");
  const schemaVersion = requireNonnegativeInteger(document.schemaVersion, "Wisconsin schema version");
  if (schemaVersion !== WISCONSIN_WARD_RUNTIME_SCHEMA_VERSION) {
    throw new Error(`Unsupported Wisconsin schema version ${schemaVersion}`);
  }
  const encoding = requireString(document.encoding, "Wisconsin encoding");
  if (encoding !== WISCONSIN_WARD_RUNTIME_ENCODING) {
    throw new Error(`Unsupported Wisconsin encoding ${encoding}`);
  }
  if (requireString(document.electionId, "Wisconsin election ID") !== "2024-president-wi") {
    throw new Error("Wisconsin election ID is incompatible");
  }
  const fields = requireArray(document.wardFields, "Wisconsin ward fields");
  if (JSON.stringify(fields) !== JSON.stringify(WISCONSIN_WARD_ROW_FIELDS)) {
    throw new Error("Wisconsin ward field contract is incompatible");
  }
  const join = requireRecord(document.join, "Wisconsin join");
  const rows = requireArray(document.wardRows, "Wisconsin ward rows");
  const wards = rows.map((rawRow, index): WisconsinWardRecord => {
    const row = requireArray(rawRow, `Wisconsin ward row ${index}`);
    if (row.length !== WISCONSIN_WARD_ROW_FIELDS.length) {
      throw new Error(`Wisconsin ward row ${index} has the wrong length`);
    }
    const geometryId = requireString(row[0], `Wisconsin ward row ${index} geometry ID`);
    if (!/^55[0-9A-Z]{12}$/.test(geometryId)) {
      throw new Error(`Invalid Wisconsin ward GEOID ${geometryId}`);
    }
    const wardName = requireString(row[1], `${geometryId} name`);
    const hasMappedResult = requireBoolean(row[2], `${geometryId} result availability`);
    const votingAgePopulation = requireNonnegativeInteger(row[3], `${geometryId} VAP`);
    const baselineVotes = decodeVotes(row, 4, geometryId);
    if (!hasMappedResult && (baselineVotes.totalVotes !== 0 || votingAgePopulation !== 0)) {
      throw new Error(`${geometryId} has values without a mapped result`);
    }
    const denominatorStatus: WisconsinDenominatorStatus = !hasMappedResult
      ? "no_mapped_2024_result"
      : baselineVotes.totalVotes <= votingAgePopulation
        ? "available"
        : "ballots_exceed_2020_vap";
    return {
      geometryId,
      countyFips: geometryId.slice(0, 5),
      wardName,
      hasMappedResult,
      votingAgePopulation,
      baselineVotes,
      turnoutCapacity: denominatorStatus === "available"
        ? votingAgePopulation - baselineVotes.totalVotes
        : 0,
      denominatorStatus,
      sourceUnitCount: hasMappedResult ? 1 : 0,
      exactSourceUnitCount: hasMappedResult ? 1 : 0,
      canonicalSourceUnitCount: 0,
      resultMatchMethod: hasMappedResult ? "official_ltsb_population_disaggregation" : null,
      demographicMatchMethod: hasMappedResult ? "official_ltsb_2020_vap_estimate" : null,
    };
  });
  if (new Set(wards.map((ward) => ward.geometryId)).size !== wards.length) {
    throw new Error("Wisconsin ward foundation contains duplicate GEOIDs");
  }

  const totalsRecord = requireRecord(document.totals, "Wisconsin totals");
  const denominatorStatusRecord = requireRecord(
    totalsRecord.denominatorStatus,
    "Wisconsin denominator status",
  );
  const mappedVotes = decodeVoteRecord(totalsRecord.mappedVotes, "Wisconsin mapped votes");
  const residualVotes = decodeVoteRecord(totalsRecord.residualVotes, "Wisconsin residual votes");
  const certifiedVotes = decodeVoteRecord(totalsRecord.certifiedVotes, "Wisconsin certified votes");
  const reconstructedVotes = emptyVotes();
  for (const ward of wards) addVotes(reconstructedVotes, ward.baselineVotes);
  addVotes(reconstructedVotes, residualVotes);
  if (!sameVotes(reconstructedVotes, certifiedVotes) || !sameVotes(mappedVotes, certifiedVotes)) {
    throw new Error("Wisconsin model units do not reconstruct the certified baseline");
  }
  const statewideVotingAgePopulation = requireNonnegativeInteger(
    totalsRecord.statewideVotingAgePopulation,
    "Wisconsin statewide VAP",
  );
  if (statewideVotingAgePopulation !== wards.reduce((sum, ward) => sum + ward.votingAgePopulation, 0)) {
    throw new Error("Wisconsin statewide VAP does not reconcile");
  }
  const turnoutCapacity = requireNonnegativeInteger(
    totalsRecord.turnoutCapacity,
    "Wisconsin turnout capacity",
  );
  if (turnoutCapacity !== wards.reduce((sum, ward) => sum + ward.turnoutCapacity, 0)) {
    throw new Error("Wisconsin turnout capacity does not reconcile");
  }
  const availableWardCount = requireNonnegativeInteger(
    denominatorStatusRecord.availableWardCount,
    "Wisconsin available ward count",
  );
  const ballotsExceed2020VapWardCount = requireNonnegativeInteger(
    denominatorStatusRecord.ballotsExceed2020VapWardCount,
    "Wisconsin over-capacity ward count",
  );
  const noMappedResultWardCount = requireNonnegativeInteger(
    denominatorStatusRecord.noMappedResultWardCount,
    "Wisconsin unmatched ward count",
  );
  const countedStatuses = {
    availableWardCount: wards.filter((ward) => ward.denominatorStatus === "available").length,
    ballotsExceed2020VapWardCount: wards.filter(
      (ward) => ward.denominatorStatus === "ballots_exceed_2020_vap",
    ).length,
    noMappedResultWardCount: wards.filter(
      (ward) => ward.denominatorStatus === "no_mapped_2024_result",
    ).length,
  };
  if (
    availableWardCount !== countedStatuses.availableWardCount
    || ballotsExceed2020VapWardCount !== countedStatuses.ballotsExceed2020VapWardCount
    || noMappedResultWardCount !== countedStatuses.noMappedResultWardCount
  ) {
    throw new Error("Wisconsin denominator status counts do not reconcile");
  }
  const geometryFeatureCount = requireNonnegativeInteger(
    join.geometryFeatureCount,
    "Wisconsin geometry feature count",
  );
  const mappedElectionGeometryCount = requireNonnegativeInteger(
    join.mappedElectionGeometryCount,
    "Wisconsin mapped geometry count",
  );
  if (geometryFeatureCount !== wards.length) throw new Error("Wisconsin geometry count mismatch");
  if (mappedElectionGeometryCount !== wards.filter((ward) => ward.hasMappedResult).length) {
    throw new Error("Wisconsin mapped geometry count mismatch");
  }

  return {
    stateCode: "WI",
    schemaVersion,
    encoding: WISCONSIN_WARD_RUNTIME_ENCODING,
    generatedAt: requireString(document.generatedAt, "Wisconsin generation date"),
    electionId: "2024-president-wi",
    source: requireRecord(document.source, "Wisconsin source"),
    join: {
      method: requireString(join.method, "Wisconsin join method"),
      demographicVintage: requireString(join.demographicVintage, "Wisconsin demographic vintage"),
      geometryVintage: requireString(join.geometryVintage, "Wisconsin geometry vintage"),
      electionVintage: requireString(join.electionVintage, "Wisconsin election vintage"),
      geometryFeatureCount,
      mappedElectionGeometryCount,
      resultReportingUnitCoveragePct: requireNonnegativeNumber(
        join.resultReportingUnitCoveragePct,
        "Wisconsin result coverage",
      ),
      statewidePaintedVoteCoveragePct: requireNonnegativeNumber(
        join.statewidePaintedVoteCoveragePct,
        "Wisconsin painted vote coverage",
      ),
    },
    totals: {
      statewideVotingAgePopulation,
      mappedVotes,
      residualVotes,
      certifiedVotes,
      turnoutCapacity,
      denominatorStatus: {
        availableWardCount,
        ballotsExceed2020VapWardCount,
        noMappedResultWardCount,
      },
    },
    wards,
    residualUnits: [],
  };
}

export function toWisconsinBehaviorModelUnits(
  foundation: WisconsinWardFoundation,
): BehaviorModelUnit[] {
  return foundation.wards
    .filter((ward) => ward.hasMappedResult)
    .map((ward) => ({
      id: `ward-${ward.geometryId}`,
      countyFips: ward.countyFips,
      geometryId: ward.geometryId,
      ...ward.baselineVotes,
      turnoutDenominator: ward.denominatorStatus === "available"
        ? ward.votingAgePopulation
        : null,
      turnoutCapacity: ward.denominatorStatus === "available"
        ? ward.turnoutCapacity
        : 0,
    }));
}
