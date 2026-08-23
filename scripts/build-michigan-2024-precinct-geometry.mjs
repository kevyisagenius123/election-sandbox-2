import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { geoAlbersUsa } from "d3-geo";
import { feature as topologyFeature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { topology } from "topojson-server";

const GEOMETRY_SOURCE_URL = "https://gisagocss.state.mi.us/arcgis/rest/services/OpenData/boundaries/MapServer/9";
const GEOMETRY_METADATA_URL = "https://www.arcgis.com/sharing/rest/content/items/02d40893317d46569017beeb14f9c63e/info/metadata/metadata.xml?format=default&output=html";
const EXPECTED_GEOMETRY_SHA256 = "bbc331967ac5e2e1293e581bcdd9c0fa7c5c556faa1b6caaa5d984720be90c4b";
const GENERATED_AT = "2026-08-10";
const QUANTIZATION = 50_000;
const SIMPLIFICATION_QUANTILE = 0.18;

const geometryJurisdictionOverrides = new Map([
  ["WP-099-50480-00023", "MACOMB TOWNSHIP"],
  ["WP-161-50660-00001", "MANCHESTER CITY"],
  ["WP-161-53920-00001W", "MILAN CITY"],
]);

function usage() {
  throw new Error(
    "Usage: node scripts/build-michigan-2024-precinct-geometry.mjs " +
    "<reporting-units.json> <official-2024-precincts.geojson> " +
    "[public-output-root] [crosswalk-output]",
  );
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} is ${actual} but expected ${expected}`);
}

function emptyVotes() {
  return { harrisVotes: 0, trumpVotes: 0, otherVotes: 0, totalVotes: 0 };
}

function addVotes(target, source) {
  target.harrisVotes += source.harrisVotes;
  target.trumpVotes += source.trumpVotes;
  target.otherVotes += source.otherVotes;
  target.totalVotes += source.totalVotes;
}

function percentage(numerator, denominator) {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(4));
}

function rewriteJurisdictionPrefix(text, prefix, resultPrefix, resultSuffix) {
  if (!text.startsWith(prefix)) return null;
  const separator = text[prefix.length];
  if (separator == null || separator.trim() !== "") return null;
  const name = text.slice(prefix.length).trim();
  return name ? `${resultPrefix}${name}${resultSuffix}` : null;
}

function normalizeJurisdiction(value) {
  let text = String(value ?? "").toUpperCase().replace(/[’']/g, "").trim();
  text = rewriteJurisdictionPrefix(text, "CITY OF THE VILLAGE OF", "VILLAGE OF ", " CITY")
    ?? rewriteJurisdictionPrefix(text, "CITY OF", "", " CITY")
    ?? rewriteJurisdictionPrefix(text, "CHARTER TOWNSHIP OF", "", " TOWNSHIP")
    ?? rewriteJurisdictionPrefix(text, "TOWNSHIP OF", "", " TOWNSHIP")
    ?? text;
  text = text.replace(/\bCHARTER TWP\b/g, "TOWNSHIP");
  text = text.replace(/\bCHARTER TOWNSHIP\b/g, "TOWNSHIP");
  return text.replace(/[^A-Z0-9]+/g, " ").trim();
}

function normalizePrecinct(precinct, label = "") {
  const text = String(precinct).trim().toUpperCase();
  const normalizedLabel = String(label).trim().toUpperCase();
  let digitEnd = 0;
  while (digitEnd < text.length && text[digitEnd] >= "0" && text[digitEnd] <= "9") {
    digitEnd += 1;
  }
  if (digitEnd === 0) return `${text}${normalizedLabel}`;
  return `${Number(text.slice(0, digitEnd))}${text.slice(digitEnd)}${normalizedLabel}`;
}

function geometryJurisdiction(properties) {
  const override = geometryJurisdictionOverrides.get(properties.PRECINCTID);
  if (override) return override;
  const longName = String(properties.Precinct_Long_Name ?? "");
  const michiganCity = longName.match(/^Village of (.+?), A Michigan City,/i);
  if (michiganCity) return `City of ${michiganCity[1]}`;
  return longName ? longName.split(",")[0] : properties.Jurisdiction_Name;
}

function geometryPrecinct(properties) {
  const idPart = String(properties.PRECINCTID ?? "").split("-").at(-1) ?? "";
  const match = idPart.match(/^\d{2}(\d{3}[A-Z]*)$/i);
  return match ? match[1] : properties.PRECINCT;
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
    exactOfficialWardKeyCount: 0,
    uniqueOfficialPrecinctKeyCount: 0,
    geometryFeatureCount: 0,
    matchedGeometryFeatureCount: 0,
    unmatchedGeometryFeatureCount: 0,
    resultVotes: emptyVotes(),
    matchedVotes: emptyVotes(),
  };
}

const reportingUnitPath = resolve(process.argv[2] ?? "");
const geometryPath = resolve(process.argv[3] ?? "");
const publicOutputRoot = resolve(process.argv[4] ?? "public/data/mi/2024");
const crosswalkOutputPath = resolve(
  process.argv[5] ?? "data-sources/michigan/2024-precinct-crosswalk.json",
);
if (!process.argv[2] || !process.argv[3]) usage();

const geometrySha256 = sha256(geometryPath);
assertEqual("Michigan 2024 precinct geometry SHA-256", geometrySha256, EXPECTED_GEOMETRY_SHA256);
const reportingDocument = JSON.parse(readFileSync(reportingUnitPath, "utf8"));
const sourceUnits = reportingDocument.reportingUnits.filter((unit) => unit.type === "precinct");
assertEqual("Michigan geographic result unit count", sourceUnits.length, 4_347);
const sourceGeometry = JSON.parse(readFileSync(geometryPath, "utf8")).features;
assertEqual("Michigan 2024 precinct geometry feature count", sourceGeometry.length, 4_340);

const geometryByKey = new Map();
const geometryByWardKey = new Map();
for (const feature of sourceGeometry) {
  const properties = feature.properties;
  const countyFips = `26${String(properties.COUNTYFIPS).padStart(3, "0")}`;
  const jurisdiction = normalizeJurisdiction(geometryJurisdiction(properties));
  const precinct = normalizePrecinct(geometryPrecinct(properties));
  const key = `${countyFips}:${jurisdiction}:${precinct}`;
  const matches = geometryByKey.get(key) ?? [];
  matches.push(feature);
  geometryByKey.set(key, matches);
  const wardKey = `${countyFips}:${jurisdiction}:${Number(properties.WARD)}:${precinct}`;
  const wardMatches = geometryByWardKey.get(wardKey) ?? [];
  wardMatches.push(feature);
  geometryByWardKey.set(wardKey, wardMatches);
}

const sourceUnitsByGeometry = new Map();
const matchMethodByUnit = new Map();
for (const unit of sourceUnits) {
  const jurisdiction = normalizeJurisdiction(unit.jurisdiction);
  const precinct = normalizePrecinct(unit.sourcePrecinct, unit.sourcePrecinctLabel);
  const key = `${unit.countyFips}:${jurisdiction}:${precinct}`;
  const wardKey = `${unit.countyFips}:${jurisdiction}:${Number(unit.sourceWard)}:${precinct}`;
  const wardCandidates = geometryByWardKey.get(wardKey) ?? [];
  const looseCandidates = geometryByKey.get(key) ?? [];
  const candidates = wardCandidates.length === 1 ? wardCandidates : looseCandidates;
  if (candidates.length !== 1) continue;
  const geometryId = candidates[0].properties.PRECINCTID;
  const matchMethod = wardCandidates.length === 1
    ? "exact_official_ward_key"
    : "unique_official_precinct_key";
  unit.geometryId = geometryId;
  unit.geometryQuality = matchMethod === "exact_official_ward_key" ? "official" : "normalized";
  const units = sourceUnitsByGeometry.get(geometryId) ?? [];
  units.push(unit);
  sourceUnitsByGeometry.set(geometryId, units);
  matchMethodByUnit.set(unit.id, matchMethod);
}

const statsByCounty = new Map();
for (const unit of sourceUnits) {
  const stats = statsByCounty.get(unit.countyFips) ?? countyStats(unit.countyFips);
  stats.resultReportingUnitCount += 1;
  addVotes(stats.resultVotes, unit);
  statsByCounty.set(unit.countyFips, stats);
}

const projection = geoAlbersUsa().scale(1300).translate([487.5, 305]);
const featuresByCounty = new Map();
for (const sourceFeature of sourceGeometry) {
  const properties = sourceFeature.properties;
  const geometryId = properties.PRECINCTID;
  const countyFips = `26${String(properties.COUNTYFIPS).padStart(3, "0")}`;
  const matchedUnits = sourceUnitsByGeometry.get(geometryId) ?? [];
  const votes = matchedUnits.reduce((total, unit) => {
    addVotes(total, unit);
    return total;
  }, emptyVotes());
  const stats = statsByCounty.get(countyFips) ?? countyStats(countyFips);
  stats.geometryFeatureCount += 1;
  if (matchedUnits.length) {
    stats.matchedGeometryFeatureCount += 1;
    stats.matchedReportingUnitCount += matchedUnits.length;
    stats.exactOfficialWardKeyCount += matchedUnits.filter(
      (unit) => matchMethodByUnit.get(unit.id) === "exact_official_ward_key",
    ).length;
    stats.uniqueOfficialPrecinctKeyCount += matchedUnits.filter(
      (unit) => matchMethodByUnit.get(unit.id) === "unique_official_precinct_key",
    ).length;
    addVotes(stats.matchedVotes, votes);
  } else {
    stats.unmatchedGeometryFeatureCount += 1;
  }
  statsByCounty.set(countyFips, stats);

  const feature = {
    type: "Feature",
    id: geometryId,
    properties: {
      geoid: geometryId,
      countyFips,
      precinctCode: normalizePrecinct(geometryPrecinct(properties)),
      censusVtdCode: properties.VTDST || null,
      precinctName: properties.Precinct_Long_Name || properties.NAME || geometryId,
      jurisdictionName: properties.Jurisdiction_Name || null,
      sourceName: matchedUnits[0]?.name ?? null,
      sourceUnitCount: matchedUnits.length,
      resultQuality: matchedUnits.length === 0
        ? "unmatched_geometry"
        : matchedUnits.some((unit) => matchMethodByUnit.get(unit.id) === "unique_official_precinct_key")
          ? "official_unique_precinct_key"
          : "official_exact_ward_key",
      ...votes,
    },
    geometry: projectGeometry(sourceFeature.geometry, projection),
  };
  const countyFeatures = featuresByCounty.get(countyFips) ?? [];
  countyFeatures.push(feature);
  featuresByCounty.set(countyFips, countyFeatures);
}

const unmatchedUnits = sourceUnits.filter((unit) => !matchMethodByUnit.has(unit.id));
for (const unit of unmatchedUnits) {
  statsByCounty.get(unit.countyFips).unmatchedReportingUnitCount += 1;
}

const precinctOutputRoot = resolve(publicOutputRoot, "precincts");
mkdirSync(precinctOutputRoot, { recursive: true });
const countyManifest = [];
for (const [countyFips, features] of [...featuresByCounty].sort(([a], [b]) => a.localeCompare(b))) {
  features.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const rawTopology = topology({ precincts: { type: "FeatureCollection", features } }, QUANTIZATION);
  const weightedTopology = presimplify(rawTopology);
  const simplifiedTopology = simplify(weightedTopology, quantile(weightedTopology, SIMPLIFICATION_QUANTILE));
  const outputPath = resolve(precinctOutputRoot, `${countyFips}.topo.json`);
  writeFileSync(outputPath, JSON.stringify(simplifiedTopology), "utf8");
  const simplifiedFeatures = topologyFeature(simplifiedTopology, simplifiedTopology.objects.precincts).features;
  const stats = statsByCounty.get(countyFips);
  countyManifest.push({
    ...stats,
    resultVoteCoveragePct: percentage(stats.matchedVotes.totalVotes, stats.resultVotes.totalVotes),
    bounds: geometryBounds(simplifiedFeatures),
    dataUrl: `./data/mi/2024/precincts/${basename(outputPath)}`,
    byteSize: readFileSync(outputPath).byteLength,
  });
}

const totalStats = countyManifest.reduce((total, county) => {
  for (const key of [
    "resultReportingUnitCount", "matchedReportingUnitCount", "unmatchedReportingUnitCount",
    "exactOfficialWardKeyCount", "uniqueOfficialPrecinctKeyCount", "geometryFeatureCount",
    "matchedGeometryFeatureCount", "unmatchedGeometryFeatureCount",
  ]) total[key] += county[key];
  addVotes(total.resultVotes, county.resultVotes);
  addVotes(total.matchedVotes, county.matchedVotes);
  return total;
}, { ...countyStats("26"), countyFips: undefined });

const geometrySource = {
  id: "mi-gis-2024-voting-precincts",
  publisher: "State of Michigan, Bureau of Elections",
  title: "2024 Voting Precincts",
  sourceUrl: GEOMETRY_SOURCE_URL,
  metadataUrl: GEOMETRY_METADATA_URL,
  vintage: "2024-11-05",
  retrievedAt: GENERATED_AT,
  checksumSha256: geometrySha256,
  licenseStatus: "verified",
  limitations: [
    "Three documented jurisdiction-name defects are corrected by stable PRECINCTID.",
    "The stable PRECINCTID supplies the precinct suffix where several display attributes are inconsistent.",
    "Eight result units, totaling 114 votes, have no unique polygon and remain explicitly unpainted.",
    "Central-count units and the statewide statistical-adjustment bucket are never assigned to precinct polygons.",
  ],
};
const statewideMatchedVotes = totalStats.matchedVotes.totalVotes;
const manifest = {
  schemaVersion: 1,
  electionId: reportingDocument.electionId,
  stateCode: "MI",
  stateFips: "26",
  generatedAt: GENERATED_AT,
  geometrySource,
  projection: "geoAlbersUsa().scale(1300).translate([487.5, 305]), then OrbitView Y-axis inversion",
  quantization: QUANTIZATION,
  simplificationQuantile: SIMPLIFICATION_QUANTILE,
  totals: {
    ...totalStats,
    resultVoteCoveragePct: percentage(totalStats.matchedVotes.totalVotes, totalStats.resultVotes.totalVotes),
    statewideVoteCoveragePct: percentage(statewideMatchedVotes, reportingDocument.totals.totalVotes),
  },
  counties: countyManifest,
};
const manifestOutputPath = resolve(publicOutputRoot, "precinct-geometry-manifest.json");
mkdirSync(dirname(manifestOutputPath), { recursive: true });
writeFileSync(manifestOutputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

reportingDocument.geometry = {
  sourceId: geometrySource.id,
  matchedReportingUnitCount: totalStats.matchedReportingUnitCount,
  unmatchedReportingUnitCount: totalStats.unmatchedReportingUnitCount,
  matchedVotes: totalStats.matchedVotes,
  geographicResultVotes: totalStats.resultVotes,
  statewideVoteCoveragePct: manifest.totals.statewideVoteCoveragePct,
};
writeFileSync(reportingUnitPath, `${JSON.stringify(reportingDocument)}\n`, "utf8");

const crosswalk = {
  schemaVersion: 1,
  electionId: reportingDocument.electionId,
  generatedAt: GENERATED_AT,
  geometrySource,
  matchMethods: [
    "exact normalized county + official jurisdiction + ward + precinct key",
    "unique normalized county + official jurisdiction + precinct key when the geometry ward attribute is defective",
    "three reviewed PRECINCTID jurisdiction corrections listed in this artifact",
  ],
  reviewedGeometryJurisdictionOverrides: Object.fromEntries(geometryJurisdictionOverrides),
  totals: manifest.totals,
  matchedGeometry: [...sourceUnitsByGeometry]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([geometryId, units]) => ({
      geometryId,
      reportingUnits: units.map((unit) => ({
        reportingUnitId: unit.id,
        matchMethod: matchMethodByUnit.get(unit.id),
      })),
    })),
  unmatchedReportingUnits: unmatchedUnits
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((unit) => ({
      reportingUnitId: unit.id,
      countyFips: unit.countyFips,
      name: unit.name,
      harrisVotes: unit.harrisVotes,
      trumpVotes: unit.trumpVotes,
      otherVotes: unit.otherVotes,
      totalVotes: unit.totalVotes,
    })),
  unmatchedGeometryIds: sourceGeometry
    .filter((feature) => !sourceUnitsByGeometry.has(feature.properties.PRECINCTID))
    .map((feature) => feature.properties.PRECINCTID)
    .sort(),
};
mkdirSync(dirname(crosswalkOutputPath), { recursive: true });
writeFileSync(crosswalkOutputPath, `${JSON.stringify(crosswalk, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  geometry: relative(process.cwd(), geometryPath).replaceAll("\\", "/"),
  geometryFeatureCount: totalStats.geometryFeatureCount,
  matchedGeometryFeatureCount: totalStats.matchedGeometryFeatureCount,
  unmatchedGeometryFeatureCount: totalStats.unmatchedGeometryFeatureCount,
  resultReportingUnitCount: totalStats.resultReportingUnitCount,
  matchedReportingUnitCount: totalStats.matchedReportingUnitCount,
  unmatchedReportingUnitCount: totalStats.unmatchedReportingUnitCount,
  exactOfficialWardKeyCount: totalStats.exactOfficialWardKeyCount,
  uniqueOfficialPrecinctKeyCount: totalStats.uniqueOfficialPrecinctKeyCount,
  matchedVotes: totalStats.matchedVotes,
  geographicResultVotes: totalStats.resultVotes,
  geographicVoteCoveragePct: manifest.totals.resultVoteCoveragePct,
  statewideVoteCoveragePct: manifest.totals.statewideVoteCoveragePct,
  manifest: relative(process.cwd(), manifestOutputPath).replaceAll("\\", "/"),
  crosswalk: relative(process.cwd(), crosswalkOutputPath).replaceAll("\\", "/"),
}, null, 2));
