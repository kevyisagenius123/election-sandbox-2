import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const [geoInput, segmentTwoInput, archiveInput, geometryInput] = process.argv.slice(2);
if (!geoInput || !segmentTwoInput || !archiveInput || !geometryInput) {
  throw new Error(
    "Usage: node scripts/import-michigan-2020-pl94-demographics.mjs " +
    "<migeo2020.pl> <mi000022020.pl> <mi2020.pl.zip> <official-2024-precincts.geojson>",
  );
}

const GEO_PATH = resolve(geoInput);
const SEGMENT_TWO_PATH = resolve(segmentTwoInput);
const ARCHIVE_PATH = resolve(archiveInput);
const GEOMETRY_PATH = resolve(geometryInput);
const REPORTING_UNIT_PATH = resolve("public/data/mi/2024/reporting-units.json");
const CROSSWALK_PATH = resolve("data-sources/michigan/2024-precinct-crosswalk.json");
const GEOMETRY_MANIFEST_PATH = resolve("public/data/mi/2024/precinct-geometry-manifest.json");
const PUBLIC_OUTPUT_PATH = resolve("public/data/mi/2020/precinct-demographics.json");
const REGISTRY_OUTPUT_PATH = resolve("data-sources/michigan/2020-pl94-precinct-demographics.json");

const EXPECTED_ARCHIVE_SHA256 = "971bd53abeb1d905bb9b09bfe4dc1afe8514a916f24d285b289e0f66ec5cfb62";
const EXPECTED_GEOMETRY_SHA256 = "bbc331967ac5e2e1293e581bcdd9c0fa7c5c556faa1b6caaa5d984720be90c4b";
const SOURCE_URL = "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/Michigan/mi2020.pl.zip";
const SOURCE_PAGE = "https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html";
const GENERATED_AT = "2026-08-10T00:00:00.000Z";
const RUNTIME_SCHEMA_VERSION = 1;
const RUNTIME_ENCODING = "mi-precinct-row-v1";
const ROW_FIELDS = [
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
];

