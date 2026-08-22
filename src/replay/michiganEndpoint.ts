import type {
  BehaviorScenarioResult,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";
import type {
  CandidateVote,
  ElectoralAllocationEntry,
  EvidenceReference,
  LockedElectionEndpointInput,
  LockedJurisdictionEndpointInput,
  LockedReportingUnitEndpointInput,
} from "../../packages/election-replay/src/index.ts";
import type { MichiganDemographicFoundation } from "../data/miDemographics.ts";
import { michiganDetailedStateManifest } from "../data/detailedStateManifest.ts";
import { states2024 } from "../data/states.ts";
import { replayCandidateDefinitions } from "./pennsylvaniaEndpoint.ts";
import michiganCountyDocument from "../data/mi-2024-counties.json" with { type: "json" };
import michiganSourceRegistry from "../../data-sources/michigan/2024-general-presidential.json" with { type: "json" };
import michiganGeometryRegistry from "../../data-sources/michigan/2024-precinct-crosswalk.json" with { type: "json" };
import pennsylvaniaSourceRegistry from "../../data-sources/pennsylvania/2024-general-presidential.json" with { type: "json" };

const HARRIS_ID = "harris";
const TRUMP_ID = "trump";
const STEIN_ID = "stein";
const OLIVER_ID = "oliver";
const OTHER_RESIDUAL_ID = "other-residual";

function candidateVotes(values: {
  harrisVotes: number;
  trumpVotes: number;
  steinVotes?: number;
  oliverVotes?: number;
  residualOtherVotes?: number;
  otherVotes?: number;
}): CandidateVote[] {
  const steinVotes = values.steinVotes ?? 0;
  const oliverVotes = values.oliverVotes ?? 0;
  const residualOtherVotes = values.residualOtherVotes
    ?? (values.otherVotes ?? 0) - steinVotes - oliverVotes;
  if (residualOtherVotes < 0) {
    throw new Error("Named third-party votes exceed the supplied Other total");
  }
  return [
    { candidateId: HARRIS_ID, votes: values.harrisVotes },
    { candidateId: TRUMP_ID, votes: values.trumpVotes },
    { candidateId: STEIN_ID, votes: steinVotes },
    { candidateId: OLIVER_ID, votes: oliverVotes },
    { candidateId: OTHER_RESIDUAL_ID, votes: residualOtherVotes },
  ];
}

function addCandidateVotes(target: Map<string, number>, votes: readonly CandidateVote[]) {
  for (const candidate of votes) {
    target.set(candidate.candidateId, (target.get(candidate.candidateId) ?? 0) + candidate.votes);
  }
}

function mapAsCandidateVotes(target: ReadonlyMap<string, number>) {
  return replayCandidateDefinitions.map((candidate) => ({
    candidateId: candidate.id,
    votes: target.get(candidate.id) ?? 0,
  }));
}

function evidenceFromMichigan(): EvidenceReference[] {
  const resultSource = michiganSourceRegistry.sources.find(
    (source) => source.id === "mi-boe-2024-general-precinct-results",
  );
  const fecSource = pennsylvaniaSourceRegistry.sources.find(
    (source) => source.id === "fec-2024-official-president",
  );
  const geometrySource = michiganGeometryRegistry.geometrySource;
  if (!resultSource || !fecSource || !geometrySource) {
    throw new Error("Michigan endpoint evidence registry is incomplete");
  }
  return [
    {
      id: fecSource.id,
      publisher: fecSource.publisher,
      title: fecSource.title,
      sourceUrl: fecSource.sourceUrl,
      retrievedAt: fecSource.retrievedAt,
      status: "documented",
      limitations: fecSource.limitations,
    },
    {
      id: resultSource.id,
      publisher: resultSource.publisher,
      title: resultSource.title,
      sourceUrl: resultSource.sourceUrl,
      retrievedAt: resultSource.retrievedAt,
      artifactSha256: resultSource.checksumSha256,
      status: "documented",
      limitations: resultSource.limitations,
    },
    {
      id: geometrySource.id,
      publisher: geometrySource.publisher,
      title: geometrySource.title,
      sourceUrl: geometrySource.sourceUrl,
      retrievedAt: geometrySource.retrievedAt,
      artifactSha256: geometrySource.checksumSha256,
      status: "documented",
      limitations: geometrySource.limitations,
    },
    {
      id: "mi-2024-geometry-linked-result-units",
      publisher: "Sandbox 2.0",
      title: "Michigan 2024 results retained on exact-cycle precinct terrain",
      sourceUrl: geometrySource.sourceUrl,
      retrievedAt: geometrySource.retrievedAt,
      status: "reconstructed",
      limitations: [
        "Mapped units are exact-cycle geometry-linked result units, not 2020 Census VTDs.",
        "Eight unmatched precinct units, central-count units, and the statewide adjustment remain explicit off-map units.",
        "The statewide adjustment preserves the certified net of source correction rows and is not assigned to a county or polygon.",
      ],
    },
  ];
}

function michiganReportingUnits(
  foundation: MichiganDemographicFoundation,
  scenarioUnits: readonly BehaviorScenarioUnit[],
) {
  const precincts = new Map(
    foundation.precincts.map((precinct) => [`precinct-${precinct.geometryId}`, precinct]),
  );
  const residuals = new Map(foundation.residualUnits.map((unit) => [unit.id, unit]));
  return scenarioUnits.map((unit): LockedReportingUnitEndpointInput => {
    const precinct = precincts.get(unit.id);
    const residual = residuals.get(unit.id);
    if (!precinct && !residual) throw new Error(`Unknown Michigan model unit ${unit.id}`);
    const unitType = precinct
      ? "precinct"
      : residual?.type === "central_count_bucket"
        ? "central-count"
        : residual?.type === "other_bucket"
          ? "residual"
          : "precinct";
    const mapped = precinct != null && unit.geometryId != null;
    const evidenceIds = mapped
      ? [
        "mi-boe-2024-general-precinct-results",
        "mi-gis-2024-voting-precincts",
        "mi-2024-geometry-linked-result-units",
      ]
      : ["mi-boe-2024-general-precinct-results"];
    return {
      unitId: unit.id,
      name: precinct?.precinctName ?? residual?.name ?? unit.id,
      jurisdictionId: "MI",
      countyId: unit.countyFips,
      unitType,
      geometryStatus: mapped ? "mapped" : "off-map",
      candidateVotes: candidateVotes(unit),
      totalVotes: unit.totalVotes,
      evidenceIds,
    };
  });
}

function michiganJurisdiction(
  foundation: MichiganDemographicFoundation,
  scenario: BehaviorScenarioResult,
): LockedJurisdictionEndpointInput {
  const reportingUnits = michiganReportingUnits(foundation, scenario.units);
  const countyAggregates = new Map<string, Map<string, number>>();
  for (const unit of reportingUnits) {
    if (unit.countyId == null) continue;
    const aggregate = countyAggregates.get(unit.countyId)
      ?? new Map(replayCandidateDefinitions.map((candidate) => [candidate.id, 0]));
    addCandidateVotes(aggregate, unit.candidateVotes);
    countyAggregates.set(unit.countyId, aggregate);
  }
  const countyNames = new Map(
    michiganCountyDocument.counties.map((county) => [county.fips, county.name]),
  );
  const counties = [...countyAggregates.entries()].map(([countyId, aggregate]) => {
    const votes = mapAsCandidateVotes(aggregate);
    return {
      countyId,
      name: countyNames.get(countyId) ?? countyId,
      jurisdictionId: "MI",
      candidateVotes: votes,
      totalVotes: votes.reduce((sum, candidate) => sum + candidate.votes, 0),
      evidenceIds: ["mi-boe-2024-general-precinct-results"],
    };
  });
  return {
    jurisdictionId: "MI",
    name: "Michigan",
    electoralVotes: michiganDetailedStateManifest.election.electoralVotes,
    candidateVotes: candidateVotes(scenario.totals),
    totalVotes: scenario.totals.totalVotes,
    counties,
    reportingUnits,
    evidenceIds: [
      "fec-2024-official-president",
      "mi-boe-2024-general-precinct-results",
      "mi-gis-2024-voting-precincts",
      "mi-2024-geometry-linked-result-units",
    ],
  };
}

function baselineJurisdiction(
  state: (typeof states2024)[number],
): LockedJurisdictionEndpointInput {
  const votes = candidateVotes(state);
  return {
    jurisdictionId: state.code,
    name: state.name,
    electoralVotes: state.harrisElectoralVotes + state.trumpElectoralVotes,
    candidateVotes: votes,
    totalVotes: state.totalVotes,
    counties: [],
    reportingUnits: [{
      unitId: `jurisdiction-total-${state.code}`,
      name: `${state.name} certified statewide total`,
      jurisdictionId: state.code,
      countyId: null,
      unitType: "jurisdiction-total",
      geometryStatus: "none",
      candidateVotes: votes,
      totalVotes: state.totalVotes,
      evidenceIds: ["fec-2024-official-president"],
    }],
    evidenceIds: ["fec-2024-official-president"],
  };
}

function electoralAllocation(jurisdictions: readonly LockedJurisdictionEndpointInput[]) {
  const allocations: ElectoralAllocationEntry[] = [];
  for (const jurisdiction of jurisdictions) {
    if (jurisdiction.jurisdictionId === "MI") {
      const byCandidate = new Map(
        jurisdiction.candidateVotes.map((candidate) => [candidate.candidateId, candidate.votes]),
      );
      const harrisVotes = byCandidate.get(HARRIS_ID) ?? 0;
      const trumpVotes = byCandidate.get(TRUMP_ID) ?? 0;
      if (harrisVotes === trumpVotes) {
        throw new Error("Michigan electoral allocation is undefined for a tied endpoint");
      }
      allocations.push({
        jurisdictionId: "MI",
        candidateId: harrisVotes > trumpVotes ? HARRIS_ID : TRUMP_ID,
        electoralVotes: jurisdiction.electoralVotes,
        allocationDistrict: null,
      });
      continue;
    }
    const baseline = states2024.find((state) => state.code === jurisdiction.jurisdictionId);
    if (!baseline) throw new Error(`Missing baseline allocation for ${jurisdiction.jurisdictionId}`);
    if (baseline.harrisElectoralVotes > 0) {
      allocations.push({
        jurisdictionId: baseline.code,
        candidateId: HARRIS_ID,
        electoralVotes: baseline.harrisElectoralVotes,
        allocationDistrict: null,
      });
    }
    if (baseline.trumpElectoralVotes > 0) {
      allocations.push({
        jurisdictionId: baseline.code,
        candidateId: TRUMP_ID,
        electoralVotes: baseline.trumpElectoralVotes,
        allocationDistrict: null,
      });
    }
  }
  return allocations;
}

export interface MichiganEndpointOptions {
  foundation: MichiganDemographicFoundation;
  scenario: BehaviorScenarioResult;
  scenarioId: string;
  scenarioFingerprint: string;
  createdAt: string;
}

export function buildMichiganElectionEndpointInput(
  options: MichiganEndpointOptions,
): LockedElectionEndpointInput {
  const michigan = michiganJurisdiction(options.foundation, options.scenario);
  const jurisdictions = states2024.map((state) => (
    state.code === "MI" ? michigan : baselineJurisdiction(state)
  ));
  const national = new Map(replayCandidateDefinitions.map((candidate) => [candidate.id, 0]));
  for (const jurisdiction of jurisdictions) addCandidateVotes(national, jurisdiction.candidateVotes);
  return {
    metadata: {
      scenarioId: options.scenarioId,
      scenarioFingerprint: options.scenarioFingerprint,
      createdAt: options.createdAt,
    },
    content: {
      electionId: "us-president-2024",
      dataCompatibilityVersion: michiganDetailedStateManifest.compatibility.dataVersion,
      scenarioEngineVersion: michiganDetailedStateManifest.compatibility.engineVersion,
      candidates: replayCandidateDefinitions,
      evidence: evidenceFromMichigan(),
      jurisdictions,
      nationalTotals: mapAsCandidateVotes(national),
      electoralAllocation: electoralAllocation(jurisdictions),
    },
  };
}
