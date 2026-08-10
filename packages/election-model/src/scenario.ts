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

export type TwoPartyResult = {
  harrisVotes: number;
  trumpVotes: number;
};

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
