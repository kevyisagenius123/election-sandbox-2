import { createReadStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

const SOURCE_URL = "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt";
const EXPECTED_SOURCE_SHA256 = "34339122238fe82272c52717a4065dbd3949e00eeb98320332797853c96f3b6c";
const COUNTY_SUMMARY_URL = "https://www.electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak?officeId=1&districtId=1&methodName=GetCountyBreak&electionid=105&electiontype=G&isactive=0";
const EXPECTED_COUNTY_SUMMARY_SHA256 = "c73094edb1b46312f89facc68c561b26286caa158819fe775c00f3487942c7cc";
const EXPECTED_STATE_TOTALS = {
  harrisVotes: 3_423_042,
  trumpVotes: 3_543_308,
  steinVotes: 34_538,
  oliverVotes: 33_318,
  residualOtherVotes: 24_526,
  otherVotes: 92_382,
  totalVotes: 7_058_732,
};

const COUNTY_NAMES = [
  "Adams", "Allegheny", "Armstrong", "Beaver", "Bedford", "Berks", "Blair",
  "Bradford", "Bucks", "Butler", "Cambria", "Cameron", "Carbon", "Centre",
  "Chester", "Clarion", "Clearfield", "Clinton", "Columbia", "Crawford",
  "Cumberland", "Dauphin", "Delaware", "Elk", "Erie", "Fayette", "Forest",
  "Franklin", "Fulton", "Greene", "Huntingdon", "Indiana", "Jefferson",
  "Juniata", "Lackawanna", "Lancaster", "Lawrence", "Lebanon", "Lehigh",
  "Luzerne", "Lycoming", "McKean", "Mercer", "Mifflin", "Monroe",
  "Montgomery", "Montour", "Northampton", "Northumberland", "Perry",
  "Philadelphia", "Pike", "Potter", "Schuylkill", "Snyder", "Somerset",
  "Sullivan", "Susquehanna", "Tioga", "Union", "Venango", "Warren",
  "Washington", "Wayne", "Westmoreland", "Wyoming", "York",
];

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function countyFips(countyCode) {
  return `42${String(countyCode * 2 - 1).padStart(3, "0")}`;
}

function candidateName(fields) {
  return [fields[12], fields[13], fields[11], fields[14]]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

function candidateBucket(_partyCode, lastName) {
  if (lastName === "HARRIS") return "harris";
  if (lastName === "TRUMP") return "trump";
  return "other";
}

function candidateVoteKey(lastName) {
  if (lastName === "HARRIS") return "harrisVotes";
  if (lastName === "TRUMP") return "trumpVotes";
  if (lastName === "STEIN") return "steinVotes";
  if (lastName === "OLIVER") return "oliverVotes";
  return "residualOtherVotes";
}

function addVotes(target, voteKey, votes) {
  target[voteKey] += votes;
  if (["steinVotes", "oliverVotes", "residualOtherVotes"].includes(voteKey)) {
    target.otherVotes += votes;
  }
  target.totalVotes += votes;
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} is ${actual.toLocaleString()} but expected ${expected.toLocaleString()}`);
  }
}

const sourcePath = resolve(process.argv[2] ?? "");
const countySummaryPath = resolve(process.argv[3] ?? "");
const countyOutputPath = resolve(process.argv[4] ?? "src/data/pa-2024-counties.json");
const reportingUnitOutputPath = resolve(process.argv[5] ?? "public/data/pa/2024/reporting-units.json");
const sourceManifestPath = resolve(process.argv[6] ?? "data-sources/pennsylvania/2024-general-presidential.json");

if (!process.argv[2] || !process.argv[3]) {
  throw new Error("Usage: node scripts/import-pennsylvania-2024.mjs <official-precinct-file> <official-county-summary-file> [county-output] [reporting-unit-output] [manifest-output]");
}

const hash = createHash("sha256");
const countyMap = new Map();
const reportingUnitMap = new Map();
const candidateMap = new Map();
let sourceLineCount = 0;
let presidentialLineCount = 0;

const sourceStream = createReadStream(sourcePath);
sourceStream.on("data", (chunk) => hash.update(chunk));
const lines = createInterface({ input: sourceStream, crlfDelay: Infinity });

for await (const line of lines) {
  sourceLineCount += 1;
  const fields = parseCsvLine(line);
  if (fields[8] !== "USP") continue;
  presidentialLineCount += 1;

  const countyCode = Number(fields[2]);
  const precinctCode = String(fields[3]).padStart(7, "0");
  const votes = Number(fields[15]);
  const partyCode = fields[9].trim();
  const lastName = fields[11].trim();
  const candidateNumber = fields[10].trim();
  const bucket = candidateBucket(partyCode, lastName);
  const voteKey = candidateVoteKey(lastName);
  const fips = countyFips(countyCode);
  const countyName = COUNTY_NAMES[countyCode - 1];
  const sourceMcdCode = fields[28].trim() || null;
  const sourceCountyFipsCode = fields[29].trim().padStart(3, "0") || null;
  const sourceVtdCode = fields[30].trim().padStart(6, "0") || null;

  if (!countyName || !Number.isSafeInteger(votes) || votes < 0) {
    throw new Error(`Invalid presidential record on source line ${sourceLineCount}`);
  }
  if (sourceCountyFipsCode !== fips.slice(2)) {
    throw new Error(`County FIPS mismatch on source line ${sourceLineCount}`);
  }

  const candidateKey = `${candidateNumber}:${partyCode}:${lastName}`;
  const candidate = candidateMap.get(candidateKey) ?? {
    id: candidateKey.toLowerCase(),
    sourceCandidateNumber: candidateNumber,
    name: candidateName(fields),
    partyCode: partyCode || null,
    bucket,
    votes: 0,
  };
  candidate.votes += votes;
  candidateMap.set(candidateKey, candidate);

  const county = countyMap.get(fips) ?? {
    fips,
    code: countyCode,
    name: `${countyName} County`,
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
    reportingUnitCount: 0,
  };
  addVotes(county, voteKey, votes);
  countyMap.set(fips, county);

  const reportingUnitId = `pa-${fips}-${precinctCode}`;
  const reportingUnit = reportingUnitMap.get(reportingUnitId) ?? {
    id: reportingUnitId,
    countyFips: fips,
    sourcePrecinctCode: precinctCode,
    sourceMcdCode,
    sourceCountyFipsCode,
    sourceVtdCode,
    sourceVtdGeoid: `42${sourceCountyFipsCode}${sourceVtdCode}`,
    name: [fields[22], fields[24], fields[26]].map((part) => part.trim()).filter(Boolean).join(" / ") || `Precinct ${precinctCode}`,
    type: "precinct",
    municipalityTypeCode: fields[21] || null,
    municipalityName: fields[22].trim() || null,
    breakdownCode1: fields[23].trim() || null,
    breakdownName1: fields[24].trim() || null,
    breakdownCode2: fields[25].trim() || null,
    breakdownName2: fields[26].trim() || null,
    geometryId: null,
    geometryQuality: "none",
    resultQuality: "official",
    ballotMode: null,
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
  };
  addVotes(reportingUnit, voteKey, votes);
  reportingUnitMap.set(reportingUnitId, reportingUnit);
}

const sourceSha256 = hash.digest("hex");
assertEqual("Source SHA-256 match", Number(sourceSha256 === EXPECTED_SOURCE_SHA256), 1);
assertEqual("Pennsylvania county count", countyMap.size, 67);
const sourceReportingUnitCount = reportingUnitMap.size;

const countySummaryRaw = readFileSync(countySummaryPath);
const countySummarySha256 = createHash("sha256").update(countySummaryRaw).digest("hex");
assertEqual("County summary SHA-256 match", Number(countySummarySha256 === EXPECTED_COUNTY_SUMMARY_SHA256), 1);
const countySummaryOuter = JSON.parse(countySummaryRaw.toString("utf8"));
const countySummary = typeof countySummaryOuter === "string" ? JSON.parse(countySummaryOuter) : countySummaryOuter;
const countySummaryRows = countySummary?.Election?.Statewide?.[0];
if (!countySummaryRows || typeof countySummaryRows !== "object") {
  throw new Error("The official county summary response has an unexpected shape");
}

const summaryCandidateMap = new Map();
const summaryCountyMap = new Map();
for (const [sourceCountyName, rows] of Object.entries(countySummaryRows)) {
  const countyIndex = COUNTY_NAMES.findIndex((name) => name.toUpperCase() === sourceCountyName.toUpperCase());
  if (countyIndex < 0 || !Array.isArray(rows)) throw new Error(`Unknown county summary key: ${sourceCountyName}`);
  const countyCode = countyIndex + 1;
  const fips = countyFips(countyCode);
  const county = {
    fips,
    code: countyCode,
    name: `${COUNTY_NAMES[countyIndex]} County`,
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
    electionDayVotes: 0,
    mailVotes: 0,
    provisionalVotes: 0,
    reportingUnitCount: 0,
    residualVotes: 0,
  };

  for (const row of rows) {
    const votes = Number(row.Votes);
    const electionDayVotes = Number(row.ElectionDayVotes);
    const mailVotes = Number(row.MailInVotes);
    const provisionalVotes = Number(row.ProvisionalVotes);
    const partyCode = String(row.PartyName ?? "").trim();
    const lastName = String(row.CandidateName ?? "").trim().split(/\s+/).at(-1) ?? "";
    const bucket = candidateBucket(partyCode, lastName);
    const voteKey = candidateVoteKey(lastName);
    if (![votes, electionDayVotes, mailVotes, provisionalVotes].every(Number.isSafeInteger)) {
      throw new Error(`Invalid county summary record for ${sourceCountyName}`);
    }
    assertEqual(`${sourceCountyName} ${row.CandidateName} ballot modes`, electionDayVotes + mailVotes + provisionalVotes, votes);
    addVotes(county, voteKey, votes);
    county.electionDayVotes += electionDayVotes;
    county.mailVotes += mailVotes;
    county.provisionalVotes += provisionalVotes;

    const candidateKey = `${partyCode}:${row.CandidateName}`;
    const candidate = summaryCandidateMap.get(candidateKey) ?? {
      id: candidateKey.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
      name: String(row.CandidateName),
      partyCode: partyCode || null,
      bucket,
      votes: 0,
    };
    candidate.votes += votes;
    summaryCandidateMap.set(candidateKey, candidate);
  }
  assertEqual(`${sourceCountyName} ballot modes`, county.electionDayVotes + county.mailVotes + county.provisionalVotes, county.totalVotes);
  summaryCountyMap.set(fips, county);
}
assertEqual("Official county summary count", summaryCountyMap.size, 67);

let countyResidualBucketCount = 0;
for (const [fips, officialCounty] of summaryCountyMap) {
  const precinctCounty = countyMap.get(fips);
  if (!precinctCounty) throw new Error(`No precinct records found for ${officialCounty.name}`);
  const residual = {
    harrisVotes: officialCounty.harrisVotes - precinctCounty.harrisVotes,
    trumpVotes: officialCounty.trumpVotes - precinctCounty.trumpVotes,
    steinVotes: officialCounty.steinVotes - precinctCounty.steinVotes,
    oliverVotes: officialCounty.oliverVotes - precinctCounty.oliverVotes,
    residualOtherVotes:
      officialCounty.residualOtherVotes - precinctCounty.residualOtherVotes,
    otherVotes: officialCounty.otherVotes - precinctCounty.otherVotes,
  };
  if (Object.values(residual).some((value) => value < 0)) {
    throw new Error(`Precinct returns exceed the official county summary for ${officialCounty.name}`);
  }
  const residualTotal = residual.harrisVotes + residual.trumpVotes + residual.otherVotes;
  officialCounty.residualVotes = residualTotal;
  if (residualTotal > 0) {
    countyResidualBucketCount += 1;
    reportingUnitMap.set(`pa-${fips}-county-residual`, {
      id: `pa-${fips}-county-residual`,
      countyFips: fips,
      sourcePrecinctCode: null,
      sourceMcdCode: null,
      sourceCountyFipsCode: fips.slice(2),
      sourceVtdCode: null,
      sourceVtdGeoid: null,
      name: "County return reconciliation bucket",
      type: "other_bucket",
      municipalityTypeCode: null,
      municipalityName: null,
      breakdownCode1: null,
      breakdownName1: null,
      breakdownCode2: null,
      breakdownName2: null,
      geometryId: null,
      geometryQuality: "none",
      resultQuality: "normalized",
      ballotMode: null,
      ...residual,
      totalVotes: residualTotal,
    });
  }
}

const counties = [...summaryCountyMap.values()].sort((a, b) => a.fips.localeCompare(b.fips));
const mappedCountyTotals = counties.reduce((totals, county) => {
  totals.harrisVotes += county.harrisVotes;
  totals.trumpVotes += county.trumpVotes;
  totals.steinVotes += county.steinVotes;
  totals.oliverVotes += county.oliverVotes;
  totals.residualOtherVotes += county.residualOtherVotes;
  totals.otherVotes += county.otherVotes;
  totals.totalVotes += county.totalVotes;
  return totals;
}, {
  harrisVotes: 0,
  trumpVotes: 0,
  steinVotes: 0,
  oliverVotes: 0,
  residualOtherVotes: 0,
  otherVotes: 0,
  totalVotes: 0,
});

const statewideResidual = {
  harrisVotes: EXPECTED_STATE_TOTALS.harrisVotes - mappedCountyTotals.harrisVotes,
  trumpVotes: EXPECTED_STATE_TOTALS.trumpVotes - mappedCountyTotals.trumpVotes,
  steinVotes: EXPECTED_STATE_TOTALS.steinVotes - mappedCountyTotals.steinVotes,
  oliverVotes: EXPECTED_STATE_TOTALS.oliverVotes - mappedCountyTotals.oliverVotes,
  residualOtherVotes:
    EXPECTED_STATE_TOTALS.residualOtherVotes - mappedCountyTotals.residualOtherVotes,
  otherVotes: EXPECTED_STATE_TOTALS.otherVotes - mappedCountyTotals.otherVotes,
};
if (Object.values(statewideResidual).some((value) => value < 0)) {
  throw new Error("Official county summaries exceed the certified statewide baseline");
}
const statewideResidualTotal = statewideResidual.harrisVotes + statewideResidual.trumpVotes + statewideResidual.otherVotes;
reportingUnitMap.set("pa-42-statewide-residual", {
  id: "pa-42-statewide-residual",
  countyFips: null,
  sourcePrecinctCode: null,
  sourceMcdCode: null,
  sourceCountyFipsCode: null,
  sourceVtdCode: null,
  sourceVtdGeoid: null,
  name: "Certified statewide residual",
  type: "other_bucket",
  geometryId: null,
  geometryQuality: "none",
  resultQuality: "normalized",
  ballotMode: null,
  ...statewideResidual,
  totalVotes: statewideResidualTotal,
});

const stateTotals = {
  harrisVotes: mappedCountyTotals.harrisVotes + statewideResidual.harrisVotes,
  trumpVotes: mappedCountyTotals.trumpVotes + statewideResidual.trumpVotes,
  steinVotes: mappedCountyTotals.steinVotes + statewideResidual.steinVotes,
  oliverVotes: mappedCountyTotals.oliverVotes + statewideResidual.oliverVotes,
  residualOtherVotes:
    mappedCountyTotals.residualOtherVotes + statewideResidual.residualOtherVotes,
  otherVotes: mappedCountyTotals.otherVotes + statewideResidual.otherVotes,
  totalVotes: mappedCountyTotals.totalVotes + statewideResidualTotal,
};
for (const [key, expected] of Object.entries(EXPECTED_STATE_TOTALS)) {
  assertEqual(`Pennsylvania ${key}`, stateTotals[key], expected);
}

const reportingUnits = [...reportingUnitMap.values()].sort((a, b) => a.id.localeCompare(b.id));
for (const unit of reportingUnits) {
  if (unit.countyFips) summaryCountyMap.get(unit.countyFips).reportingUnitCount += 1;
}

const candidates = [...summaryCandidateMap.values()].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
candidates.push({
  id: "certified-statewide-residual",
  name: "Certified statewide residual",
  partyCode: null,
  bucket: "other",
  votes: statewideResidualTotal,
});
const generatedAt = "2026-08-09";
const precinctSource = {
  id: "pa-dos-2024-general-precinct-returns",
  publisher: "Commonwealth of Pennsylvania Department of State",
  title: "2024 General Election Precinct Election Returns",
  sourceUrl: SOURCE_URL,
  readmeUrl: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_readme.txt",
  sourceExtractedAt: "2025-01-10",
  retrievedAt: generatedAt,
  checksumSha256: sourceSha256,
  licenseStatus: "review_required",
  limitations: [
    "The state file supplies return records but not precinct polygon geometry.",
    "Ballot mode is not encoded on presidential return rows and is therefore left null.",
    "Reporting-unit names preserve the Department of State municipality and breakdown fields.",
  ],
};
const countySummarySource = {
  id: "pa-electionreturns-2024-president-county-breakdown",
  publisher: "Commonwealth of Pennsylvania Department of State",
  title: "2024 Presidential Election Official County Breakdown",
  sourceUrl: COUNTY_SUMMARY_URL,
  retrievedAt: generatedAt,
  checksumSha256: countySummarySha256,
  licenseStatus: "review_required",
  limitations: [
    "The public county breakdown includes Harris, Trump, Oliver, and Stein but does not expose county-level write-in totals.",
    "Election Day, mail, and provisional components reconcile exactly to each published candidate total.",
  ],
};
const certifiedBaselineSource = {
  id: "fec-2024-official-president",
  publisher: "Federal Election Commission",
  title: "Official 2024 Presidential General Election Results",
  sourceUrl: "https://www.fec.gov/resources/cms-content/documents/2024presgeresults.pdf",
  retrievedAt: generatedAt,
  limitations: [
    "The certified statewide total exceeds the four named county candidates by 24,526 votes.",
    "Those votes remain in an unassigned statewide bucket rather than being fabricated across counties.",
  ],
};

const countyDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "PA",
  stateFips: "42",
  generatedAt,
  sources: [countySummarySource, certifiedBaselineSource],
  totals: stateTotals,
  mappedCountyTotals,
  unassignedStatewideVotes: statewideResidualTotal,
  candidates,
  counties,
};

const reportingUnitDocument = {
  schemaVersion: 1,
  electionId: "2024-president",
  stateCode: "PA",
  stateFips: "42",
  generatedAt,
  sourceIds: [precinctSource.id, countySummarySource.id, certifiedBaselineSource.id],
  totals: stateTotals,
  mappedCountyTotals,
  unassignedStatewideVotes: statewideResidualTotal,
  reportingUnits,
};

const sourceManifest = {
  id: "pa-2024-presidential-source-package",
  sources: [precinctSource, countySummarySource, certifiedBaselineSource],
  pipelineVersion: "pa-2024-import-v1",
  sourceLineCount,
  presidentialLineCount,
  candidateCount: candidates.length,
  countyCount: counties.length,
  reportingUnitCount: reportingUnits.length,
  sourceReportingUnitCount,
  countyResidualBucketCount,
  statewideResidualBucketCount: 1,
  mappedCountyTotals,
  statewideResidual,
  stateTotals,
  outputs: [
    relative(process.cwd(), countyOutputPath).replaceAll("\\", "/"),
    relative(process.cwd(), reportingUnitOutputPath).replaceAll("\\", "/"),
  ],
};

for (const [path, document] of [
  [countyOutputPath, countyDocument],
  [reportingUnitOutputPath, reportingUnitDocument],
  [sourceManifestPath, sourceManifest],
]) {
  mkdirSync(dirname(path), { recursive: true });
  const indentation = path === reportingUnitOutputPath ? 0 : 2;
  writeFileSync(path, `${JSON.stringify(document, null, indentation)}\n`, "utf8");
}

console.log(JSON.stringify({
  sourceLineCount,
  presidentialLineCount,
  candidateCount: candidates.length,
  countyCount: counties.length,
  reportingUnitCount: reportingUnits.length,
  sourceReportingUnitCount,
  countyResidualBucketCount,
  totals: stateTotals,
  mappedCountyTotals,
  statewideResidual,
  candidates,
}, null, 2));
