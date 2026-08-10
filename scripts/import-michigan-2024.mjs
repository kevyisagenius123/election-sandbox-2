import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const SOURCE_URL = "https://mvic.sos.state.mi.us/votehistory/";
const EXPECTED_ARCHIVE_SHA256 = "64f9285bbe94565ff8685d90fccb283a72f04f849bc3b16873af26e9ae34294a";
const GENERATED_AT = "2026-08-10";
const EXPECTED_TOTALS = {
  harrisVotes: 2_736_533,
  trumpVotes: 2_816_636,
  steinVotes: 44_607,
  oliverVotes: 22_440,
  residualOtherVotes: 43_970,
  otherVotes: 111_017,
  totalVotes: 5_664_186,
};

function usage() {
  throw new Error(
    "Usage: node scripts/import-michigan-2024.mjs <extracted-2024GEN-directory> <official-2024GEN.zip> " +
    "[county-output] [reporting-unit-output] [source-manifest-output]",
  );
}

function tabRows(path) {
  return readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label} is ${actual} but expected ${expected}`);
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

function voteKey(candidateId) {
  if (candidateId === "376696") return "harrisVotes";
  if (candidateId === "439008") return "trumpVotes";
  if (candidateId === "5006") return "steinVotes";
  if (candidateId === "466421") return "oliverVotes";
  return "residualOtherVotes";
}

function addVotes(target, key, votes) {
  target[key] += votes;
  if (["steinVotes", "oliverVotes", "residualOtherVotes"].includes(key)) {
    target.otherVotes += votes;
  }
  target.totalVotes += votes;
}

function addVoteTotals(target, source) {
  for (const key of Object.keys(emptyVotes())) target[key] += source[key];
}

function countyFips(countyCode) {
  return `26${String(Number(countyCode) * 2 - 1).padStart(3, "0")}`;
}

function unitType(localeCode, precinct, label) {
  if (localeCode === "9999") return "other_bucket";
  if (Number(precinct) >= 900 || /AVCB|ABSENT|EARLY/i.test(label)) return "central_count_bucket";
  return "precinct";
}

function unitName(jurisdiction, ward, precinct, label, type) {
  if (type === "other_bucket") return `${jurisdiction ?? "County"} statistical adjustment`;
  if (type === "central_count_bucket") {
    return `${jurisdiction ?? "County"} ${label || `central count ${precinct}`}`.trim();
  }
  const wardText = Number(ward) > 0 ? `, Ward ${Number(ward)}` : "";
  return `${jurisdiction}${wardText}, Precinct ${Number(precinct)}${label}`;
}

const sourceDirectory = resolve(process.argv[2] ?? "");
const archivePath = resolve(process.argv[3] ?? "");
const countyOutputPath = resolve(process.argv[4] ?? "src/data/mi-2024-counties.json");
const reportingUnitOutputPath = resolve(process.argv[5] ?? "public/data/mi/2024/reporting-units.json");
const sourceManifestPath = resolve(
  process.argv[6] ?? "data-sources/michigan/2024-general-presidential.json",
);
if (!process.argv[2] || !process.argv[3]) usage();

const archiveSha256 = sha256(archivePath);
assertEqual("Michigan result archive SHA-256", archiveSha256, EXPECTED_ARCHIVE_SHA256);

const counties = new Map(
  tabRows(resolve(sourceDirectory, "county.txt")).map(([code, name]) => [code, name]),
);
const jurisdictions = new Map(
  tabRows(resolve(sourceDirectory, "2024city.txt"))
    .filter(([year, type]) => year === "2024" && type === "GEN")
    .map(([, , countyCode, localeCode, description]) => [
      `${countyCode}:${localeCode}`,
      description,
    ]),
);
const candidates = new Map(
  tabRows(resolve(sourceDirectory, "2024name.txt"))
    .filter(([year, type, office, district, status]) => (
      year === "2024" && type === "GEN" && office === "1" && district === "00000" && status === "0"
    ))
    .map(([, , , , , id, last, first, middle, partyCode]) => [id, {
      id,
      name: [first, middle, last].filter(Boolean).join(" ").replace(/\s+/g, " "),
      partyCode: partyCode || null,
      bucket: voteKey(id).replace(/Votes$/, ""),
      votes: 0,
    }]),
);

const countyMap = new Map();
const reportingUnitMap = new Map();
const statewideStatisticalAdjustment = emptyVotes();
const statisticalAdjustmentsByCounty = new Map();
let presidentialLineCount = 0;

for (const fields of tabRows(resolve(sourceDirectory, "2024vote.txt"))) {
  const [year, type, office, district, status, candidateId, countyCode, localeCode,
    ward, precinct, label, voteText] = fields;
  if (year !== "2024" || type !== "GEN" || office !== "1" || district !== "00000" || status !== "0") continue;
  presidentialLineCount += 1;
  const votes = Number(voteText);
  const countyName = counties.get(countyCode);
  const jurisdiction = jurisdictions.get(`${countyCode}:${localeCode}`) ?? null;
  if (!countyName || !Number.isSafeInteger(votes) || (votes < 0 && localeCode !== "9999") || !candidates.has(candidateId)) {
    throw new Error(`Invalid Michigan presidential row ${presidentialLineCount}`);
  }

  const key = voteKey(candidateId);
  const candidate = candidates.get(candidateId);
  candidate.votes += votes;
  const fips = countyFips(countyCode);
  const county = countyMap.get(fips) ?? {
    fips,
    code: Number(countyCode),
    name: `${countyName[0]}${countyName.slice(1).toLowerCase()} County`,
    ...emptyVotes(),
    reportingUnitCount: 0,
    geographicReportingUnitCount: 0,
    centralCountUnitCount: 0,
    statisticalAdjustmentUnitCount: 0,
  };
  addVotes(county, key, votes);
  countyMap.set(fips, county);

  if (localeCode === "9999") {
    addVotes(statewideStatisticalAdjustment, key, votes);
    const countyAdjustment = statisticalAdjustmentsByCounty.get(fips) ?? emptyVotes();
    addVotes(countyAdjustment, key, votes);
    statisticalAdjustmentsByCounty.set(fips, countyAdjustment);
    continue;
  }

  const typeName = unitType(localeCode, precinct, label);
  const sourceKey = [countyCode, localeCode, ward, precinct, label].join(":");
  const id = `mi-${fips}-${String(localeCode).padStart(4, "0")}-${String(ward).padStart(2, "0")}-${String(precinct).padStart(3, "0")}${label || ""}`;
  const unit = reportingUnitMap.get(sourceKey) ?? {
    id,
    countyFips: fips,
    sourceKey,
    sourceCountyCode: countyCode,
    sourceLocaleCode: localeCode,
    sourceWard: ward,
    sourcePrecinct: precinct,
    sourcePrecinctLabel: label,
    jurisdiction,
    name: unitName(jurisdiction, ward, precinct, label, typeName),
    type: typeName,
    geometryId: null,
    geometryQuality: "none",
    resultQuality: "official",
    ballotMode: typeName === "central_count_bucket" ? "central_count" : null,
    ...emptyVotes(),
  };
  addVotes(unit, key, votes);
  reportingUnitMap.set(sourceKey, unit);
}

assertEqual("Michigan county count", countyMap.size, 83);
assertEqual("Michigan presidential candidate-row count", presidentialLineCount, 43_853);

for (const [key, value] of Object.entries(statewideStatisticalAdjustment)) {
  if (value < 0) throw new Error(`Michigan statewide statistical adjustment ${key} is negative`);
}
reportingUnitMap.set("statewide-statistical-adjustment", {
  id: "mi-26-statewide-statistical-adjustment",
  countyFips: null,
  sourceKey: "statewide-statistical-adjustment",
  sourceCountyCode: null,
  sourceLocaleCode: "9999",
  sourceWard: null,
  sourcePrecinct: null,
  sourcePrecinctLabel: null,
  jurisdiction: null,
  name: "Statewide statistical adjustment",
  type: "other_bucket",
  geometryId: null,
  geometryQuality: "none",
  resultQuality: "normalized",
  ballotMode: null,
  ...statewideStatisticalAdjustment,
});

assertEqual("Michigan normalized reporting unit count", reportingUnitMap.size, 4_413);

const reportingUnits = [...reportingUnitMap.values()].sort((a, b) => a.id.localeCompare(b.id));
for (const unit of reportingUnits) {
  if (!unit.countyFips) continue;
  const county = countyMap.get(unit.countyFips);
  county.reportingUnitCount += 1;
  if (unit.type === "precinct") county.geographicReportingUnitCount += 1;
  else if (unit.type === "central_count_bucket") county.centralCountUnitCount += 1;
  else county.statisticalAdjustmentUnitCount += 1;
}

const stateTotals = [...countyMap.values()].reduce((total, county) => {
  addVoteTotals(total, county);
  return total;
}, emptyVotes());
for (const [key, expected] of Object.entries(EXPECTED_TOTALS)) {
  assertEqual(`Michigan ${key}`, stateTotals[key], expected);
}

const candidateList = [...candidates.values()].sort((a, b) => b.votes - a.votes || a.id.localeCompare(b.id));
assertEqual("Michigan candidate total", candidateList.reduce((sum, candidate) => sum + candidate.votes, 0), stateTotals.totalVotes);
const countyList = [...countyMap.values()].sort((a, b) => a.fips.localeCompare(b.fips));
const resultFiles = ["2024city.txt", "2024name.txt", "2024offc.txt", "2024vote.txt", "county.txt", "readme.txt"];
const source = {
  id: "mi-boe-2024-general-precinct-results",
  publisher: "Michigan Department of State, Bureau of Elections",
  title: "2024 Michigan Precinct-Level General Election Results",
  sourceUrl: SOURCE_URL,
  retrievedAt: GENERATED_AT,
  checksumSha256: archiveSha256,
  licenseStatus: "review_required",
  limitations: [
    "Precinct numbers at or above 900 and AVCB-labeled units are non-geographic central-count buckets.",
    "The 22 locale-code 9999 units contain negative candidate corrections and are normalized into one explicit statewide statistical-adjustment bucket whose net candidate values remain non-negative.",
    "No non-geographic unit is assigned to a precinct polygon.",
  ],
};
const countyDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "MI",
  stateFips: "26",
  generatedAt: GENERATED_AT,
  sources: [source],
  totals: stateTotals,
  unassignedStatewideVotes: 0,
  candidates: candidateList,
  counties: countyList,
};
const reportingUnitDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "MI",
  stateFips: "26",
  generatedAt: GENERATED_AT,
  sourceIds: [source.id],
  totals: stateTotals,
  unassignedStatewideVotes: 0,
  reportingUnits,
};
const sourceManifest = {
  id: "mi-2024-presidential-source-package",
  sources: [source],
  pipelineVersion: "mi-2024-import-v1",
  sourceFiles: Object.fromEntries(resultFiles.map((name) => [name, sha256(resolve(sourceDirectory, name))])),
  presidentialLineCount,
  candidateCount: candidateList.length,
  countyCount: countyList.length,
  reportingUnitCount: reportingUnits.length,
  sourceReportingUnitCount: 4_434,
  geographicReportingUnitCount: reportingUnits.filter((unit) => unit.type === "precinct").length,
  centralCountUnitCount: reportingUnits.filter((unit) => unit.type === "central_count_bucket").length,
  sourceStatisticalAdjustmentUnitCount: 22,
  normalizedStatisticalAdjustmentUnitCount: 1,
  statewideStatisticalAdjustment,
  statisticalAdjustmentsByCounty: Object.fromEntries([...statisticalAdjustmentsByCounty].sort()),
  stateTotals,
  outputs: [countyOutputPath, reportingUnitOutputPath]
    .map((path) => relative(process.cwd(), path).replaceAll("\\", "/")),
};

for (const [path, document, indentation] of [
  [countyOutputPath, countyDocument, 2],
  [reportingUnitOutputPath, reportingUnitDocument, 0],
  [sourceManifestPath, sourceManifest, 2],
]) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(document, null, indentation)}\n`, "utf8");
}

console.log(JSON.stringify({
  archiveSha256,
  presidentialLineCount,
  candidateCount: candidateList.length,
  countyCount: countyList.length,
  reportingUnitCount: reportingUnits.length,
  stateTotals,
  candidates: candidateList,
}, null, 2));