const GEO = {
  summaryLevel: 2,
  logicalRecordNumber: 7,
  geocode: 9,
  state: 12,
  county: 14,
  votingDistrict: 77,
  name: 86,
};
const SEGMENT_TWO = {
  segment: 3,
  logicalRecordNumber: 4,
  p4Total: 76,
  p4Hispanic: 77,
  p4NonHispanicWhite: 80,
  p4NonHispanicBlack: 81,
  p4NonHispanicAian: 82,
  p4NonHispanicAsian: 83,
  p4NonHispanicNhpi: 84,
  p4NonHispanicSomeOtherRace: 85,
  p4NonHispanicMultiracial: 86,
};

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative safe integer; received ${value}`);
  }
  return parsed;
}

function emptyVotes() {
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

function addVotes(target, source) {
  for (const key of Object.keys(target)) target[key] += source[key];
}

function emptyDemographics() {
  return {
    votingAgePopulation: 0,
    hispanicAnyRace: 0,
    nonHispanicWhite: 0,
    nonHispanicBlack: 0,
    nonHispanicAsian: 0,
    nonHispanicOther: 0,
  };
}

function addDemographics(target, source) {
  for (const key of Object.keys(target)) target[key] += source[key];
}

async function eachLine(path, callback) {
  const reader = createInterface({
    input: createReadStream(path, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of reader) callback(line);
}

function allocateInteger(total, items, weight) {
  const weights = items.map((item) => Math.max(0, Number(weight(item)) || 0));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const effectiveWeights = weightTotal > 0 ? weights : items.map(() => 1);
  const effectiveTotal = effectiveWeights.reduce((sum, value) => sum + value, 0);
  const raw = effectiveWeights.map((value) => total * value / effectiveTotal);
  const allocated = raw.map(Math.floor);
  let remaining = total - allocated.reduce((sum, value) => sum + value, 0);
  const order = items.map((item, index) => ({
    index,
    remainder: raw[index] - allocated[index],
    id: item.properties.PRECINCTID,
  })).sort((a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id));
  for (let index = 0; index < remaining; index += 1) allocated[order[index].index] += 1;
  return allocated;
}

const archiveSha256 = sha256File(ARCHIVE_PATH);
if (archiveSha256 !== EXPECTED_ARCHIVE_SHA256) throw new Error(`Unexpected Census archive hash ${archiveSha256}`);
const geometrySha256 = sha256File(GEOMETRY_PATH);
if (geometrySha256 !== EXPECTED_GEOMETRY_SHA256) throw new Error(`Unexpected Michigan geometry hash ${geometrySha256}`);

const reportingDocument = JSON.parse(readFileSync(REPORTING_UNIT_PATH, "utf8"));
const crosswalk = JSON.parse(readFileSync(CROSSWALK_PATH, "utf8"));
const geometryManifest = JSON.parse(readFileSync(GEOMETRY_MANIFEST_PATH, "utf8"));
const geometry = JSON.parse(readFileSync(GEOMETRY_PATH, "utf8")).features;
const reportingUnitById = new Map(reportingDocument.reportingUnits.map((unit) => [unit.id, unit]));

const votesByGeometry = new Map();
const resultLinkByGeometry = new Map();
const matchedReportingUnitIds = new Set();
for (const match of crosswalk.matchedGeometry) {
  const votes = emptyVotes();
  let exactSourceUnitCount = 0;
  let canonicalSourceUnitCount = 0;
  for (const linkedUnit of match.reportingUnits) {
    const unit = reportingUnitById.get(linkedUnit.reportingUnitId);
    if (!unit) throw new Error(`Crosswalk references missing unit ${linkedUnit.reportingUnitId}`);
    matchedReportingUnitIds.add(unit.id);
    addVotes(votes, unit);
    if (linkedUnit.matchMethod === "exact_official_ward_key") exactSourceUnitCount += 1;
    else canonicalSourceUnitCount += 1;
  }
  votesByGeometry.set(match.geometryId, votes);
  resultLinkByGeometry.set(match.geometryId, { exactSourceUnitCount, canonicalSourceUnitCount });
}

const residualUnits = reportingDocument.reportingUnits
  .filter((unit) => !matchedReportingUnitIds.has(unit.id))
  .map((unit) => ({
    id: unit.id,
    countyFips: unit.countyFips,
    name: unit.name,
    type: unit.type,
    harrisVotes: unit.harrisVotes,
    trumpVotes: unit.trumpVotes,
    steinVotes: unit.steinVotes,
    oliverVotes: unit.oliverVotes,
    residualOtherVotes: unit.residualOtherVotes,
    otherVotes: unit.otherVotes,
    totalVotes: unit.totalVotes,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

const geographyByLogicalRecord = new Map();
await eachLine(GEO_PATH, (line) => {
  const fields = line.split("|");
  if (fields[GEO.summaryLevel] !== "700" || fields[GEO.state] !== "26") return;
  const geoid = fields[GEO.geocode];
  if (!/^[0-9A-Z]{11}$/.test(geoid) || geoid !== `26${fields[GEO.county]}${fields[GEO.votingDistrict]}`) {
    throw new Error(`Invalid Michigan VTD geocode ${geoid}`);
  }
  geographyByLogicalRecord.set(fields[GEO.logicalRecordNumber], {
    geoid,
    countyFips: `26${fields[GEO.county]}`,
    vtdCode: fields[GEO.votingDistrict],
    censusName: fields[GEO.name],
  });
});

const demographicsByVtd = new Map();
await eachLine(SEGMENT_TWO_PATH, (line) => {
  const fields = line.split("|");
  if (fields[SEGMENT_TWO.segment] !== "02") return;
  const geography = geographyByLogicalRecord.get(fields[SEGMENT_TWO.logicalRecordNumber]);
  if (!geography) return;
  const demographics = {
    hispanicAnyRace: parseInteger(fields[SEGMENT_TWO.p4Hispanic], `${geography.geoid} Hispanic VAP`),
    nonHispanicWhite: parseInteger(fields[SEGMENT_TWO.p4NonHispanicWhite], `${geography.geoid} White VAP`),
    nonHispanicBlack: parseInteger(fields[SEGMENT_TWO.p4NonHispanicBlack], `${geography.geoid} Black VAP`),
    nonHispanicAsian: parseInteger(fields[SEGMENT_TWO.p4NonHispanicAsian], `${geography.geoid} Asian VAP`),
    nonHispanicOther:
      parseInteger(fields[SEGMENT_TWO.p4NonHispanicAian], `${geography.geoid} AIAN VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicNhpi], `${geography.geoid} NHPI VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicSomeOtherRace], `${geography.geoid} other-race VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicMultiracial], `${geography.geoid} multiracial VAP`),
  };
  demographics.votingAgePopulation = Object.values(demographics).reduce((sum, value) => sum + value, 0);
  const officialTotal = parseInteger(fields[SEGMENT_TWO.p4Total], `${geography.geoid} P4 total`);
  if (demographics.votingAgePopulation !== officialTotal) throw new Error(`${geography.geoid} P4 cells do not reconcile`);
  demographicsByVtd.set(geography.geoid, { ...geography, ...demographics });
});
if (demographicsByVtd.size !== geographyByLogicalRecord.size) throw new Error("Michigan P4 segment does not cover every VTD geography row");

