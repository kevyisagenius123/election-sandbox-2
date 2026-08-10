import type { CandidateVotes, ReportingUnitResult } from "../../data-contracts/src/index.ts";
import { assertResultReconciles, largestRemainder } from "./invariants.ts";

export interface StatewidePresidentialResult {
  code: string;
  totalVotes: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  harrisElectoralVotes: number;
  trumpElectoralVotes: number;
}

export interface NationalPresidentialResult {
  totalVotes: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  harrisElectoralVotes: number;
  trumpElectoralVotes: number;
}

export interface CountyPresidentialResult {
  fips: string;
  name: string;
  totalVotes: number;
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
}

export interface CountyScenarioResult extends CountyPresidentialResult {
  netHarrisGain: number;
}

export interface BehaviorModelUnit {
  id: string;
  countyFips: string | null;
  geometryId: string | null;
  harrisVotes: number;
  trumpVotes: number;
  steinVotes: number;
  oliverVotes: number;
  residualOtherVotes: number;
  otherVotes: number;
  totalVotes: number;
  turnoutDenominator: number | null;
  turnoutCapacity: number;
}

export type ThirdPartyCandidate = "stein" | "oliver" | "residual_other";

export interface BehaviorScenarioSettings {
  turnoutIncreasePoints: number;
  addedVoterHarrisShare: number;
  preferenceShiftPoints: number;
  thirdPartyCandidate: ThirdPartyCandidate;
  thirdPartyShiftPoints: number;
  thirdPartyHarrisExchangeShare: number;
}

export interface BehaviorScenarioUnit extends BehaviorModelUnit {
  turnoutAddedVotes: number;
  turnoutHarrisVotes: number;
  turnoutTrumpVotes: number;
  preferenceNetHarrisGain: number;
  thirdPartyCandidateDelta: number;
  netHarrisGain: number;
}

export interface BehaviorScenarioResult {
  units: BehaviorScenarioUnit[];
  totals: {
    harrisVotes: number;
    trumpVotes: number;
    steinVotes: number;
    oliverVotes: number;
    residualOtherVotes: number;
    otherVotes: number;
    totalVotes: number;
  };
  turnout: {
    requestedVotes: number;
    addedVotes: number;
    harrisVotes: number;
    trumpVotes: number;
    denominator: number;
    capacity: number;
  };
  preference: {
    requestedTransfer: number;
    realizedTransfer: number;
  };
  thirdParty: {
    candidate: ThirdPartyCandidate;
    startingCandidateVotes: number;
    exchangeCapacity: number;
    ballotTotal: number;
    requestedCandidateDelta: number;
    realizedCandidateDelta: number;
    harrisVoteDelta: number;
    trumpVoteDelta: number;
  };
}

export interface BehaviorContribution {
  id: string;
  countyFips: string | null;
  geometryId: string | null;
  harrisDelta: number;
  trumpDelta: number;
  otherDelta: number;
  ballotDelta: number;
  marginDelta: number;
}

export interface PreferenceShiftBounds {
  towardTrumpPoints: number;
  towardHarrisPoints: number;
}

export interface ThirdPartyShiftBounds {
  towardZeroPoints: number;
  towardMaximumPoints: number;
}

interface BehaviorBaselineProfile {
  denominator: number;
  capacity: number;
  turnoutWeights: number[];
  turnoutCapacities: number[];
}

export type TwoPartyResult = {
  harrisVotes: number;
  trumpVotes: number;
};

type ThirdPartyVoteKey = "steinVotes" | "oliverVotes" | "residualOtherVotes";

const behaviorBaselineProfileCache = new WeakMap<
  readonly BehaviorModelUnit[],
  BehaviorBaselineProfile
>();
const behaviorBaselineIndexCache = new WeakMap<
  readonly BehaviorModelUnit[],
  ReadonlyMap<string, BehaviorModelUnit>
>();

