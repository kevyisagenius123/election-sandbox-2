import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { geoAlbersUsa } from "d3-geo";
import { open } from "shapefile";
import { feature as topologyFeature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { topology } from "topojson-server";

const CENSUS_SOURCE_URL = "https://www2.census.gov/geo/tiger/TIGER2020PL/STATE/42_PENNSYLVANIA/42/tl_2020_42_vtd20.zip";
const CENSUS_TECHNICAL_DOCUMENTATION_URL = "https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2020pl/TGRSHP2020PL_TechDoc.pdf";
const GENERATED_AT = "2026-08-09";
const QUANTIZATION = 50_000;
const SIMPLIFICATION_QUANTILE = 0.18;

function usage() {
  throw new Error(
    "Usage: node scripts/build-pennsylvania-vtd-geometry.mjs " +
    "<reporting-units.json> <vtd.shp> <vtd.dbf> <source.zip> " +
    "[public-output-root] [crosswalk-output]",
  );
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function addVotes(target, unit) {
  target.harrisVotes += unit.harrisVotes;
  target.trumpVotes += unit.trumpVotes;
  target.otherVotes += unit.otherVotes;
  target.totalVotes += unit.totalVotes;
}

function emptyVotes() {
  return { harrisVotes: 0, trumpVotes: 0, otherVotes: 0, totalVotes: 0 };
}

function percentage(numerator, denominator) {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(4));
}

function normalizeNumericToken(token) {
  for (const character of token) {
    if (character < "0" || character > "9") return token;
  }
  let firstSignificantDigit = 0;
  while (firstSignificantDigit < token.length - 1 && token[firstSignificantDigit] === "0") {
    firstSignificantDigit += 1;
  }
  return token.slice(firstSignificantDigit);
}

function normalizedVtdName(value) {
  const normalized = String(value ?? "")
    .toUpperCase()
    .replace(/\bVOTING DISTRICT\b/g, "")
    .replace(/\bW\b/g, "WARD")
    .replace(/\bP\b/g, "PRECINCT")
    .replace(/\bD\b/g, "DISTRICT")
    .replace(/\bX\b/g, "DISTRICT")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return normalized.split(" ").map(normalizeNumericToken).join(" ");
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

function countyStats(countyFips) {
  return {
    countyFips,
    resultReportingUnitCount: 0,
    matchedReportingUnitCount: 0,
    unmatchedReportingUnitCount: 0,
    exactIdentifierMatchCount: 0,
    canonicalNameMatchCount: 0,
    geometryFeatureCount: 0,
    matchedGeometryFeatureCount: 0,
    unmatchedGeometryFeatureCount: 0,
    duplicateGeometryMatchCount: 0,
    resultVotes: emptyVotes(),
    matchedVotes: emptyVotes(),
  };
}

const reportingUnitPath = resolve(process.argv[2] ?? "");
const shapefilePath = resolve(process.argv[3] ?? "");
const databasePath = resolve(process.argv[4] ?? "");
const archivePath = resolve(process.argv[5] ?? "");
const publicOutputRoot = resolve(process.argv[6] ?? "public/data/pa/2024");
const crosswalkOutputPath = resolve(
  process.argv[7] ?? "data-sources/pennsylvania/2024-vtd-crosswalk.json",
);

if (![process.argv[2], process.argv[3], process.argv[4], process.argv[5]].every(Boolean)) usage();

const reportingDocument = JSON.parse(readFileSync(reportingUnitPath, "utf8"));
const sourceUnits = reportingDocument.reportingUnits.filter((unit) => unit.type === "precinct");
const statsByCounty = new Map();

for (const unit of sourceUnits) {
  const stats = statsByCounty.get(unit.countyFips) ?? countyStats(unit.countyFips);
  stats.resultReportingUnitCount += 1;
  addVotes(stats.resultVotes, unit);
  statsByCounty.set(unit.countyFips, stats);
}

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const geometrySource = await open(shapefilePath, databasePath);
const sourceGeometry = [];
const geometryById = new Map();
const geometryIdsByName = new Map();
let geometryRecord;

while (!(geometryRecord = await geometrySource.read()).done) {
  const item = geometryRecord.value;
  const properties = item.properties;
  const countyFips = `42${String(properties.COUNTYFP20).padStart(3, "0")}`;
  const geoid = String(properties.GEOID20);
  const nameKey = `${countyFips}:${normalizedVtdName(properties.NAME20)}`;
  const nameMatches = geometryIdsByName.get(nameKey) ?? [];
  nameMatches.push(geoid);
  geometryIdsByName.set(nameKey, nameMatches);
  geometryById.set(geoid, item);
  sourceGeometry.push(item);
}

const sourceUnitsByGeometry = new Map();
const matchMethodByUnit = new Map();
for (const unit of sourceUnits) {
  let geometryId = geometryById.has(unit.sourceVtdGeoid) ? unit.sourceVtdGeoid : null;
  let matchMethod = geometryId ? "exact_vtd_identifier" : null;

  if (!geometryId) {
    const nameKey = `${unit.countyFips}:${normalizedVtdName(unit.municipalityName)}`;
    const nameMatches = geometryIdsByName.get(nameKey) ?? [];
    if (nameMatches.length === 1) {
      [geometryId] = nameMatches;
      matchMethod = "exact_canonical_name";
    }
  }

  if (!geometryId || !matchMethod) continue;
  const units = sourceUnitsByGeometry.get(geometryId) ?? [];
  units.push(unit);
  sourceUnitsByGeometry.set(geometryId, units);
  matchMethodByUnit.set(unit.id, matchMethod);
}

const featuresByCounty = new Map();

for (const sourceFeature of sourceGeometry) {
  const properties = sourceFeature.properties;
  const geoid = String(properties.GEOID20);
  const countyFips = `42${String(properties.COUNTYFP20).padStart(3, "0")}`;
  const matchedUnits = sourceUnitsByGeometry.get(geoid) ?? [];
  const votes = matchedUnits.reduce((total, unit) => {
    addVotes(total, unit);
    return total;
  }, emptyVotes());
  const sourceNames = [...new Set(matchedUnits.map((unit) => unit.name))];
  const stats = statsByCounty.get(countyFips) ?? countyStats(countyFips);

  stats.geometryFeatureCount += 1;
  if (matchedUnits.length > 0) {
    stats.matchedGeometryFeatureCount += 1;
    stats.matchedReportingUnitCount += matchedUnits.length;
    stats.exactIdentifierMatchCount += matchedUnits.filter(
      (unit) => matchMethodByUnit.get(unit.id) === "exact_vtd_identifier",
    ).length;
    stats.canonicalNameMatchCount += matchedUnits.filter(
      (unit) => matchMethodByUnit.get(unit.id) === "exact_canonical_name",
    ).length;
    if (matchedUnits.length > 1) stats.duplicateGeometryMatchCount += 1;
    addVotes(stats.matchedVotes, votes);
  } else {
    stats.unmatchedGeometryFeatureCount += 1;
  }
  statsByCounty.set(countyFips, stats);

  const item = {
    type: "Feature",
    id: geoid,
    properties: {
      geoid,
      countyFips,
      vtdCode: String(properties.VTDST20),
      censusName: String(properties.NAME20),
      sourceName: sourceNames[0] ?? null,
      sourceUnitCount: matchedUnits.length,
      resultQuality: matchedUnits.length === 0
        ? "unmatched_geometry"
        : matchedUnits.some((unit) => matchMethodByUnit.get(unit.id) === "exact_canonical_name")
          ? "official_canonical_name"
          : "official_exact_vtd",
      ...votes,
    },
    geometry: projectGeometry(sourceFeature.geometry, projection),
  };
  const countyFeatures = featuresByCounty.get(countyFips) ?? [];
  countyFeatures.push(item);
  featuresByCounty.set(countyFips, countyFeatures);
}

const unmatchedUnits = sourceUnits.filter((unit) => !matchMethodByUnit.has(unit.id));
for (const unit of unmatchedUnits) {
  const stats = statsByCounty.get(unit.countyFips);
  stats.unmatchedReportingUnitCount += 1;
}

const precinctOutputRoot = resolve(publicOutputRoot, "precincts");
mkdirSync(precinctOutputRoot, { recursive: true });
const countyManifest = [];

for (const [countyFips, features] of [...featuresByCounty].sort(([a], [b]) => a.localeCompare(b))) {
  features.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const rawTopology = topology({
    precincts: { type: "FeatureCollection", features },
  }, QUANTIZATION);
  const weightedTopology = presimplify(rawTopology);
  const threshold = quantile(weightedTopology, SIMPLIFICATION_QUANTILE);
  const simplifiedTopology = simplify(weightedTopology, threshold);
  const outputPath = resolve(precinctOutputRoot, `${countyFips}.topo.json`);
  writeFileSync(outputPath, JSON.stringify(simplifiedTopology), "utf8");

  const simplifiedFeatures = topologyFeature(
    simplifiedTopology,
    simplifiedTopology.objects.precincts,
  ).features;
  const stats = statsByCounty.get(countyFips);
  countyManifest.push({
    ...stats,
    resultVoteCoveragePct: percentage(stats.matchedVotes.totalVotes, stats.resultVotes.totalVotes),
    bounds: geometryBounds(simplifiedFeatures),
    dataUrl: `./data/pa/2024/precincts/${basename(outputPath)}`,
    byteSize: readFileSync(outputPath).byteLength,
  });
}

const totalStats = countyManifest.reduce((total, county) => {
  for (const key of [
    "resultReportingUnitCount", "matchedReportingUnitCount", "unmatchedReportingUnitCount",
    "exactIdentifierMatchCount", "canonicalNameMatchCount",
    "geometryFeatureCount", "matchedGeometryFeatureCount", "unmatchedGeometryFeatureCount",
    "duplicateGeometryMatchCount",
  ]) total[key] += county[key];
  addVotes(total.resultVotes, county.resultVotes);
  addVotes(total.matchedVotes, county.matchedVotes);
  return total;
}, {
  ...countyStats("42"),
  countyFips: undefined,
});

const geometrySourceMetadata = {
  id: "census-tiger-2020-pa-vtd",
  publisher: "United States Census Bureau",
  title: "2020 Census Pennsylvania Voting Districts",
  sourceUrl: CENSUS_SOURCE_URL,
  technicalDocumentationUrl: CENSUS_TECHNICAL_DOCUMENTATION_URL,
  vintage: "2020-01-01",
  retrievedAt: GENERATED_AT,
  sourceArchiveSha256: sha256(archivePath),
  shapefileSha256: sha256(shapefilePath),
  databaseSha256: sha256(databasePath),
  limitations: [
    "The geometry is the 2020 Census voting-district vintage while the election returns are from 2024.",
    "County-plus-VTD identifiers are matched first; no proximity-based or approximate string matching is used.",
    "When an identifier changed, a unit is matched only if its normalized official name resolves to exactly one Census VTD in the same county.",
    "Multiple official election reporting units that share one Census VTD are aggregated into one polygon.",
  ],
};

const manifest = {
  schemaVersion: 1,
  electionId: reportingDocument.electionId,
  stateCode: "PA",
  stateFips: "42",
  generatedAt: GENERATED_AT,
  geometrySource: geometrySourceMetadata,
  projection: "geoAlbersUsa().scale(1300).translate([487.5, 305]), then OrbitView Y-axis inversion",
  quantization: QUANTIZATION,
  simplificationQuantile: SIMPLIFICATION_QUANTILE,
  totals: {
    ...totalStats,
    resultVoteCoveragePct: percentage(totalStats.matchedVotes.totalVotes, totalStats.resultVotes.totalVotes),
  },
  counties: countyManifest,
};

const manifestOutputPath = resolve(publicOutputRoot, "precinct-geometry-manifest.json");
mkdirSync(dirname(manifestOutputPath), { recursive: true });
writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const matchedGeometry = [...sourceUnitsByGeometry]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([geometryId, units]) => ({
    geometryId,
    reportingUnits: units
      .map((unit) => ({
        reportingUnitId: unit.id,
        matchMethod: matchMethodByUnit.get(unit.id),
      }))
      .sort((a, b) => a.reportingUnitId.localeCompare(b.reportingUnitId)),
  }));
const crosswalk = {
  schemaVersion: 1,
  electionId: reportingDocument.electionId,
  generatedAt: GENERATED_AT,
  geometrySource: geometrySourceMetadata,
  matchMethods: [
    "exact normalized STATEFP20 + COUNTYFP20 + VTDST20",
    "unique exact canonical name within county after documented PA abbreviation normalization",
  ],
  totals: manifest.totals,
  matchedGeometry,
  unmatchedReportingUnits: unmatchedUnits
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((unit) => ({
      reportingUnitId: unit.id,
      countyFips: unit.countyFips,
      sourceVtdGeoid: unit.sourceVtdGeoid,
      name: unit.name,
      harrisVotes: unit.harrisVotes,
      trumpVotes: unit.trumpVotes,
      otherVotes: unit.otherVotes,
      totalVotes: unit.totalVotes,
    })),
};
mkdirSync(dirname(crosswalkOutputPath), { recursive: true });
writeFileSync(crosswalkOutputPath, `${JSON.stringify(crosswalk, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  geometrySource: relative(process.cwd(), archivePath).replaceAll("\\", "/"),
  geometryFeatureCount: totalStats.geometryFeatureCount,
  resultReportingUnitCount: totalStats.resultReportingUnitCount,
  matchedReportingUnitCount: totalStats.matchedReportingUnitCount,
  unmatchedReportingUnitCount: totalStats.unmatchedReportingUnitCount,
  exactIdentifierMatchCount: totalStats.exactIdentifierMatchCount,
  canonicalNameMatchCount: totalStats.canonicalNameMatchCount,
  duplicateGeometryMatchCount: totalStats.duplicateGeometryMatchCount,
  matchedVotes: totalStats.matchedVotes,
  resultVotes: totalStats.resultVotes,
  resultVoteCoveragePct: manifest.totals.resultVoteCoveragePct,
  manifest: relative(process.cwd(), manifestOutputPath).replaceAll("\\", "/"),
  crosswalk: relative(process.cwd(), crosswalkOutputPath).replaceAll("\\", "/"),
}, null, 2));
