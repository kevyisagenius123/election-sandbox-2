import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createInterface } from "node:readline";

const [geoInput, segmentTwoInput, archiveInput] = process.argv.slice(2);

if (!geoInput || !segmentTwoInput || !archiveInput) {
  throw new Error(
    "Usage: node scripts/import-pennsylvania-2020-pl94-demographics.mjs "
      + "<pageo2020.pl> <pa000022020.pl> <pa2020.pl.zip>",
  );
}

const GEO_PATH = resolve(geoInput);
const SEGMENT_TWO_PATH = resolve(segmentTwoInput);
const ARCHIVE_PATH = resolve(archiveInput);
const PUBLIC_OUTPUT_PATH = resolve("public/data/pa/2020/vtd-demographics.json");
const REGISTRY_OUTPUT_PATH = resolve(
  "data-sources/pennsylvania/2020-pl94-vtd-demographics.json",
);
const REPORTING_UNIT_PATH = resolve("public/data/pa/2024/reporting-units.json");
const VTD_CROSSWALK_PATH = resolve("data-sources/pennsylvania/2024-vtd-crosswalk.json");
const GEOMETRY_MANIFEST_PATH = resolve(
  "public/data/pa/2024/precinct-geometry-manifest.json",
);

const EXPECTED_ARCHIVE_SHA256 =
  "2d33a7dab29c8dd5692bbde203d253e06eebbc44fcbaa96b1caa958d454026ae";
const SOURCE_URL =
  "https://www2.census.gov/programs-surveys/decennial/2020/data/"
  + "01-Redistricting_File--PL_94-171/Pennsylvania/pa2020.pl.zip";
const SOURCE_PAGE =
  "https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html";
const RETRIEVED_AT = "2026-08-09";
const GENERATED_AT = "2026-08-09T00:00:00.000Z";

const GEO = {
  summaryLevel: 2,
  logicalRecordNumber: 7,
  geocode: 9,
  state: 12,
  county: 14,
  votingDistrict: 77,
  name: 86,
  displayName: 87,
};

// Segment 2 stores P3_001N..P3_071N, then P4_001N..P4_073N.
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
  target.harrisVotes += source.harrisVotes;
  target.trumpVotes += source.trumpVotes;
  target.steinVotes += source.steinVotes;
  target.oliverVotes += source.oliverVotes;
  target.residualOtherVotes += source.residualOtherVotes;
  target.otherVotes += source.otherVotes;
  target.totalVotes += source.totalVotes;
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

const archiveSha256 = sha256File(ARCHIVE_PATH);
if (archiveSha256 !== EXPECTED_ARCHIVE_SHA256) {
  throw new Error(
    `Unexpected Census archive hash ${archiveSha256}; expected ${EXPECTED_ARCHIVE_SHA256}`,
  );
}

const reportingDocument = JSON.parse(readFileSync(REPORTING_UNIT_PATH, "utf8"));
const vtdCrosswalk = JSON.parse(readFileSync(VTD_CROSSWALK_PATH, "utf8"));
const geometryManifest = JSON.parse(readFileSync(GEOMETRY_MANIFEST_PATH, "utf8"));
const reportingUnitById = new Map(
  reportingDocument.reportingUnits.map((unit) => [unit.id, unit]),
);

const votesByGeometry = new Map();
const resultLinkByGeometry = new Map();
const matchedReportingUnitIds = new Set();
for (const match of vtdCrosswalk.matchedGeometry) {
  const votes = emptyVotes();
  const matchMethods = new Set();
  for (const linkedUnit of match.reportingUnits) {
    const unit = reportingUnitById.get(linkedUnit.reportingUnitId);
    if (!unit) throw new Error(`Crosswalk references missing unit ${linkedUnit.reportingUnitId}`);
    matchedReportingUnitIds.add(unit.id);
    matchMethods.add(linkedUnit.matchMethod);
    addVotes(votes, unit);
  }
  votesByGeometry.set(match.geometryId, votes);
  const exactSourceUnitCount = match.reportingUnits.filter(
    (unit) => unit.matchMethod === "exact_vtd_identifier",
  ).length;
  const canonicalSourceUnitCount = match.reportingUnits.length - exactSourceUnitCount;
  resultLinkByGeometry.set(match.geometryId, {
    resultMatchMethod: matchMethods.size > 1
      ? "mixed"
      : matchMethods.has("exact_vtd_identifier")
        ? "exact_vtd_identifier"
        : "exact_canonical_name",
    sourceUnitCount: match.reportingUnits.length,
    exactSourceUnitCount,
    canonicalSourceUnitCount,
  });
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
  }));

