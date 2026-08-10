import type { CandidateVotes, ReportingUnitResult } from "../../data-contracts/src/index.ts";

export function assertNonNegativeIntegerVotes(votes: CandidateVotes[]) {
  for (const candidate of votes) {
    if (!Number.isSafeInteger(candidate.votes) || candidate.votes < 0) {
      throw new Error(`Invalid vote total for ${candidate.candidateId}`);
    }
  }
}

export function assertResultReconciles(result: ReportingUnitResult) {
  assertNonNegativeIntegerVotes(result.votes);
  const candidateTotal = result.votes.reduce((sum, candidate) => sum + candidate.votes, 0);
  if (candidateTotal !== result.totalVotes) {
    throw new Error(
      `${result.reportingUnitId} reports ${result.totalVotes} total votes but candidates sum to ${candidateTotal}`,
    );
  }
}

export function largestRemainder(values: number[], requiredTotal: number) {
  if (!Number.isSafeInteger(requiredTotal) || requiredTotal < 0) {
    throw new Error("requiredTotal must be a non-negative safe integer");
  }
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("values must be finite and non-negative");
  }

  const floors = values.map(Math.floor);
  const floorTotal = floors.reduce((sum, value) => sum + value, 0);
  const remaining = requiredTotal - floorTotal;

  if (remaining < 0 || remaining > values.length) {
    throw new Error("requiredTotal cannot be reconciled by largest remainder");
  }

  const ranked = values
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (let index = 0; index < remaining; index += 1) {
    floors[ranked[index].index] += 1;
  }
  return floors;
}

export function assertProbabilityVector(probabilities: number[], tolerance = 1e-9) {
  if (probabilities.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error("Candidate probabilities must be between zero and one");
  }
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > tolerance) {
    throw new Error(`Candidate probabilities sum to ${total}, not one`);
  }
}
