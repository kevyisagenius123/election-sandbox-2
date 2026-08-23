import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { geoAlbersUsa } from "d3-geo";
import { feature as topologyFeature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { topology } from "topojson-server";

const GENERATED_AT = "2026-08-20";
const ITEM_ID = "878d8826218f42509e07437a82ef6b6e";
const SERVICE_ROOT = "https://services1.arcgis.com/FDsAtKBk8Hy4cAH0/ArcGIS/rest/services/2024_Election_Data_with_2025_Wards/FeatureServer/0";
const ITEM_URL = `https://www.arcgis.com/sharing/rest/content/items/${ITEM_ID}`;
const ITEM_PAGE_URL = `https://www.arcgis.com/home/item.html?id=${ITEM_ID}`;
const PAGE_SIZE = 2_000;
const QUANTIZATION = 50_000;
const SIMPLIFICATION_QUANTILE = 0.18;
const EXPECTED_ITEM_MODIFIED = 1_740_000_249_000;
const EXPECTED_FEATURE_COUNT = 7_086;
const EXPECTED_COUNTY_COUNT = 72;
const EXPECTED_TOTALS = Object.freeze({
  harrisVotes: 1_668_229,
  trumpVotes: 1_697_626,
  steinVotes: 12_275,
  oliverVotes: 10_511,
  residualOtherVotes: 34_277,
  otherVotes: 57_063,
  totalVotes: 3_422_918,
});

const COUNTY_OUTPUT = resolve("src/data/wi-2024-counties.json");
const REPORTING_OUTPUT = resolve("public/data/wi/2024/reporting-units.json");
const RUNTIME_OUTPUT = resolve("public/data/wi/2020/ward-demographics.json");
const GEOMETRY_ROOT = resolve("public/data/wi/2024");
const ELECTION_REGISTRY_OUTPUT = resolve("data-sources/wisconsin/2024-general-presidential.json");
const DENOMINATOR_REGISTRY_OUTPUT = resolve("data-sources/wisconsin/2020-vap-ward-denominator.json");

const OUT_FIELDS = [
  "OBJECTID", "GEOID", "CNTY_FIPS", "CNTY_NAME", "MCD_FIPS", "MCD_NAME", "CTV",
  "WARD_FIPS", "WARDID", "LABEL", "PERSONS18", "PRETOT24", "PREDEM24", "PREREP24",
  "PRELIB24", "PREWGR24",
].join(",");

function sha256Text(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} is ${actual} but expected ${expected}`);
}

function assertNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function nullableNonnegativeInteger(value, label) {
  return value == null ? null : assertNonnegativeInteger(value, label);
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
  for (const key of [
    "harrisVotes",
    "trumpVotes",
    "steinVotes",
    "oliverVotes",
    "residualOtherVotes",
    "otherVotes",
    "totalVotes",
  ]) target[key] += source[key];
}

function replaceHtmlTags(value) {
  const text = String(value ?? "");
  let result = "";
  let cursor = 0;
  while (cursor < text.length) {
    const tagStart = text.indexOf("<", cursor);
    if (tagStart === -1) return result + text.slice(cursor);
    const tagEnd = text.indexOf(">", tagStart + 1);
    if (tagEnd === -1) return result + text.slice(cursor);
    result += `${text.slice(cursor, tagStart)} `;
    cursor = tagEnd + 1;
  }
  return result;
}

function stripHtml(value) {
  return replaceHtmlTags(value).replace(/\s+/g, " ").trim();
}

function visitCoordinates(value, callback) {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return callback(value);
  }
  return value.map((child) => visitCoordinates(child, callback));
}

function projectGeometry(geometry, projection) {
  return {
    ...geometry,
    coordinates: visitCoordinates(geometry.coordinates, ([longitude, latitude]) => {
      const projected = projection([longitude, latitude]);
      if (!projected) throw new Error(`Unable to project coordinate ${longitude}, ${latitude}`);
      return [projected[0], 600 - projected[1]];
    }),
  };
}

function geometryBounds(features) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  for (const item of features) {
    visitCoordinates(item.geometry.coordinates, ([x, y]) => {
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
      return [x, y];
    });
  }
  return bounds.map((value) => Number(value.toFixed(3)));
}

function serializeJson(value, pretty = false) {
  return `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed with ${response.status}: ${url}`);
  return response.json();
}

async function fetchSource() {
  const item = await fetchJson(`${ITEM_URL}?f=pjson`);
  assertEqual("Wisconsin ArcGIS item owner", item.owner, "WI_Legislature");
  assertEqual("Wisconsin ArcGIS item modified timestamp", item.modified, EXPECTED_ITEM_MODIFIED);
  assertEqual("Wisconsin ArcGIS item access", item.access, "public");
  const license = stripHtml(item.licenseInfo);
  if (!license.includes("open and publicly available data")) {
    throw new Error("Wisconsin ArcGIS item no longer declares open public data");
  }

  const features = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: OUT_FIELDS,
      returnGeometry: "true",
      outSR: "4326",
      orderByFields: "OBJECTID",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "geojson",
    });
    const page = await fetchJson(`${SERVICE_ROOT}/query?${params}`);
    features.push(...page.features);
    if (page.features.length < PAGE_SIZE) break;
  }
  return { item, license, features };
}

function votesFromProperties(properties) {
  const sourceValues = [
    properties.PRETOT24,
    properties.PREDEM24,
    properties.PREREP24,
    properties.PREWGR24,
    properties.PRELIB24,
  ];
  if (sourceValues.every((value) => value == null)) return null;
  if (sourceValues.some((value) => value == null)) {
    throw new Error(`${properties.GEOID} has a partial election row`);
  }
  const totalVotes = assertNonnegativeInteger(properties.PRETOT24, `${properties.GEOID} total`);
  const harrisVotes = assertNonnegativeInteger(properties.PREDEM24, `${properties.GEOID} Harris`);
  const trumpVotes = assertNonnegativeInteger(properties.PREREP24, `${properties.GEOID} Trump`);
  const steinVotes = assertNonnegativeInteger(properties.PREWGR24, `${properties.GEOID} Stein`);
  const oliverVotes = assertNonnegativeInteger(properties.PRELIB24, `${properties.GEOID} Oliver`);
  const residualOtherVotes = totalVotes - harrisVotes - trumpVotes - steinVotes - oliverVotes;
  assertNonnegativeInteger(residualOtherVotes, `${properties.GEOID} residual Other`);
  const otherVotes = steinVotes + oliverVotes + residualOtherVotes;
  return { harrisVotes, trumpVotes, steinVotes, oliverVotes, residualOtherVotes, otherVotes, totalVotes };
}

function countyRecord(properties) {
  const fips = String(properties.CNTY_FIPS);
  return {
    fips,
    code: Number(fips.slice(-3)),
    name: String(properties.CNTY_NAME).trim(),
    reportingUnitCount: 0,
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
  };
}

const { item, license, features: sourceFeatures } = await fetchSource();
assertEqual("Wisconsin ward feature count", sourceFeatures.length, EXPECTED_FEATURE_COUNT);

const seenGeoids = new Set();
const rows = [];
const totals = emptyVotes();
const counties = new Map();
let statewideVotingAgePopulation = 0;
let turnoutCapacity = 0;
let availableWardCount = 0;
let ballotsExceed2020VapWardCount = 0;
let noMappedResultWardCount = 0;

for (const feature of sourceFeatures) {
  const properties = feature.properties;
  const geoid = String(properties.GEOID);
  if (!/^55[0-9A-Z]{12}$/.test(geoid)) throw new Error(`Invalid Wisconsin ward GEOID ${geoid}`);
  if (seenGeoids.has(geoid)) throw new Error(`Duplicate Wisconsin ward GEOID ${geoid}`);
  seenGeoids.add(geoid);
  if (!feature.geometry) throw new Error(`Wisconsin ward ${geoid} has no geometry`);
  const countyFips = String(properties.CNTY_FIPS);
  if (!/^55\d{3}$/.test(countyFips) || !geoid.startsWith(countyFips)) {
    throw new Error(`Wisconsin ward ${geoid} has invalid county ${countyFips}`);
  }
  const sourceVotingAgePopulation = nullableNonnegativeInteger(properties.PERSONS18, `${geoid} VAP`);
  const sourceVotes = votesFromProperties(properties);
  if ((sourceVotes == null) !== (sourceVotingAgePopulation == null)) {
    throw new Error(`${geoid} has inconsistent election and population availability`);
  }
  const hasMappedResult = sourceVotes != null;
  const votingAgePopulation = sourceVotingAgePopulation ?? 0;
  const votes = sourceVotes ?? emptyVotes();
  const denominatorStatus = !hasMappedResult
    ? "no_mapped_2024_result"
    : votes.totalVotes <= votingAgePopulation
      ? "available"
      : "ballots_exceed_2020_vap";
  const wardCapacity = denominatorStatus === "available"
    ? votingAgePopulation - votes.totalVotes
    : 0;
  if (denominatorStatus === "available") availableWardCount += 1;
  else if (denominatorStatus === "ballots_exceed_2020_vap") ballotsExceed2020VapWardCount += 1;
  else noMappedResultWardCount += 1;
  statewideVotingAgePopulation += votingAgePopulation;
  turnoutCapacity += wardCapacity;
  addVotes(totals, votes);
  const county = counties.get(countyFips) ?? countyRecord(properties);
  if (hasMappedResult) county.reportingUnitCount += 1;
  addVotes(county, votes);
  counties.set(countyFips, county);
  rows.push({
    geoid,
    countyFips,
    name: String(properties.LABEL).trim() || geoid,
    wardId: String(properties.WARDID).trim(),
    municipalityFips: String(properties.MCD_FIPS).trim(),
    municipalityName: String(properties.MCD_NAME).trim(),
    municipalityType: String(properties.CTV).trim(),
    hasMappedResult,
    votingAgePopulation,
    denominatorStatus,
    turnoutCapacity: wardCapacity,
    baselineVotes: votes,
    geometry: feature.geometry,
  });
}

assertEqual("Wisconsin county count", counties.size, EXPECTED_COUNTY_COUNT);
assertEqual("Wisconsin statewide VAP", statewideVotingAgePopulation, 4_612_300);
assertEqual("Wisconsin mapped ward count", rows.filter((row) => row.hasMappedResult).length, 6_946);
assertEqual("Wisconsin available ward count", availableWardCount, 6_785);
assertEqual("Wisconsin over-capacity ward count", ballotsExceed2020VapWardCount, 161);
assertEqual("Wisconsin unmatched geometry count", noMappedResultWardCount, 140);
assertEqual("Wisconsin turnout capacity", turnoutCapacity, 1_198_983);
for (const [key, expected] of Object.entries(EXPECTED_TOTALS)) {
  assertEqual(`Wisconsin ${key}`, totals[key], expected);
}

const sourceSnapshot = sourceFeatures.map((feature) => ({
  properties: Object.fromEntries(OUT_FIELDS.split(",").map((field) => [field, feature.properties[field]])),
  geometry: feature.geometry,
}));
const sourceSnapshotSha256 = sha256Text(JSON.stringify(sourceSnapshot));
const source = {
  id: "wi-ltsb-2024-election-data-with-2025-wards",
  publisher: "Wisconsin Legislative Technology Services Bureau",
  title: "2024 Election Data with 2025 Wards",
  sourceUrl: SERVICE_ROOT,
  itemUrl: ITEM_PAGE_URL,
  retrievedAt: GENERATED_AT,
  itemId: ITEM_ID,
  itemOwner: item.owner,
  itemModified: item.modified,
  sourceSnapshotSha256,
  licenseStatus: "verified_open_public_data",
  license,
  limitations: [
    "LTSB collected the 2024 election data from the Wisconsin Elections Commission and disaggregated reporting-unit returns to wards by population.",
    "The 2025 ward layer postdates the election; LTSB reaggregated election data through Census blocks into January 2025 wards.",
    "State and county totals reconcile exactly, but reconstructed ward values must not be described as certified raw ward returns.",
    "The PERSONS18 denominator is an LTSB estimate produced by aggregating 2020 Census P.L. 94-171 population data to 2025 wards.",
    "Candidate preference is not observed in Census data and is never inferred from population.",
  ],
};

const countyDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "WI",
  stateFips: "55",
  generatedAt: GENERATED_AT,
  sources: [source],
  totals,
  unassignedStatewideVotes: 0,
  counties: [...counties.values()].sort((a, b) => a.fips.localeCompare(b.fips)),
};
mkdirSync(dirname(COUNTY_OUTPUT), { recursive: true });
writeFileSync(COUNTY_OUTPUT, serializeJson(countyDocument, true), "utf8");

const reportingDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "WI",
  stateFips: "55",
  generatedAt: GENERATED_AT,
  source,
  reportingModel: "official_ltsb_population_disaggregation_to_2025_wards",
  totals,
  reportingUnits: rows.filter((row) => row.hasMappedResult).map((row) => ({
    id: `wi-${row.geoid}`,
    geometryId: row.geoid,
    countyFips: row.countyFips,
    name: row.name,
    wardId: row.wardId,
    municipalityFips: row.municipalityFips,
    municipalityName: row.municipalityName,
    municipalityType: row.municipalityType,
    type: "reconstructed_ward",
    geometryQuality: "official_2025_ward",
    resultQuality: "official_ltsb_population_disaggregation",
    ...row.baselineVotes,
  })),
};
mkdirSync(dirname(REPORTING_OUTPUT), { recursive: true });
writeFileSync(REPORTING_OUTPUT, serializeJson(reportingDocument), "utf8");

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const rowsByCounty = new Map();
for (const row of rows) {
  const countyRows = rowsByCounty.get(row.countyFips) ?? [];
  countyRows.push(row);
  rowsByCounty.set(row.countyFips, countyRows);
}

const precinctRoot = resolve(GEOMETRY_ROOT, "precincts");
mkdirSync(precinctRoot, { recursive: true });
const countyManifest = [];
for (const [countyFips, countyRows] of [...rowsByCounty].sort(([a], [b]) => a.localeCompare(b))) {
  const geometryFeatures = countyRows
    .sort((a, b) => a.geoid.localeCompare(b.geoid))
    .map((row) => ({
      type: "Feature",
      id: row.geoid,
      properties: {
        geoid: row.geoid,
        countyFips: row.countyFips,
        precinctCode: row.wardId,
        precinctName: row.name,
        sourceName: row.name,
        sourceUnitCount: row.hasMappedResult ? 1 : 0,
        resultQuality: row.hasMappedResult
          ? "official_ltsb_population_disaggregation"
          : "unmatched_geometry",
        harrisVotes: row.baselineVotes.harrisVotes,
        trumpVotes: row.baselineVotes.trumpVotes,
        otherVotes: row.baselineVotes.otherVotes,
        totalVotes: row.baselineVotes.totalVotes,
      },
      geometry: projectGeometry(row.geometry, projection),
    }));
  const rawTopology = topology({ precincts: { type: "FeatureCollection", features: geometryFeatures } }, QUANTIZATION);
  const weightedTopology = presimplify(rawTopology);
  const simplifiedTopology = simplify(weightedTopology, quantile(weightedTopology, SIMPLIFICATION_QUANTILE));
  const outputPath = resolve(precinctRoot, `${countyFips}.topo.json`);
  writeFileSync(outputPath, JSON.stringify(simplifiedTopology), "utf8");
  const simplifiedFeatures = topologyFeature(simplifiedTopology, simplifiedTopology.objects.precincts).features;
  const county = counties.get(countyFips);
  const basicVotes = {
    harrisVotes: county.harrisVotes,
    trumpVotes: county.trumpVotes,
    otherVotes: county.otherVotes,
    totalVotes: county.totalVotes,
  };
  countyManifest.push({
    countyFips,
    resultReportingUnitCount: countyRows.filter((row) => row.hasMappedResult).length,
    matchedReportingUnitCount: countyRows.filter((row) => row.hasMappedResult).length,
    unmatchedReportingUnitCount: 0,
    geometryFeatureCount: countyRows.length,
    matchedGeometryFeatureCount: countyRows.filter((row) => row.hasMappedResult).length,
    unmatchedGeometryFeatureCount: countyRows.filter((row) => !row.hasMappedResult).length,
    resultVotes: basicVotes,
    matchedVotes: basicVotes,
    resultVoteCoveragePct: 100,
    bounds: geometryBounds(simplifiedFeatures),
    dataUrl: `./data/wi/2024/precincts/${basename(outputPath)}`,
    byteSize: readFileSync(outputPath).byteLength,
  });
}

const geometryManifest = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "WI",
  stateFips: "55",
  generatedAt: GENERATED_AT,
  geometrySource: source,
  projection: "geoAlbersUsa().scale(1300).translate([487.5, 305]), then OrbitView Y-axis inversion",
  quantization: QUANTIZATION,
  simplificationQuantile: SIMPLIFICATION_QUANTILE,
  totals: {
    resultReportingUnitCount: rows.filter((row) => row.hasMappedResult).length,
    matchedReportingUnitCount: rows.filter((row) => row.hasMappedResult).length,
    unmatchedReportingUnitCount: 0,
    geometryFeatureCount: rows.length,
    matchedGeometryFeatureCount: rows.filter((row) => row.hasMappedResult).length,
    unmatchedGeometryFeatureCount: rows.filter((row) => !row.hasMappedResult).length,
    resultVotes: {
      harrisVotes: totals.harrisVotes,
      trumpVotes: totals.trumpVotes,
      otherVotes: totals.otherVotes,
      totalVotes: totals.totalVotes,
    },
    matchedVotes: {
      harrisVotes: totals.harrisVotes,
      trumpVotes: totals.trumpVotes,
      otherVotes: totals.otherVotes,
      totalVotes: totals.totalVotes,
    },
    resultVoteCoveragePct: 100,
    statewideVoteCoveragePct: 100,
  },
  counties: countyManifest,
};
const geometryManifestOutput = resolve(GEOMETRY_ROOT, "precinct-geometry-manifest.json");
writeFileSync(geometryManifestOutput, serializeJson(geometryManifest, true), "utf8");

const runtimeDocument = {
  schemaVersion: 1,
  encoding: "wi-ward-row-v1",
  generatedAt: `${GENERATED_AT}T00:00:00.000Z`,
  electionId: "2024-president-wi",
  source,
  join: {
    method: "official_ltsb_2024_results_population_disaggregated_to_january_2025_wards",
    demographicVintage: "2020",
    geometryVintage: "2025-01",
    electionVintage: "2024",
    geometryFeatureCount: rows.length,
    mappedElectionGeometryCount: rows.filter((row) => row.hasMappedResult).length,
    resultReportingUnitCoveragePct: 100,
    statewidePaintedVoteCoveragePct: 100,
  },
  totals: {
    statewideVotingAgePopulation,
    mappedVotes: totals,
    residualVotes: emptyVotes(),
    certifiedVotes: totals,
    turnoutCapacity,
    denominatorStatus: {
      availableWardCount,
      ballotsExceed2020VapWardCount,
      noMappedResultWardCount,
    },
  },
  wardFields: [
    "geometryId", "wardName", "hasMappedResult", "votingAgePopulation", "harrisVotes", "trumpVotes",
    "steinVotes", "oliverVotes", "residualOtherVotes",
  ],
  wardRows: rows
    .sort((a, b) => a.geoid.localeCompare(b.geoid))
    .map((row) => [
      row.geoid,
      row.name,
      row.hasMappedResult,
      row.votingAgePopulation,
      row.baselineVotes.harrisVotes,
      row.baselineVotes.trumpVotes,
      row.baselineVotes.steinVotes,
      row.baselineVotes.oliverVotes,
      row.baselineVotes.residualOtherVotes,
    ]),
  residualUnits: [],
};
const runtimeSerialized = serializeJson(runtimeDocument);
mkdirSync(dirname(RUNTIME_OUTPUT), { recursive: true });
writeFileSync(RUNTIME_OUTPUT, runtimeSerialized, "utf8");

const electionRegistry = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  source,
  artifact: {
    path: relative(process.cwd(), REPORTING_OUTPUT).replaceAll("\\", "/"),
    rowCount: reportingDocument.reportingUnits.length,
    sha256: sha256Text(readFileSync(REPORTING_OUTPUT)),
    byteSize: readFileSync(REPORTING_OUTPUT).byteLength,
  },
  totals,
  coverage: geometryManifest.totals,
};
mkdirSync(dirname(ELECTION_REGISTRY_OUTPUT), { recursive: true });
writeFileSync(ELECTION_REGISTRY_OUTPUT, serializeJson(electionRegistry, true), "utf8");

const denominatorRegistry = {
  schemaVersion: 1,
  generatedAt: GENERATED_AT,
  source,
  artifact: {
    path: relative(process.cwd(), RUNTIME_OUTPUT).replaceAll("\\", "/"),
    schemaVersion: runtimeDocument.schemaVersion,
    encoding: runtimeDocument.encoding,
    rowCount: rows.length,
    sha256: sha256Text(runtimeSerialized),
    byteSize: Buffer.byteLength(runtimeSerialized),
  },
  join: runtimeDocument.join,
  totals: runtimeDocument.totals,
};
mkdirSync(dirname(DENOMINATOR_REGISTRY_OUTPUT), { recursive: true });
writeFileSync(DENOMINATOR_REGISTRY_OUTPUT, serializeJson(denominatorRegistry, true), "utf8");

console.log(JSON.stringify({
  sourceItem: ITEM_ID,
  sourceSnapshotSha256,
  featureCount: rows.length,
  countyCount: counties.size,
  totals,
  statewideVotingAgePopulation,
  turnoutCapacity,
  denominatorStatus: runtimeDocument.totals.denominatorStatus,
  runtimeArtifactBytes: Buffer.byteLength(runtimeSerialized),
  geometryBytes: countyManifest.reduce((sum, county) => sum + county.byteSize, 0),
  geometryManifest: relative(process.cwd(), geometryManifestOutput).replaceAll("\\", "/"),
}, null, 2));