const geographyByLogicalRecord = new Map();
await eachLine(GEO_PATH, (line) => {
  const fields = line.split("|");
  if (fields[GEO.summaryLevel] !== "700" || fields[GEO.state] !== "42") return;
  const county = fields[GEO.county];
  const votingDistrict = fields[GEO.votingDistrict];
  const geoid = fields[GEO.geocode];
  if (!/^[0-9A-Z]{11}$/.test(geoid) || geoid !== `42${county}${votingDistrict}`) {
    throw new Error(`Invalid Pennsylvania VTD geocode ${geoid}`);
  }
  geographyByLogicalRecord.set(fields[GEO.logicalRecordNumber], {
    geoid,
    countyFips: `42${county}`,
    vtdCode: votingDistrict,
    censusName: fields[GEO.name],
    displayName: fields[GEO.displayName],
  });
});

const vtds = [];
await eachLine(SEGMENT_TWO_PATH, (line) => {
  const fields = line.split("|");
  if (fields[SEGMENT_TWO.segment] !== "02") return;
  const geography = geographyByLogicalRecord.get(fields[SEGMENT_TWO.logicalRecordNumber]);
  if (!geography) return;

  const demographics = {
    votingAgePopulation: parseInteger(fields[SEGMENT_TWO.p4Total], `${geography.geoid} P4 total`),
    hispanicAnyRace: parseInteger(fields[SEGMENT_TWO.p4Hispanic], `${geography.geoid} Hispanic VAP`),
    nonHispanicWhite: parseInteger(fields[SEGMENT_TWO.p4NonHispanicWhite], `${geography.geoid} non-Hispanic White VAP`),
    nonHispanicBlack: parseInteger(fields[SEGMENT_TWO.p4NonHispanicBlack], `${geography.geoid} non-Hispanic Black VAP`),
    nonHispanicAsian: parseInteger(fields[SEGMENT_TWO.p4NonHispanicAsian], `${geography.geoid} non-Hispanic Asian VAP`),
    nonHispanicOther:
      parseInteger(fields[SEGMENT_TWO.p4NonHispanicAian], `${geography.geoid} non-Hispanic AIAN VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicNhpi], `${geography.geoid} non-Hispanic NHPI VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicSomeOtherRace], `${geography.geoid} non-Hispanic other-race VAP`)
      + parseInteger(fields[SEGMENT_TWO.p4NonHispanicMultiracial], `${geography.geoid} non-Hispanic multiracial VAP`),
  };
  const demographicSum = demographics.hispanicAnyRace
    + demographics.nonHispanicWhite
    + demographics.nonHispanicBlack
    + demographics.nonHispanicAsian
    + demographics.nonHispanicOther;
  if (demographicSum !== demographics.votingAgePopulation) {
    throw new Error(
      `${geography.geoid} demographic cells sum to ${demographicSum}, expected ${demographics.votingAgePopulation}`,
    );
  }

  const baselineVotes = votesByGeometry.get(geography.geoid) ?? emptyVotes();
  const hasMappedResult = votesByGeometry.has(geography.geoid);
  const resultLink = resultLinkByGeometry.get(geography.geoid);
  vtds.push({
    ...geography,
    ...demographics,
    hasMappedResult,
    resultMatchMethod: resultLink?.resultMatchMethod ?? null,
    sourceUnitCount: resultLink?.sourceUnitCount ?? 0,
    exactSourceUnitCount: resultLink?.exactSourceUnitCount ?? 0,
    canonicalSourceUnitCount: resultLink?.canonicalSourceUnitCount ?? 0,
    baselineVotes,
    turnoutCapacity: hasMappedResult
      ? Math.max(0, demographics.votingAgePopulation - baselineVotes.totalVotes)
      : 0,
    denominatorStatus: hasMappedResult
      ? baselineVotes.totalVotes <= demographics.votingAgePopulation
        ? "available"
        : "ballots_exceed_2020_vap"
      : "no_mapped_2024_result",
  });
});

vtds.sort((a, b) => a.geoid.localeCompare(b.geoid));
residualUnits.sort((a, b) => a.id.localeCompare(b.id));

if (vtds.length !== geographyByLogicalRecord.size) {
  throw new Error(
    `Segment 2 produced ${vtds.length} VTDs for ${geographyByLogicalRecord.size} geography records`,
  );
}
if (vtds.length !== geometryManifest.totals.geometryFeatureCount) {
  throw new Error(
    `Census VTD count ${vtds.length} does not match geometry count ${geometryManifest.totals.geometryFeatureCount}`,
  );
}
if (vtds.filter((vtd) => vtd.hasMappedResult).length
  !== geometryManifest.totals.matchedGeometryFeatureCount) {
  throw new Error("Mapped demographic VTD count does not match the election geometry manifest");
}
if (residualUnits.length !== vtdCrosswalk.totals.unmatchedReportingUnitCount + 2) {
  throw new Error(`Expected 102 residual model units; received ${residualUnits.length}`);
}

const statewideDemographics = emptyDemographics();
const matchedDemographics = emptyDemographics();
const mappedVotes = emptyVotes();
const residualVotes = emptyVotes();
const countyMap = new Map();
let turnoutCapacity = 0;
let availableDenominatorCount = 0;
let overCapacityCount = 0;