function behaviorBaselineProfile(
  baselineUnits: readonly BehaviorModelUnit[],
): BehaviorBaselineProfile {
  const cached = behaviorBaselineProfileCache.get(baselineUnits);
  if (cached) return cached;

  let denominator = 0;
  let capacity = 0;
  const turnoutWeights = new Array<number>(baselineUnits.length);
  const turnoutCapacities = new Array<number>(baselineUnits.length);
  for (let index = 0; index < baselineUnits.length; index += 1) {
    const unit = baselineUnits[index];
    if (unit.harrisVotes + unit.trumpVotes + unit.otherVotes !== unit.totalVotes) {
      throw new Error(`${unit.id} baseline votes do not reconcile`);
    }
    if (unit.steinVotes + unit.oliverVotes + unit.residualOtherVotes !== unit.otherVotes) {
      throw new Error(`${unit.id} third-party votes do not reconcile`);
    }
    if (!Number.isSafeInteger(unit.turnoutCapacity) || unit.turnoutCapacity < 0) {
      throw new Error(`${unit.id} has invalid turnout capacity`);
    }
    const turnoutWeight = unit.turnoutDenominator ?? 0;
    turnoutWeights[index] = turnoutWeight;
    turnoutCapacities[index] = unit.turnoutCapacity;
    denominator += turnoutWeight;
    capacity += unit.turnoutCapacity;
  }

  const profile = { denominator, capacity, turnoutWeights, turnoutCapacities };
  behaviorBaselineProfileCache.set(baselineUnits, profile);
  return profile;
}

function behaviorBaselineIndex(
  baselineUnits: readonly BehaviorModelUnit[],
) {
  const cached = behaviorBaselineIndexCache.get(baselineUnits);
  if (cached) return cached;
  const index = new Map(baselineUnits.map((unit) => [unit.id, unit]));
  if (index.size !== baselineUnits.length) {
    throw new Error("Behavior baseline contains duplicate unit identifiers");
  }
  behaviorBaselineIndexCache.set(baselineUnits, index);
  return index;
}

function thirdPartyVoteKey(candidate: ThirdPartyCandidate): ThirdPartyVoteKey {
  if (candidate === "stein") return "steinVotes";
  if (candidate === "oliver") return "oliverVotes";
  return "residualOtherVotes";
}

function splitThirdPartyExchange(ballots: number, harrisShare: number) {
  const harrisVotes = Math.round(ballots * harrisShare);
  return { harrisVotes, trumpVotes: ballots - harrisVotes };
}

function thirdPartyGainCapacity(
  harrisVotes: number,
  trumpVotes: number,
  harrisShare: number,
) {
  let lower = 0;
  let upper = harrisVotes + trumpVotes;
  while (lower < upper) {
    const candidate = Math.ceil((lower + upper) / 2);
    const exchange = splitThirdPartyExchange(candidate, harrisShare);
    if (exchange.harrisVotes <= harrisVotes && exchange.trumpVotes <= trumpVotes) {
      lower = candidate;
    } else {
      upper = candidate - 1;
    }
  }
  return lower;
}

export function preferenceShiftBounds(
  result: Pick<BehaviorModelUnit, "harrisVotes" | "trumpVotes" | "totalVotes">,
): PreferenceShiftBounds {
  if (!Number.isSafeInteger(result.totalVotes) || result.totalVotes <= 0) {
    throw new Error("Preference bounds require a positive safe-integer ballot total");
  }
  if (!Number.isSafeInteger(result.harrisVotes) || result.harrisVotes < 0
    || !Number.isSafeInteger(result.trumpVotes) || result.trumpVotes < 0
    || result.harrisVotes + result.trumpVotes > result.totalVotes) {
    throw new Error("Preference bounds require valid major-party vote totals");
  }
  return {
    towardTrumpPoints: -(result.harrisVotes * 200) / result.totalVotes,
    towardHarrisPoints: (result.trumpVotes * 200) / result.totalVotes,
  };
}

