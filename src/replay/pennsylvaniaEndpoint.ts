import type {
  BehaviorScenarioResult,
  BehaviorScenarioUnit,
} from "../../packages/election-model/src/scenario.ts";
import type {
  CandidateDefinition,
  CandidateVote,
  ElectoralAllocationEntry,
  EvidenceReference,
  LockedElectionEndpointInput,
  LockedJurisdictionEndpointInput,
  LockedReportingUnitEndpointInput,
} from "../../packages/election-replay/src/index.ts";
import type { PennsylvaniaDemographicFoundation } from "../data/paDemographics.ts";
import { pennsylvaniaDetailedStateManifest } from "../data/detailedStateManifest.ts";
import { pennsylvaniaCountyByFips } from "../data/pennsylvania.ts";
import { states2024 } from "../data/states.ts";
import sourceRegistryDocument from "../../data-sources/pennsylvania/2024-general-presidential.json" with { type: "json" };

const HARRIS_ID = "harris";
const TRUMP_ID = "trump";
const STEIN_ID = "stein";
const OLIVER_ID = "oliver";
const OTHER_RESIDUAL_ID = "other-residual";

export const replayCandidateDefinitions: readonly CandidateDefinition[] = Object.freeze([
  { id: HARRIS_ID, name: "Kamala Harris", shortName: "Harris", partyId: "DEM", displayOrder: 0 },
  { id: TRUMP_ID, name: "Donald Trump", shortName: "Trump", partyId: "REP", displayOrder: 1 },
  { id: STEIN_ID, name: "Jill Stein", shortName: "Stein", partyId: "GRN", displayOrder: 2 },
  { id: OLIVER_ID, name: "Chase Oliver", shortName: "Oliver", partyId: "LIB", displayOrder: 3 },
  {
    id: OTHER_RESIDUAL_ID,
    name: "Other and write-in",
    shortName: "Other",
    partyId: null,
    displayOrder: 4,
  },
]);

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

function evidenceFromPennsylvania(
  foundation: PennsylvaniaDemographicFoundation,
): EvidenceReference[] {
  const sourceRegistry = sourceRegistryDocument as {
    sources: Array<{
      id: string;
      publisher: string;
      title: string;
      sourceUrl: string;
      retrievedAt: string;
      checksumSha256?: string;
      limitations: string[];
    }>;
  };
  const source = (id: string) => {
    const match = sourceRegistry.sources.find((candidate) => candidate.id === id);
    if (!match) throw new Error(`Pennsylvania source registry is missing ${id}`);
    return match;
  };
  const returnSource = source("pa-dos-2024-general-precinct-returns");
  const countySource = source("pa-electionreturns-2024-president-county-breakdown");
  const fecSource = source("fec-2024-official-president");
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
      id: returnSource.id,
      publisher: returnSource.publisher,
      title: returnSource.title,
      sourceUrl: returnSource.sourceUrl,
      retrievedAt: returnSource.retrievedAt,
      artifactSha256: returnSource.checksumSha256,
      status: "documented",
      limitations: returnSource.limitations,
    },
    {
      id: countySource.id,
      publisher: countySource.publisher,
      title: countySource.title,
      sourceUrl: countySource.sourceUrl,
      retrievedAt: countySource.retrievedAt,
      artifactSha256: countySource.checksumSha256,
      status: "documented",
      limitations: countySource.limitations,
    },
    {
      id: "pa-vtd-2020-crosswalk-derived",
      publisher: foundation.source.publisher,
      title: "Pennsylvania 2024 returns reconstructed onto 2020 Census VTD geography",
      sourceUrl: foundation.source.sourceUrl,
      retrievedAt: null,
      status: "reconstructed",
      limitations: [
        ...foundation.source.limitations,
        "VTD endpoint rows are deterministic geographic reconstructions, not raw certified VTD returns.",
      ],
    },
  ];
}

