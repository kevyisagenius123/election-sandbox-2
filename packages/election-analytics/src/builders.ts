import type {
  BehaviorContribution,
  BehaviorScenarioResult,
  StatewidePresidentialResult,
  ThirdPartyCandidate,
} from "../../election-model/src/scenario.ts";
import type { ReportedVoteAnalytics } from "../../election-replay/src/reportedAnalytics.ts";
import {
  createAnalyticEnvelope,
  createRatioAnalyticEnvelope,
  type AnalyticAvailability,
  type AnalyticEnvelope,
  type AnalyticGeography,
} from "./contracts.ts";

export const ENDPOINT_ANALYTICS_VERSION = "sandbox-endpoint-analytics-v1" as const;
export const BEHAVIOR_ANALYTICS_VERSION = "sandbox-behavior-analytics-v1" as const;
export const CONTRIBUTION_ANALYTICS_VERSION = "sandbox-contribution-analytics-v1" as const;
export const ELECTORAL_ANALYTICS_VERSION = "sandbox-electoral-analytics-v1" as const;
export const PREFIX_ANALYTICS_VERSION = "sandbox-prefix-analytics-v1" as const;

interface SourceContext {
  sourceIds: readonly string[];
  transformVersion?: string;
}

function requireNonnegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertEndpoint(result: StatewidePresidentialResult) {
  requireNonnegativeSafeInteger(result.totalVotes, `${result.code} total ballots`);
  requireNonnegativeSafeInteger(result.harrisVotes, `${result.code} Harris votes`);
  requireNonnegativeSafeInteger(result.trumpVotes, `${result.code} Trump votes`);
  requireNonnegativeSafeInteger(result.otherVotes, `${result.code} other votes`);
  if (result.harrisVotes + result.trumpVotes + result.otherVotes !== result.totalVotes) {
    throw new Error(`${result.code} endpoint candidate votes do not reconcile`);
  }
}

function endpointEnvelope(
  semanticClass: "certified" | "scenario",
  suffix: "total-ballots" | "candidate-votes" | "harris-trump-margin-votes",
  value: number,
  geography: AnalyticGeography,
  candidateScope: readonly string[],
  context: SourceContext,
) {
  return createAnalyticEnvelope({
    definitionId: `${semanticClass}.${suffix}`,
    value,
    geography,
    candidateScope,
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? ENDPOINT_ANALYTICS_VERSION,
  });
}

export function buildEndpointAnalyticEnvelopes(
  semanticClass: "certified" | "scenario",
  result: StatewidePresidentialResult,
  context: SourceContext,
): readonly AnalyticEnvelope[] {
  assertEndpoint(result);
  const geography = { level: "state", id: result.code } as const;
  return Object.freeze([
    endpointEnvelope(
      semanticClass,
      "total-ballots",
      result.totalVotes,
      geography,
      ["all-candidates"],
      context,
    ),
    endpointEnvelope(
      semanticClass,
      "candidate-votes",
      result.harrisVotes,
      geography,
      ["harris"],
      context,
    ),
    endpointEnvelope(
      semanticClass,
      "candidate-votes",
      result.trumpVotes,
      geography,
      ["trump"],
      context,
    ),
    endpointEnvelope(
      semanticClass,
      "candidate-votes",
      result.otherVotes,
      geography,
      ["other"],
      context,
    ),
    endpointEnvelope(
      semanticClass,
      "harris-trump-margin-votes",
      result.harrisVotes - result.trumpVotes,
      geography,
      ["harris", "trump"],
      context,
    ),
  ]);
}

function thirdPartyCandidateId(candidate: ThirdPartyCandidate) {
  if (candidate === "residual_other") return "other-residual";
  return candidate;
}

export function buildBehaviorOperationAnalyticEnvelopes(
  stateCode: string,
  behavior: BehaviorScenarioResult,
  context: SourceContext,
): readonly AnalyticEnvelope[] {
  const geography = { level: "state", id: stateCode } as const;
  const common = {
    geography,
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? BEHAVIOR_ANALYTICS_VERSION,
  } as const;
  const selectedCandidate = thirdPartyCandidateId(behavior.thirdParty.candidate);
  return Object.freeze([
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.turnout-requested-ballots",
      value: behavior.turnout.requestedVotes,
      candidateScope: ["harris", "trump"],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.turnout-realized-ballots",
      value: behavior.turnout.addedVotes,
      candidateScope: ["harris", "trump"],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.preference-requested-transfers",
      value: behavior.preference.requestedTransfer,
      candidateScope: ["harris", "trump"],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.preference-realized-transfers",
      value: behavior.preference.realizedTransfer,
      candidateScope: ["harris", "trump"],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.third-party-requested-exchanges",
      value: behavior.thirdParty.requestedCandidateDelta,
      candidateScope: ["harris", "trump", selectedCandidate],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "scenario.third-party-realized-exchanges",
      value: behavior.thirdParty.realizedCandidateDelta,
      candidateScope: ["harris", "trump", selectedCandidate],
    }),
  ]);
}

