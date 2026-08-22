export const NATIONAL_REPLAY_CLOCK_CONTRACT_VERSION = "us-2024-poll-close-eligibility-v1" as const;

export interface NationalJurisdictionClockRule {
  jurisdictionId: string;
  timeZone: string;
  pollCloseInstant: string;
  returnEligibilityInstant: string;
  eligibilityBasis: "single-boundary" | "latest-coarse-atomic-close";
}

function clock(
  jurisdictionId: string,
  timeZone: string,
  pollCloseInstant: string,
  returnEligibilityInstant = pollCloseInstant,
): NationalJurisdictionClockRule {
  return Object.freeze({
    jurisdictionId,
    timeZone,
    pollCloseInstant,
    returnEligibilityInstant,
    eligibilityBasis: pollCloseInstant === returnEligibilityInstant
      ? "single-boundary"
      : "latest-coarse-atomic-close",
  });
}

// Versioned 2024 general-election clock contract. pollCloseInstant is the first
// applicable legal closing boundary represented by the jurisdiction clock.
// A coarse statewide return is held until returnEligibilityInstant, the latest
// closing boundary represented by that indivisible statewide total.
export const NATIONAL_REPLAY_CLOCKS: readonly NationalJurisdictionClockRule[] = Object.freeze([
  clock("AL", "America/Chicago", "2024-11-06T01:00:00.000Z"),
  clock("AK", "America/Anchorage", "2024-11-06T05:00:00.000Z", "2024-11-06T06:00:00.000Z"),
  clock("AZ", "America/Phoenix", "2024-11-06T02:00:00.000Z"),
  clock("AR", "America/Chicago", "2024-11-06T01:30:00.000Z"),
  clock("CA", "America/Los_Angeles", "2024-11-06T04:00:00.000Z"),
  clock("CO", "America/Denver", "2024-11-06T02:00:00.000Z"),
  clock("CT", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("DE", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("DC", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("FL", "America/New_York", "2024-11-06T00:00:00.000Z", "2024-11-06T01:00:00.000Z"),
  clock("GA", "America/New_York", "2024-11-06T00:00:00.000Z"),
  clock("HI", "Pacific/Honolulu", "2024-11-06T05:00:00.000Z"),
  clock("ID", "America/Denver", "2024-11-06T03:00:00.000Z", "2024-11-06T04:00:00.000Z"),
  clock("IL", "America/Chicago", "2024-11-06T01:00:00.000Z"),
  clock("IN", "America/Indiana/Indianapolis", "2024-11-05T23:00:00.000Z", "2024-11-06T00:00:00.000Z"),
  clock("IA", "America/Chicago", "2024-11-06T02:00:00.000Z"),
  clock("KS", "America/Chicago", "2024-11-06T01:00:00.000Z", "2024-11-06T02:00:00.000Z"),
  clock("KY", "America/Kentucky/Louisville", "2024-11-05T23:00:00.000Z", "2024-11-06T00:00:00.000Z"),
  clock("LA", "America/Chicago", "2024-11-06T02:00:00.000Z"),
  clock("ME", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("MD", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("MA", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("MI", "America/Detroit", "2024-11-06T01:00:00.000Z"),
  clock("MN", "America/Chicago", "2024-11-06T02:00:00.000Z"),
  clock("MS", "America/Chicago", "2024-11-06T01:00:00.000Z"),
  clock("MO", "America/Chicago", "2024-11-06T01:00:00.000Z"),
  clock("MT", "America/Denver", "2024-11-06T03:00:00.000Z"),
  clock("NE", "America/Chicago", "2024-11-06T02:00:00.000Z"),
  clock("NV", "America/Los_Angeles", "2024-11-06T03:00:00.000Z"),
  clock("NH", "America/New_York", "2024-11-06T00:00:00.000Z", "2024-11-06T01:00:00.000Z"),
  clock("NJ", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("NM", "America/Denver", "2024-11-06T02:00:00.000Z"),
  clock("NY", "America/New_York", "2024-11-06T02:00:00.000Z"),
  clock("NC", "America/New_York", "2024-11-06T00:30:00.000Z"),
  clock("ND", "America/Chicago", "2024-11-06T01:00:00.000Z", "2024-11-06T02:00:00.000Z"),
  clock("OH", "America/New_York", "2024-11-06T00:30:00.000Z"),
  clock("OK", "America/Chicago", "2024-11-06T01:00:00.000Z"),
  clock("OR", "America/Denver", "2024-11-06T03:00:00.000Z", "2024-11-06T04:00:00.000Z"),
  clock("PA", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("RI", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("SC", "America/New_York", "2024-11-06T00:00:00.000Z"),
  clock("SD", "America/Chicago", "2024-11-06T01:00:00.000Z", "2024-11-06T02:00:00.000Z"),
  clock("TN", "America/New_York", "2024-11-06T01:00:00.000Z"),
  clock("TX", "America/Chicago", "2024-11-06T01:00:00.000Z", "2024-11-06T02:00:00.000Z"),
  clock("UT", "America/Denver", "2024-11-06T03:00:00.000Z"),
  clock("VT", "America/New_York", "2024-11-06T00:00:00.000Z"),
  clock("VA", "America/New_York", "2024-11-06T00:00:00.000Z"),
  clock("WA", "America/Los_Angeles", "2024-11-06T04:00:00.000Z"),
  clock("WV", "America/New_York", "2024-11-06T00:30:00.000Z"),
  clock("WI", "America/Chicago", "2024-11-06T02:00:00.000Z"),
  clock("WY", "America/Denver", "2024-11-06T02:00:00.000Z"),
]);

export const NATIONAL_REPLAY_JURISDICTION_IDS = Object.freeze(
  NATIONAL_REPLAY_CLOCKS.map((entry) => entry.jurisdictionId),
);

export function nationalReplayClockFor(jurisdictionId: string) {
  const clockRule = NATIONAL_REPLAY_CLOCKS.find(
    (entry) => entry.jurisdictionId === jurisdictionId,
  );
  if (!clockRule) throw new Error(`National replay clock is missing ${jurisdictionId}`);
  return clockRule;
}