function paReportingUnits(
  foundation: PennsylvaniaDemographicFoundation,
  scenarioUnits: readonly BehaviorScenarioUnit[],
) {
  const vtdNames = new Map(foundation.vtds.map((vtd) => [vtd.geoid, vtd.displayName]));
  const residuals = new Map(foundation.residualUnits.map((unit) => [unit.id, unit]));
  return scenarioUnits.map((unit): LockedReportingUnitEndpointInput => {
    const residual = residuals.get(unit.id);
    const unitType = unit.geometryId != null
      ? "vtd"
      : residual?.type === "other_bucket"
        ? "residual"
        : "precinct";
    const votes = candidateVotes(unit);
    return {
      unitId: unit.id,
      name: unit.geometryId != null
        ? vtdNames.get(unit.geometryId) ?? unit.id
        : residual?.name ?? unit.id,
      jurisdictionId: "PA",
      countyId: unit.countyFips,
      unitType,
      geometryStatus: unit.geometryId != null ? "mapped" : "off-map",
      candidateVotes: votes,
      totalVotes: unit.totalVotes,
      evidenceIds: [
        "pa-dos-2024-general-precinct-returns",
        "pa-vtd-2020-crosswalk-derived",
      ],
    };
  });
}

function paJurisdiction(
  foundation: PennsylvaniaDemographicFoundation,
  scenario: BehaviorScenarioResult,
): LockedJurisdictionEndpointInput {
  const reportingUnits = paReportingUnits(foundation, scenario.units);
  const countyAggregates = new Map<string, Map<string, number>>();
  for (const unit of reportingUnits) {
    if (unit.countyId == null) continue;
    const aggregate = countyAggregates.get(unit.countyId)
      ?? new Map(replayCandidateDefinitions.map((candidate) => [candidate.id, 0]));
    addCandidateVotes(aggregate, unit.candidateVotes);
    countyAggregates.set(unit.countyId, aggregate);
  }
  const counties = [...countyAggregates.entries()].map(([countyId, aggregate]) => {
    const votes = mapAsCandidateVotes(aggregate);
    return {
      countyId,
      name: pennsylvaniaCountyByFips.get(countyId)?.name ?? countyId,
      jurisdictionId: "PA",
      candidateVotes: votes,
      totalVotes: votes.reduce((sum, candidate) => sum + candidate.votes, 0),
      evidenceIds: [
        "pa-dos-2024-general-precinct-returns",
        "pa-electionreturns-2024-president-county-breakdown",
      ],
    };
  });
  return {
    jurisdictionId: "PA",
    name: "Pennsylvania",
    electoralVotes: pennsylvaniaDetailedStateManifest.election.electoralVotes,
    candidateVotes: candidateVotes(scenario.totals),
    totalVotes: scenario.totals.totalVotes,
    counties,
    reportingUnits,
    evidenceIds: [
      "fec-2024-official-president",
      "pa-dos-2024-general-precinct-returns",
      "pa-electionreturns-2024-president-county-breakdown",
      "pa-vtd-2020-crosswalk-derived",
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

function electoralAllocation(
  jurisdictions: readonly LockedJurisdictionEndpointInput[],
) {
  const allocations: ElectoralAllocationEntry[] = [];
  for (const jurisdiction of jurisdictions) {
    if (jurisdiction.jurisdictionId === "PA") {
      const byCandidate = new Map(
        jurisdiction.candidateVotes.map((candidate) => [candidate.candidateId, candidate.votes]),
      );
      const harrisVotes = byCandidate.get(HARRIS_ID) ?? 0;
      const trumpVotes = byCandidate.get(TRUMP_ID) ?? 0;
      if (harrisVotes === trumpVotes) {
        throw new Error("Pennsylvania electoral allocation is undefined for a tied endpoint");
      }
      allocations.push({
        jurisdictionId: "PA",
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

export interface PennsylvaniaEndpointOptions {
  foundation: PennsylvaniaDemographicFoundation;
  scenario: BehaviorScenarioResult;
  scenarioId: string;
  scenarioFingerprint: string;
  createdAt: string;
}

export function buildPennsylvaniaElectionEndpointInput(
  options: PennsylvaniaEndpointOptions,
): LockedElectionEndpointInput {
  const pa = paJurisdiction(options.foundation, options.scenario);
  const jurisdictions = states2024.map((state) => (
    state.code === "PA" ? pa : baselineJurisdiction(state)
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
      dataCompatibilityVersion: pennsylvaniaDetailedStateManifest.compatibility.dataVersion,
      scenarioEngineVersion: pennsylvaniaDetailedStateManifest.compatibility.engineVersion,
      candidates: replayCandidateDefinitions,
      evidence: evidenceFromPennsylvania(options.foundation),
      jurisdictions,
      nationalTotals: mapAsCandidateVotes(national),
      electoralAllocation: electoralAllocation(jurisdictions),
    },
  };
}