export function buildContributionAnalyticEnvelope(
  stateCode: string,
  contribution: BehaviorContribution,
  context: SourceContext,
) {
  const geography: AnalyticGeography = contribution.geometryId
    ? { level: "reporting-unit", id: `${stateCode}:${contribution.geometryId}` }
    : contribution.countyFips
      ? { level: "county", id: `${stateCode}:${contribution.countyFips}` }
      : { level: "state", id: `${stateCode}:residual:${contribution.id}` };
  return createAnalyticEnvelope({
    definitionId: "derived.geography-margin-contribution-votes",
    value: contribution.marginDelta,
    geography,
    candidateScope: ["harris", "trump"],
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? CONTRIBUTION_ANALYTICS_VERSION,
    caveat: contribution.geometryId || contribution.countyFips
      ? null
      : "Votes retained outside the mapped geography contract.",
  });
}

export function buildElectoralConsequenceAnalyticEnvelope(
  targetCandidate: "harris" | "trump",
  targetElectoralDelta: number,
  context: SourceContext,
) {
  return createAnalyticEnvelope({
    definitionId: "derived.electoral-vote-consequence",
    value: targetElectoralDelta,
    geography: { level: "national", id: "US" },
    candidateScope: [targetCandidate],
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? ELECTORAL_ANALYTICS_VERSION,
  });
}

export function buildReportedAnalyticEnvelopes(
  analytics: ReportedVoteAnalytics,
  geography: AnalyticGeography,
  context: SourceContext & { status?: AnalyticAvailability },
): readonly AnalyticEnvelope[] {
  const common = {
    status: context.status ?? "available",
    geography,
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? PREFIX_ANALYTICS_VERSION,
    caveat: "Current replay prefix only; no unreported candidate outcome is included.",
  } as const;
  const envelopes: AnalyticEnvelope[] = [
    createAnalyticEnvelope({
      ...common,
      definitionId: "reported.total-ballots",
      value: analytics.totalReportedVotes,
      candidateScope: ["all-candidates"],
    }),
    createAnalyticEnvelope({
      ...common,
      definitionId: "reported.returns-published",
      value: analytics.returnsPublished,
      candidateScope: ["all-candidates"],
    }),
  ];
  for (const candidate of analytics.candidateVotes) {
    envelopes.push(createAnalyticEnvelope({
      ...common,
      definitionId: "reported.candidate-votes",
      value: candidate.votes,
      candidateScope: [candidate.candidateId],
    }));
  }
  if (analytics.harrisTrumpReportedMargin) {
    envelopes.push(createAnalyticEnvelope({
      ...common,
      definitionId: "reported.harris-trump-margin-votes",
      value: analytics.harrisTrumpReportedMargin.signedHarrisMinusTrumpVotes,
      candidateScope: ["harris", "trump"],
    }));
  }
  return Object.freeze(envelopes);
}

export function buildProgressAnalyticEnvelopes(
  reported: Pick<ReportedVoteAnalytics, "totalReportedVotes" | "returnsPublished">,
  expected: { returns: number | null; ballots: number | null },
  geography: AnalyticGeography,
  context: SourceContext,
): readonly AnalyticEnvelope[] {
  const common = {
    geography,
    candidateScope: ["all-candidates"],
    sourceIds: context.sourceIds,
    transformVersion: context.transformVersion ?? PREFIX_ANALYTICS_VERSION,
  } as const;
  const returns = expected.returns == null
    ? createAnalyticEnvelope({
        ...common,
        definitionId: "derived.return-progress-ppm",
        status: "unavailable",
        value: null,
        caveat: "Expected return count is unavailable.",
      })
    : createRatioAnalyticEnvelope({
        ...common,
        definitionId: "derived.return-progress-ppm",
        numerator: { label: "published atomic returns", value: reported.returnsPublished, unit: "returns" },
        denominator: { label: "admitted expected returns", value: expected.returns, unit: "returns" },
      });
  const ballots = expected.ballots == null
    ? createAnalyticEnvelope({
        ...common,
        definitionId: "derived.represented-ballot-progress-ppm",
        status: "unavailable",
        value: null,
        caveat: "Modeled endpoint ballot denominator is unavailable.",
      })
    : createRatioAnalyticEnvelope({
        ...common,
        definitionId: "derived.represented-ballot-progress-ppm",
        numerator: { label: "current-prefix ballots", value: reported.totalReportedVotes, unit: "ballots" },
        denominator: { label: "modeled endpoint ballots", value: expected.ballots, unit: "ballots" },
        caveat: "The denominator is scenario bookkeeping, not a forecast from current returns.",
      });
  return Object.freeze([returns, ballots]);
}