export function thirdPartyShiftBounds(
  result: Pick<
    BehaviorModelUnit,
    | "harrisVotes"
    | "trumpVotes"
    | "steinVotes"
    | "oliverVotes"
    | "residualOtherVotes"
    | "totalVotes"
  >,
  candidate: ThirdPartyCandidate,
  harrisExchangeShare: number,
): ThirdPartyShiftBounds {
  if (!Number.isSafeInteger(result.totalVotes) || result.totalVotes <= 0) {
    throw new Error("Third-party bounds require a positive safe-integer ballot total");
  }
  const candidateVotes = result[thirdPartyVoteKey(candidate)];
  if (![result.harrisVotes, result.trumpVotes, candidateVotes]
    .every((votes) => Number.isSafeInteger(votes) && votes >= 0)) {
    throw new Error("Third-party bounds require valid candidate vote totals");
  }
  if (!Number.isFinite(harrisExchangeShare)
    || harrisExchangeShare < 0
    || harrisExchangeShare > 1) {
    throw new Error("Third-party Harris exchange share must be between zero and one");
  }
  const exchangeCapacity = thirdPartyGainCapacity(
    result.harrisVotes,
    result.trumpVotes,
    harrisExchangeShare,
  );
  return {
    towardZeroPoints: -(candidateVotes * 100) / result.totalVotes,
    towardMaximumPoints: (exchangeCapacity * 100) / result.totalVotes,
  };
}

export function deriveBehaviorContributions(
  baselineUnits: readonly BehaviorModelUnit[],
  scenarioUnits: readonly BehaviorScenarioUnit[],
): BehaviorContribution[] {
  const baselineById = behaviorBaselineIndex(baselineUnits);
  if (scenarioUnits.length !== baselineUnits.length) {
    throw new Error("Behavior contribution inputs must contain the same units");
  }

  let sameOrder = true;
  for (let index = 0; index < scenarioUnits.length; index += 1) {
    if (scenarioUnits[index].id !== baselineUnits[index].id) {
      sameOrder = false;
      break;
    }
  }
  const contributions = scenarioUnits.map((unit, index) => {
    const baseline = sameOrder ? baselineUnits[index] : baselineById.get(unit.id);
    if (!baseline) throw new Error(`Scenario unit ${unit.id} is missing from the baseline`);
    const harrisDelta = unit.harrisVotes - baseline.harrisVotes;
    const trumpDelta = unit.trumpVotes - baseline.trumpVotes;
    return {
      id: unit.id,
      countyFips: unit.countyFips,
      geometryId: unit.geometryId,
      harrisDelta,
      trumpDelta,
      otherDelta: unit.otherVotes - baseline.otherVotes,
      ballotDelta: unit.totalVotes - baseline.totalVotes,
      marginDelta: harrisDelta - trumpDelta,
    };
  });
  if (!sameOrder) {
    const scenarioIds = new Set(scenarioUnits.map((unit) => unit.id));
    if (scenarioIds.size !== scenarioUnits.length
      || baselineUnits.some((unit) => !scenarioIds.has(unit.id))) {
      throw new Error("Behavior contribution inputs must contain each unit exactly once");
    }
  }
  return contributions;
}

function proportionalAllocation(weights: readonly number[], requiredTotal: number) {
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (requiredTotal === 0) return weights.map(() => 0);
  if (weightTotal <= 0) throw new Error("Positive allocation requires a positive weight");
  return largestRemainder(
    weights.map((weight) => (weight / weightTotal) * requiredTotal),
    requiredTotal,
  );
}