for (const vtd of vtds) {
  addDemographics(statewideDemographics, vtd);
  const county = countyMap.get(vtd.countyFips) ?? {
    countyFips: vtd.countyFips,
    vtdCount: 0,
    mappedVtdCount: 0,
    demographics: emptyDemographics(),
    mappedVotes: emptyVotes(),
    turnoutCapacity: 0,
  };
  county.vtdCount += 1;
  addDemographics(county.demographics, vtd);
  if (vtd.hasMappedResult) {
    county.mappedVtdCount += 1;
    addDemographics(matchedDemographics, vtd);
    addVotes(mappedVotes, vtd.baselineVotes);
    addVotes(county.mappedVotes, vtd.baselineVotes);
    county.turnoutCapacity += vtd.turnoutCapacity;
    turnoutCapacity += vtd.turnoutCapacity;
    if (vtd.denominatorStatus === "available") availableDenominatorCount += 1;
    else overCapacityCount += 1;
  }
  countyMap.set(vtd.countyFips, county);
}
for (const unit of residualUnits) addVotes(residualVotes, unit);

const reconstructedVotes = emptyVotes();
addVotes(reconstructedVotes, mappedVotes);
addVotes(reconstructedVotes, residualVotes);
if (JSON.stringify(reconstructedVotes) !== JSON.stringify(reportingDocument.totals)) {
  throw new Error(
    `Model units do not reconstruct the certified baseline: ${JSON.stringify(reconstructedVotes)}`,
  );
}

const countySummaries = [...countyMap.values()].sort((a, b) =>
  a.countyFips.localeCompare(b.countyFips));
const source = {
  id: "census-2020-pl94-pa-vtd-p4",
  publisher: "United States Census Bureau",
  title: "2020 Census Redistricting Data (P.L. 94-171), Table P4",
  sourceUrl: SOURCE_URL,
  documentationUrl: SOURCE_PAGE,
  retrievedAt: RETRIEVED_AT,
  geographyVintage: "2020 Census voting districts",
  table: "P4: Hispanic or Latino, and not Hispanic or Latino by race for the population 18 years and over",
  archiveFile: basename(ARCHIVE_PATH),
  archiveSha256,
  pipelineVersion: "pa-pl94-vtd-demographics-v2",
  licenseStatus: "review_required",
  limitations: [
    "The denominator is the 2020 population age 18 and over, not citizen voting-age population or a 2024 eligible-voter estimate.",
    "The demographic vintage predates the 2024 election baseline by four years.",
    "PL 94-171 tabulations use the 2020 Census disclosure-avoidance system.",
    "Candidate preference is not observed in Census data and must not be inferred from these aggregate counts alone.",
  ],
};

const document = {
  schemaVersion: 2,
  generatedAt: GENERATED_AT,
  electionId: "2024-president-pa",
  source,
  join: {
    method: "exact_state_county_vtd_identifier",
    demographicVintage: "2020",
    geometryVintage: "2020",
    electionVintage: "2024",
    geometryFeatureCount: vtds.length,
    mappedElectionGeometryCount: vtds.filter((vtd) => vtd.hasMappedResult).length,
    unavailableElectionGeometryCount: vtds.filter((vtd) => !vtd.hasMappedResult).length,
    resultReportingUnitCoveragePct: geometryManifest.totals.resultVoteCoveragePct,
  },
  totals: {
    statewideDemographics,
    matchedDemographics,
    mappedVotes,
    residualVotes,
    certifiedVotes: reportingDocument.totals,
    turnoutCapacity,
    denominatorStatus: {
      availableVtdCount: availableDenominatorCount,
      ballotsExceed2020VapVtdCount: overCapacityCount,
      noMappedResultVtdCount: vtds.filter((vtd) => !vtd.hasMappedResult).length,
    },
  },
  counties: countySummaries,
  vtds,
  residualUnits,
};

const serialized = `${JSON.stringify(document)}\n`;
mkdirSync(dirname(PUBLIC_OUTPUT_PATH), { recursive: true });
writeFileSync(PUBLIC_OUTPUT_PATH, serialized, "utf8");

const registry = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  source,
  artifact: {
    path: "public/data/pa/2020/vtd-demographics.json",
    sha256: sha256Text(serialized),
    byteSize: Buffer.byteLength(serialized),
  },
  join: document.join,
  totals: document.totals,
  counties: countySummaries,
};
mkdirSync(dirname(REGISTRY_OUTPUT_PATH), { recursive: true });
writeFileSync(REGISTRY_OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

console.log(`Wrote ${vtds.length.toLocaleString()} Census VTD demographic records`);
console.log(
  `Mapped ${document.join.mappedElectionGeometryCount.toLocaleString()} VTDs; `
    + `${document.join.unavailableElectionGeometryCount.toLocaleString()} remain unavailable for behavior modeling`,
);
console.log(
  `Certified baseline reconstructed: ${reconstructedVotes.totalVotes.toLocaleString()} votes`,
);
console.log(`Public artifact: ${PUBLIC_OUTPUT_PATH}`);
console.log(`Registry: ${REGISTRY_OUTPUT_PATH}`);