const geometryByVtd = new Map();
for (const feature of geometry) {
  const properties = feature.properties;
  const vtdGeoid = `26${properties.COUNTYFIPS}${properties.VTDST}`;
  const features = geometryByVtd.get(vtdGeoid) ?? [];
  features.push(feature);
  geometryByVtd.set(vtdGeoid, features);
}

const allocationByGeometry = new Map();
for (const [vtdGeoid, features] of geometryByVtd) {
  const demographics = demographicsByVtd.get(vtdGeoid);
  if (!demographics) continue;
  const fields = ["hispanicAnyRace", "nonHispanicWhite", "nonHispanicBlack", "nonHispanicAsian", "nonHispanicOther"];
  const allocations = Object.fromEntries(fields.map((field) => [
    field,
    allocateInteger(demographics[field], features, (feature) => feature.properties.Registered_Voters),
  ]));
  features.forEach((feature, index) => {
    const profile = Object.fromEntries(fields.map((field) => [field, allocations[field][index]]));
    profile.votingAgePopulation = fields.reduce((sum, field) => sum + profile[field], 0);
    allocationByGeometry.set(feature.properties.PRECINCTID, {
      ...profile,
      censusVtdGeoid: vtdGeoid,
      censusName: demographics.censusName,
      demographicMatchMethod: features.length === 1
        ? "official_vtdst_bridge"
        : "registered_voter_weighted_vtd_split",
    });
  });
}

const rows = geometry.map((feature) => {
  const properties = feature.properties;
  const geometryId = properties.PRECINCTID;
  const profile = allocationByGeometry.get(geometryId) ?? {
    censusVtdGeoid: null,
    censusName: null,
    demographicMatchMethod: "unavailable",
    ...emptyDemographics(),
  };
  const baselineVotes = votesByGeometry.get(geometryId) ?? emptyVotes();
  const resultLink = resultLinkByGeometry.get(geometryId) ?? {
    exactSourceUnitCount: 0,
    canonicalSourceUnitCount: 0,
  };
  const hasMappedResult = votesByGeometry.has(geometryId);
  const hasDemographics = profile.demographicMatchMethod !== "unavailable";
  const turnoutCapacity = hasMappedResult && hasDemographics
    ? Math.max(0, profile.votingAgePopulation - baselineVotes.totalVotes)
    : 0;
  return {
    geometryId,
    countyFips: `26${properties.COUNTYFIPS}`,
    precinctName: properties.Precinct_Long_Name || properties.NAME || geometryId,
    registeredVoters: Number(properties.Registered_Voters) || 0,
    ...profile,
    ...resultLink,
    baselineVotes,
    hasMappedResult,
    turnoutCapacity,
    denominatorStatus: !hasMappedResult
      ? "no_mapped_2024_result"
      : !hasDemographics
        ? "demographic_bridge_unavailable"
        : baselineVotes.totalVotes <= profile.votingAgePopulation
          ? "available"
          : "ballots_exceed_2020_vap",
  };
}).sort((a, b) => a.geometryId.localeCompare(b.geometryId));

const statewideDemographics = emptyDemographics();
for (const demographics of demographicsByVtd.values()) addDemographics(statewideDemographics, demographics);
const matchedDemographics = emptyDemographics();
const mappedVotes = emptyVotes();
const residualVotes = emptyVotes();
let turnoutCapacity = 0;
for (const row of rows) {
  if (row.demographicMatchMethod !== "unavailable") addDemographics(matchedDemographics, row);
  if (row.hasMappedResult) addVotes(mappedVotes, row.baselineVotes);
  turnoutCapacity += row.turnoutCapacity;
}
for (const unit of residualUnits) addVotes(residualVotes, unit);
const reconstructedVotes = emptyVotes();
addVotes(reconstructedVotes, mappedVotes);
addVotes(reconstructedVotes, residualVotes);
if (JSON.stringify(reconstructedVotes) !== JSON.stringify(reportingDocument.totals)) {
  throw new Error(`Michigan model units do not reconstruct baseline: ${JSON.stringify(reconstructedVotes)}`);
}