export function allocateCappedProportionally(
  weights: readonly number[],
  capacities: readonly number[],
  requiredTotal: number,
) {
  if (weights.length !== capacities.length) {
    throw new Error("Weights and capacities must have the same length");
  }
  if (!Number.isSafeInteger(requiredTotal) || requiredTotal < 0) {
    throw new Error("Required allocation must be a non-negative safe integer");
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Allocation weights must be finite and non-negative");
  }
  if (capacities.some((capacity) => !Number.isSafeInteger(capacity) || capacity < 0)) {
    throw new Error("Allocation capacities must be non-negative safe integers");
  }

  const capacityTotal = capacities.reduce((sum, capacity) => sum + capacity, 0);
  if (requiredTotal > capacityTotal) {
    throw new Error(`Required allocation ${requiredTotal} exceeds capacity ${capacityTotal}`);
  }
  if (weights.every((weight, index) => weight === capacities[index])) {
    return proportionalAllocation(weights, requiredTotal);
  }
  const allocation = weights.map(() => 0);
  let remaining = requiredTotal;

  while (remaining > 0) {
    const active = weights
      .map((weight, index) => ({ index, weight }))
      .filter(({ index, weight }) => weight > 0 && allocation[index] < capacities[index]);
    if (active.length === 0) {
      throw new Error(`Unable to place ${remaining} votes within the supplied capacities`);
    }
    const proposed = proportionalAllocation(
      active.map(({ weight }) => weight),
      remaining,
    );
    let overflow = 0;
    active.forEach(({ index }, activeIndex) => {
      const available = capacities[index] - allocation[index];
      const placed = Math.min(available, proposed[activeIndex]);
      allocation[index] += placed;
      overflow += proposed[activeIndex] - placed;
    });
    remaining = overflow;
  }
  return allocation;
}

