import type { BehaviorScenarioResult } from "../../packages/election-model/src/scenario.ts";
import type {
  CandidateVote,
  EvidenceReference,
  LockedElectionEndpointInput,
} from "../../packages/election-replay/src/index.ts";
import type { MichiganDemographicFoundation } from "../data/miDemographics.ts";
import type { PennsylvaniaDemographicFoundation } from "../data/paDemographics.ts";
import { replayCandidateDefinitions, buildPennsylvaniaElectionEndpointInput } from "./pennsylvaniaEndpoint.ts";
import { buildMichiganElectionEndpointInput } from "./michiganEndpoint.ts";

export interface PennsylvaniaMichiganEndpointOptions {
  pennsylvaniaFoundation: PennsylvaniaDemographicFoundation;
  pennsylvaniaScenario: BehaviorScenarioResult;
  michiganFoundation: MichiganDemographicFoundation;
  michiganScenario: BehaviorScenarioResult;
  scenarioId: string;
  scenarioFingerprint: string;
  createdAt: string;
}

function addCandidateVotes(target: Map<string, number>, votes: readonly CandidateVote[]) {
  for (const candidate of votes) {
    target.set(candidate.candidateId, (target.get(candidate.candidateId) ?? 0) + candidate.votes);
  }
}

export function buildPennsylvaniaMichiganElectionEndpointInput(
  options: PennsylvaniaMichiganEndpointOptions,
): LockedElectionEndpointInput {
  const commonMetadata = {
    scenarioId: options.scenarioId,
    scenarioFingerprint: options.scenarioFingerprint,
    createdAt: options.createdAt,
  };
  const pennsylvaniaInput = buildPennsylvaniaElectionEndpointInput({
    foundation: options.pennsylvaniaFoundation,
    scenario: options.pennsylvaniaScenario,
    ...commonMetadata,
  });
  const michiganInput = buildMichiganElectionEndpointInput({
    foundation: options.michiganFoundation,
    scenario: options.michiganScenario,
    ...commonMetadata,
  });
  const detailedMichigan = michiganInput.content.jurisdictions.find(
    (jurisdiction) => jurisdiction.jurisdictionId === "MI",
  );
  if (!detailedMichigan) throw new Error("Michigan detailed endpoint is missing Michigan");
  const jurisdictions = pennsylvaniaInput.content.jurisdictions.map((jurisdiction) => (
    jurisdiction.jurisdictionId === "MI" ? detailedMichigan : jurisdiction
  ));
  const evidenceById = new Map<string, EvidenceReference>();
  for (const evidence of [
    ...pennsylvaniaInput.content.evidence,
    ...michiganInput.content.evidence,
  ]) {
    if (!evidenceById.has(evidence.id)) evidenceById.set(evidence.id, evidence);
  }
  const national = new Map(replayCandidateDefinitions.map((candidate) => [candidate.id, 0]));
  for (const jurisdiction of jurisdictions) addCandidateVotes(national, jurisdiction.candidateVotes);
  const electoralAllocation = pennsylvaniaInput.content.electoralAllocation
    .filter((allocation) => allocation.jurisdictionId !== "MI")
    .concat(michiganInput.content.electoralAllocation.filter(
      (allocation) => allocation.jurisdictionId === "MI",
    ));
  return {
    metadata: commonMetadata,
    content: {
      ...pennsylvaniaInput.content,
      evidence: [...evidenceById.values()],
      jurisdictions,
      nationalTotals: replayCandidateDefinitions.map((candidate) => ({
        candidateId: candidate.id,
        votes: national.get(candidate.id) ?? 0,
      })),
      electoralAllocation,
    },
  };
}