const source = {
  id: "census-2020-pl94-mi-vtd-p4",
  publisher: "United States Census Bureau",
  title: "2020 Census Redistricting Data (P.L. 94-171), Table P4",
  sourceUrl: SOURCE_URL,
  documentationUrl: SOURCE_PAGE,
  retrievedAt: "2026-08-10",
  geographyVintage: "2020 Census voting districts",
  table: "P4: Hispanic or Latino, and not Hispanic or Latino by race for the population 18 years and over",
  archiveFile: basename(ARCHIVE_PATH),
  archiveSha256,
  pipelineVersion: "mi-pl94-2024-precinct-demographics-v1",
  licenseStatus: "review_required",
  limitations: [
    "The denominator is 2020 population age 18 and over, not citizen voting-age population or a 2024 eligible-voter estimate.",
    "Michigan's official 2024 VTDST field is an approximation to 2020 Census VTD geography; 72 precinct polygons have no matching 2020 VTD record.",
    "When two or three 2024 precinct polygons share one 2020 VTD, integer P4 counts are split by official 2024 registered-voter counts.",
    "The registered-voter-weighted split is a documented modeling allocation, not a Census tabulation for the 2024 precinct.",
    "Candidate preference is not observed in Census data and is never inferred from these aggregate counts.",
  ],
};
const document = {
  schemaVersion: RUNTIME_SCHEMA_VERSION,
  encoding: RUNTIME_ENCODING,
  generatedAt: GENERATED_AT,
  electionId: "2024-president-mi",
  source,
  join: {
    method: "official_2024_vtdst_to_2020_census_vtd_with_registered_voter_weighted_split",
    demographicVintage: "2020",
    geometryVintage: "2024",
    electionVintage: "2024",
    geometryFeatureCount: rows.length,
    directVtdBridgeCount: rows.filter((row) => row.demographicMatchMethod === "official_vtdst_bridge").length,
    weightedSplitGeometryCount: rows.filter((row) => row.demographicMatchMethod === "registered_voter_weighted_vtd_split").length,
    unavailableDemographicGeometryCount: rows.filter((row) => row.demographicMatchMethod === "unavailable").length,
    mappedElectionGeometryCount: rows.filter((row) => row.hasMappedResult).length,
    resultReportingUnitCoveragePct: geometryManifest.totals.resultVoteCoveragePct,
    statewidePaintedVoteCoveragePct: geometryManifest.totals.statewideVoteCoveragePct,
  },
  totals: {
    statewideDemographics,
    matchedDemographics,
    mappedVotes,
    residualVotes,
    certifiedVotes: reportingDocument.totals,
    turnoutCapacity,
    denominatorStatus: {
      availablePrecinctCount: rows.filter((row) => row.denominatorStatus === "available").length,
      ballotsExceed2020VapPrecinctCount: rows.filter((row) => row.denominatorStatus === "ballots_exceed_2020_vap").length,
      demographicBridgeUnavailablePrecinctCount: rows.filter((row) => row.denominatorStatus === "demographic_bridge_unavailable").length,
      noMappedResultPrecinctCount: rows.filter((row) => row.denominatorStatus === "no_mapped_2024_result").length,
    },
  },
  precinctFields: ROW_FIELDS,
  precinctRows: rows.map((row) => [
    row.geometryId,
    row.censusVtdGeoid,
    row.precinctName,
    row.demographicMatchMethod,
    row.registeredVoters,
    row.votingAgePopulation,
    row.hispanicAnyRace,
    row.nonHispanicWhite,
    row.nonHispanicBlack,
    row.nonHispanicAsian,
    row.nonHispanicOther,
    row.exactSourceUnitCount,
    row.canonicalSourceUnitCount,
    row.baselineVotes.harrisVotes,
    row.baselineVotes.trumpVotes,
    row.baselineVotes.steinVotes,
    row.baselineVotes.oliverVotes,
    row.baselineVotes.residualOtherVotes,
  ]),
  residualUnits,
};
const serialized = `${JSON.stringify(document)}\n`;
mkdirSync(dirname(PUBLIC_OUTPUT_PATH), { recursive: true });
writeFileSync(PUBLIC_OUTPUT_PATH, serialized, "utf8");

const registry = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  source,
  geometrySourceSha256: geometrySha256,
  artifact: {
    path: "public/data/mi/2020/precinct-demographics.json",
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    encoding: RUNTIME_ENCODING,
    rowCount: rows.length,
    sha256: sha256Text(serialized),
    byteSize: Buffer.byteLength(serialized),
  },
  join: document.join,
  totals: document.totals,
};
mkdirSync(dirname(REGISTRY_OUTPUT_PATH), { recursive: true });
writeFileSync(REGISTRY_OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  censusVtdCount: demographicsByVtd.size,
  geometryFeatureCount: rows.length,
  directVtdBridgeCount: document.join.directVtdBridgeCount,
  weightedSplitGeometryCount: document.join.weightedSplitGeometryCount,
  unavailableDemographicGeometryCount: document.join.unavailableDemographicGeometryCount,
  mappedElectionGeometryCount: document.join.mappedElectionGeometryCount,
  residualUnitCount: residualUnits.length,
  turnoutCapacity,
  denominatorStatus: document.totals.denominatorStatus,
  certifiedVotes: reconstructedVotes,
  artifactBytes: Buffer.byteLength(serialized),
}, null, 2));