export function applyBehaviorScenario(
  baselineUnits: readonly BehaviorModelUnit[],
  settings: BehaviorScenarioSettings,
): BehaviorScenarioResult {
  if (!Number.isFinite(settings.turnoutIncreasePoints)
    || settings.turnoutIncreasePoints < 0
    || settings.turnoutIncreasePoints > 100) {
    throw new Error("Turnout increase must be between zero and 100 points");
  }
  if (!Number.isFinite(settings.addedVoterHarrisShare)
    || settings.addedVoterHarrisShare < 0
    || settings.addedVoterHarrisShare > 1) {
    throw new Error("Added-voter Harris share must be between zero and one");
  }
  if (!Number.isFinite(settings.preferenceShiftPoints)) {
    throw new Error("Preference shift must be finite");
  }
  if (!["stein", "oliver", "residual_other"].includes(settings.thirdPartyCandidate)) {
    throw new Error("Third-party candidate is invalid");
  }
  if (!Number.isFinite(settings.thirdPartyShiftPoints)) {
    throw new Error("Third-party shift must be finite");
  }
  if (!Number.isFinite(settings.thirdPartyHarrisExchangeShare)
    || settings.thirdPartyHarrisExchangeShare < 0
    || settings.thirdPartyHarrisExchangeShare > 1) {
    throw new Error("Third-party Harris exchange share must be between zero and one");
  }

  const baselineProfile = behaviorBaselineProfile(baselineUnits);
  const { denominator, capacity } = baselineProfile;
  const requestedVotes = Math.round(denominator * settings.turnoutIncreasePoints / 100);
  const addedVotes = Math.min(requestedVotes, capacity);
  const turnoutAllocation = allocateCappedProportionally(
    baselineProfile.turnoutWeights,
    baselineProfile.turnoutCapacities,
    addedVotes,
  );
  const harrisTurnoutTotal = Math.round(addedVotes * settings.addedVoterHarrisShare);
  const harrisTurnoutAllocation = allocateCappedProportionally(
    turnoutAllocation,
    turnoutAllocation,
    harrisTurnoutTotal,
  );
  const afterTurnout = baselineUnits.map((unit, index) => {
    const turnoutAddedVotes = turnoutAllocation[index];
    const turnoutHarrisVotes = harrisTurnoutAllocation[index];
    const turnoutTrumpVotes = turnoutAddedVotes - turnoutHarrisVotes;
    return {
      ...unit,
      harrisVotes: unit.harrisVotes + turnoutHarrisVotes,
      trumpVotes: unit.trumpVotes + turnoutTrumpVotes,
      totalVotes: unit.totalVotes + turnoutAddedVotes,
      turnoutAddedVotes,
      turnoutHarrisVotes,
      turnoutTrumpVotes,
    };
  });

  const scenarioBallots = afterTurnout.reduce((sum, unit) => sum + unit.totalVotes, 0);
  const requestedTransfer = Math.round(
    scenarioBallots * settings.preferenceShiftPoints / 200,
  );
  const afterPreference = applyTwoPartyVoteTransfer(afterTurnout, requestedTransfer);
  const preferenceRealizedTransfer = afterPreference.reduce(
    (sum, unit) => sum + unit.netHarrisGain,
    0,
  );
  const selectedVoteKey = thirdPartyVoteKey(settings.thirdPartyCandidate);
  const preThirdPartyTotals = {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    totalVotes: 0,
  };
  for (const unit of afterPreference) {
    preThirdPartyTotals.harrisVotes += unit.harrisVotes;
    preThirdPartyTotals.trumpVotes += unit.trumpVotes;
    preThirdPartyTotals.steinVotes += unit.steinVotes;
    preThirdPartyTotals.oliverVotes += unit.oliverVotes;
    preThirdPartyTotals.residualOtherVotes += unit.residualOtherVotes;
    preThirdPartyTotals.totalVotes += unit.totalVotes;
  }
  const requestedCandidateDelta = Math.round(
    scenarioBallots * settings.thirdPartyShiftPoints / 100,
  );
  const harrisExchangeShare = settings.thirdPartyHarrisExchangeShare;
  const gainCapacity = thirdPartyGainCapacity(
    preThirdPartyTotals.harrisVotes,
    preThirdPartyTotals.trumpVotes,
    harrisExchangeShare,
  );
  const currentCandidateVotes = preThirdPartyTotals[selectedVoteKey];
  const realizedCandidateDelta = requestedCandidateDelta >= 0
    ? Math.min(requestedCandidateDelta, gainCapacity)
    : -Math.min(Math.abs(requestedCandidateDelta), currentCandidateVotes);

  let harrisVoteDelta = 0;
  let trumpVoteDelta = 0;
  let units: BehaviorScenarioUnit[];
  if (realizedCandidateDelta > 0) {
    const exchange = splitThirdPartyExchange(
      realizedCandidateDelta,
      harrisExchangeShare,
    );
    const harrisLossTotal = exchange.harrisVotes;
    const trumpLossTotal = exchange.trumpVotes;
    const harrisLosses = allocateCappedProportionally(
      afterPreference.map((unit) => unit.harrisVotes),
      afterPreference.map((unit) => unit.harrisVotes),
      harrisLossTotal,
    );
    const trumpLosses = allocateCappedProportionally(
      afterPreference.map((unit) => unit.trumpVotes),
      afterPreference.map((unit) => unit.trumpVotes),
      trumpLossTotal,
    );
    harrisVoteDelta = -harrisLossTotal;
    trumpVoteDelta = -trumpLossTotal;
    units = afterPreference.map((unit, index) => {
      const candidateGain = harrisLosses[index] + trumpLosses[index];
      const namedThirdPartyVotes = {
        steinVotes: unit.steinVotes,
        oliverVotes: unit.oliverVotes,
        residualOtherVotes: unit.residualOtherVotes,
        [selectedVoteKey]: unit[selectedVoteKey] + candidateGain,
      };
      return {
        ...unit,
        ...namedThirdPartyVotes,
        harrisVotes: unit.harrisVotes - harrisLosses[index],
        trumpVotes: unit.trumpVotes - trumpLosses[index],
        otherVotes: unit.otherVotes + candidateGain,
        preferenceNetHarrisGain: unit.netHarrisGain,
        thirdPartyCandidateDelta: candidateGain,
        netHarrisGain:
          unit.harrisVotes - harrisLosses[index] - baselineUnits[index].harrisVotes,
      };
    });
  } else if (realizedCandidateDelta < 0) {
    const releasedVotes = Math.abs(realizedCandidateDelta);
    const candidateLosses = allocateCappedProportionally(
      afterPreference.map((unit) => unit[selectedVoteKey]),
      afterPreference.map((unit) => unit[selectedVoteKey]),
      releasedVotes,
    );
    const harrisGainTotal = splitThirdPartyExchange(
      releasedVotes,
      harrisExchangeShare,
    ).harrisVotes;
    const harrisGains = allocateCappedProportionally(
      candidateLosses,
      candidateLosses,
      harrisGainTotal,
    );
    harrisVoteDelta = harrisGainTotal;
    trumpVoteDelta = releasedVotes - harrisGainTotal;
    units = afterPreference.map((unit, index) => {
      const candidateLoss = candidateLosses[index];
      const trumpGain = candidateLoss - harrisGains[index];
      const namedThirdPartyVotes = {
        steinVotes: unit.steinVotes,
        oliverVotes: unit.oliverVotes,
        residualOtherVotes: unit.residualOtherVotes,
        [selectedVoteKey]: unit[selectedVoteKey] - candidateLoss,
      };
      return {
        ...unit,
        ...namedThirdPartyVotes,
        harrisVotes: unit.harrisVotes + harrisGains[index],
        trumpVotes: unit.trumpVotes + trumpGain,
        otherVotes: unit.otherVotes - candidateLoss,
        preferenceNetHarrisGain: unit.netHarrisGain,
        thirdPartyCandidateDelta: -candidateLoss,
        netHarrisGain:
          unit.harrisVotes + harrisGains[index] - baselineUnits[index].harrisVotes,
      };
    });
  } else {
    units = afterPreference.map((unit, index) => ({
      ...unit,
      preferenceNetHarrisGain: unit.netHarrisGain,
      thirdPartyCandidateDelta: 0,
      netHarrisGain: unit.harrisVotes - baselineUnits[index].harrisVotes,
    }));
  }
  const totals = {
    harrisVotes: 0,
    trumpVotes: 0,
    steinVotes: 0,
    oliverVotes: 0,
    residualOtherVotes: 0,
    otherVotes: 0,
    totalVotes: 0,
  };
  for (const unit of units) {
    totals.harrisVotes += unit.harrisVotes;
    totals.trumpVotes += unit.trumpVotes;
    totals.steinVotes += unit.steinVotes;
    totals.oliverVotes += unit.oliverVotes;
    totals.residualOtherVotes += unit.residualOtherVotes;
    totals.otherVotes += unit.otherVotes;
    totals.totalVotes += unit.totalVotes;
  }

  for (const unit of units) {
    if ([
      unit.harrisVotes,
      unit.trumpVotes,
      unit.steinVotes,
      unit.oliverVotes,
      unit.residualOtherVotes,
      unit.otherVotes,
      unit.totalVotes,
    ].some((votes) => !Number.isSafeInteger(votes) || votes < 0)) {
      throw new Error(`${unit.id} scenario contains invalid candidate votes`);
    }
    if (unit.steinVotes + unit.oliverVotes + unit.residualOtherVotes !== unit.otherVotes
      || unit.harrisVotes + unit.trumpVotes + unit.otherVotes !== unit.totalVotes) {
      throw new Error(`${unit.id} scenario votes do not reconcile`);
    }
  }

  return {
    units,
    totals,
    turnout: {
      requestedVotes,
      addedVotes,
      harrisVotes: harrisTurnoutTotal,
      trumpVotes: addedVotes - harrisTurnoutTotal,
      denominator,
      capacity,
    },
    preference: { requestedTransfer, realizedTransfer: preferenceRealizedTransfer },
    thirdParty: {
      candidate: settings.thirdPartyCandidate,
      startingCandidateVotes: currentCandidateVotes,
      exchangeCapacity: gainCapacity,
      ballotTotal: scenarioBallots,
      requestedCandidateDelta,
      realizedCandidateDelta,
      harrisVoteDelta,
      trumpVoteDelta,
    },
  };
}

