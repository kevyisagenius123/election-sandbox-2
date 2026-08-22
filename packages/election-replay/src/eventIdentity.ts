import { canonicalSerialize } from "./canonical.ts";
import { sha256Fingerprint } from "./hash.ts";
import type { ReplayEventIdentityInput, ReplayEventType } from "./contracts.ts";

const EVENT_TYPES = new Set<ReplayEventType>([
  "REPLAY_STARTED",
  "POLL_CLOSE",
  "REPORTING_OPENED",
  "RETURN_PUBLISHED",
  "RETURN_REPLACED",
  "COUNTY_STATUS_CHANGED",
  "LEAD_CHANGED",
  "OUTSTANDING_ESTIMATE_UPDATED",
  "CALL_STATUS_CHANGED",
  "ELECTORAL_SCORE_CHANGED",
  "PATH_STATUS_CHANGED",
  "REPLAY_COMPLETED",
]);

function requireIdentityString(value: string, label: string) {
  const normalized = value.normalize("NFC");
  if (normalized.length === 0) throw new Error(`${label} cannot be empty`);
  return normalized;
}

export async function deriveReplayEventId(input: ReplayEventIdentityInput) {
  if (!EVENT_TYPES.has(input.eventType)) {
    throw new Error(`Unknown replay event type ${input.eventType}`);
  }
  if (!Number.isSafeInteger(input.batchOrdinal) || input.batchOrdinal < 0) {
    throw new Error("Replay event batch ordinal must be a non-negative safe integer");
  }
  const identity = {
    replaySchemaVersion: requireIdentityString(
      input.replaySchemaVersion,
      "Replay schema version",
    ),
    jurisdictionId: requireIdentityString(input.jurisdictionId, "Jurisdiction identifier"),
    unitId: input.unitId == null
      ? null
      : requireIdentityString(input.unitId, "Reporting-unit identifier"),
    eventType: input.eventType,
    batchOrdinal: input.batchOrdinal,
  };
  const fingerprint = await sha256Fingerprint(canonicalSerialize(identity));
  return `event:${fingerprint.slice("sha256:".length)}`;
}