export function applyTwoPartyVoteTransfer<T extends TwoPartyResult>(
  results: readonly T[],
  signedTransferTowardHarris: number,
): Array<T & { netHarrisGain: number }> {
  if (!Number.isSafeInteger(signedTransferTowardHarris)) {
    throw new Error("Two-party vote transfer must be a safe integer");
  }

  const towardHarris = signedTransferTowardHarris >= 0;
  const requestedTransfer = Math.abs(signedTransferTowardHarris);
  const availableByResult = results.map((result) => (
    towardHarris ? result.trumpVotes : result.harrisVotes
  ));
  const availableTotal = availableByResult.reduce((sum, votes) => sum + votes, 0);
  const transfer = Math.min(requestedTransfer, availableTotal);
  const allocation = largestRemainder(
    availableTotal === 0
      ? results.map(() => 0)
      : availableByResult.map((votes) => (votes / availableTotal) * transfer),
    transfer,
  );

  return results.map((result, index) => {
    const netHarrisGain = towardHarris ? allocation[index] : -allocation[index];
    return {
      ...result,
      harrisVotes: result.harrisVotes + netHarrisGain,
      trumpVotes: result.trumpVotes - netHarrisGain,
      netHarrisGain,
    };
  });
}

export function aggregateNational(
  states: readonly StatewidePresidentialResult[],
): NationalPresidentialResult {
  return states.reduce<NationalPresidentialResult>(
    (total, state) => ({
      totalVotes: total.totalVotes + state.totalVotes,
      harrisVotes: total.harrisVotes + state.harrisVotes,
      trumpVotes: total.trumpVotes + state.trumpVotes,
      otherVotes: total.otherVotes + state.otherVotes,
      harrisElectoralVotes: total.harrisElectoralVotes + state.harrisElectoralVotes,
      trumpElectoralVotes: total.trumpElectoralVotes + state.trumpElectoralVotes,
    }),
    {
      totalVotes: 0,
      harrisVotes: 0,
      trumpVotes: 0,
      otherVotes: 0,
      harrisElectoralVotes: 0,
      trumpElectoralVotes: 0,
    },
  );
}

export function applyTwoPartyMarginShift(
  result: StatewidePresidentialResult,
  shiftTowardHarrisPoints: number,
): StatewidePresidentialResult {
  if (!Number.isFinite(shiftTowardHarrisPoints)) {
    throw new Error("Margin shift must be finite");
  }

  const requestedTransfer = Math.round(
    (result.totalVotes * shiftTowardHarrisPoints) / 200,
  );
  const transfer = Math.max(
    -result.harrisVotes,
    Math.min(result.trumpVotes, requestedTransfer),
  );
  const harrisVotes = result.harrisVotes + transfer;
  const trumpVotes = result.trumpVotes - transfer;
  const harrisWins = harrisVotes > trumpVotes;

  return {
    ...result,
    harrisVotes,
    trumpVotes,
    harrisElectoralVotes: harrisWins
      ? result.harrisElectoralVotes + result.trumpElectoralVotes
      : 0,
    trumpElectoralVotes: harrisWins
      ? 0
      : result.harrisElectoralVotes + result.trumpElectoralVotes,
  };
}

export function applyCountyTwoPartyMarginShift(
  counties: readonly CountyPresidentialResult[],
  statewideResult: StatewidePresidentialResult,
  shiftTowardHarrisPoints: number,
): CountyScenarioResult[] {
  if (!Number.isFinite(shiftTowardHarrisPoints)) {
    throw new Error("Margin shift must be finite");
  }

  const requestedTransfer = Math.round(
    Math.abs((statewideResult.totalVotes * shiftTowardHarrisPoints) / 200),
  );
  const signedTransfer = shiftTowardHarrisPoints >= 0
    ? requestedTransfer
    : -requestedTransfer;
  return applyTwoPartyVoteTransfer(counties, signedTransfer);
}

export function toReportingUnitResult(
  result: StatewidePresidentialResult,
): ReportingUnitResult {
  const votes: CandidateVotes[] = [
    { candidateId: "harris", partyId: "democratic", votes: result.harrisVotes },
    { candidateId: "trump", partyId: "republican", votes: result.trumpVotes },
    { candidateId: "other", partyId: null, votes: result.otherVotes },
  ];
  const unit: ReportingUnitResult = {
    reportingUnitId: `state-${result.code.toLowerCase()}`,
    contestId: "2024-president",
    votes,
    totalVotes: result.totalVotes,
    ballotMode: null,
  };
  assertResultReconciles(unit);
  return unit;
}
