import {
  canonicalSerialize,
  canonicalStringCompare,
  type CanonicalValue,
} from "../../election-replay/src/canonical.ts";
import { isSha256Fingerprint, sha256Fingerprint } from "../../election-replay/src/hash.ts";
import {
  ANALYTIC_REGISTRY_VERSION,
  getAnalyticDefinition,
  type AnalyticDefinitionId,
  type AnalyticSemanticClass,
  type AnalyticTimeScope,
  type AnalyticUnit,
  type CandidateScopePolicy,
} from "./registry.ts";

export const ANALYTIC_ENVELOPE_SCHEMA_VERSION = "sandbox-analytic-envelope-v1" as const;
export const ANALYTIC_COLLECTION_SCHEMA_VERSION = "sandbox-analytic-collection-v1" as const;

export type AnalyticAvailability = "available" | "partial" | "unavailable";
export type AnalyticGeographyLevel = "national" | "state" | "county" | "reporting-unit";

export interface AnalyticGeography {
  level: AnalyticGeographyLevel;
  id: string;
}

export interface AnalyticOperand {
  label: string;
  value: number;
  unit: "votes" | "ballots" | "returns";
}

export interface AnalyticEnvelope {
  schemaVersion: typeof ANALYTIC_ENVELOPE_SCHEMA_VERSION;
  registryVersion: typeof ANALYTIC_REGISTRY_VERSION;
  definitionId: AnalyticDefinitionId;
  semanticClass: AnalyticSemanticClass;
  status: AnalyticAvailability;
  value: number | null;
  unit: AnalyticUnit;
  geography: AnalyticGeography;
  timeScope: AnalyticTimeScope;
  candidateScope: readonly string[];
  numerator: AnalyticOperand | null;
  denominator: AnalyticOperand | null;
  sourceIds: readonly string[];
  transformVersion: string;
  caveat: string | null;
}

export interface AnalyticCollection {
  schemaVersion: typeof ANALYTIC_COLLECTION_SCHEMA_VERSION;
  registryVersion: typeof ANALYTIC_REGISTRY_VERSION;
  analytics: readonly AnalyticEnvelope[];
}

export interface FingerprintedAnalyticCollection {
  collection: AnalyticCollection;
  fingerprint: string;
}

export interface CreateAnalyticEnvelopeInput {
  definitionId: AnalyticDefinitionId;
  status?: AnalyticAvailability;
  value: number | null;
  geography: AnalyticGeography;
  candidateScope: readonly string[];
  numerator?: AnalyticOperand | null;
  denominator?: AnalyticOperand | null;
  sourceIds: readonly string[];
  transformVersion: string;
  caveat?: string | null;
}

function deepFreeze<T>(value: T): T {
  if (value != null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function requireNonemptyText(value: string, label: string) {
  const normalized = value.normalize("NFC").trim();
  if (normalized.length === 0) throw new Error(`${label} must be nonempty`);
  return normalized;
}

function requireSafeInteger(value: number, label: string, nonnegative = false) {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) {
    throw new Error(`${label} must be ${nonnegative ? "a non-negative " : "a "}safe integer`);
  }
  return value;
}

function normalizeUniqueStrings(values: readonly string[], label: string, allowEmpty = false) {
  if (!allowEmpty && values.length === 0) throw new Error(`${label} must not be empty`);
  const normalized = values.map((value) => requireNonemptyText(value, label)).sort(canonicalStringCompare);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1] === normalized[index]) throw new Error(`${label} contains duplicates`);
  }
  return Object.freeze(normalized);
}

function validateCandidateScope(policy: CandidateScopePolicy, scope: readonly string[]) {
  if (policy === "all-candidates" && (scope.length !== 1 || scope[0] !== "all-candidates")) {
    throw new Error("Analytic requires the all-candidates scope");
  }
  if (policy === "one-candidate" && (scope.length !== 1 || scope[0] === "all-candidates")) {
    throw new Error("Analytic requires exactly one candidate");
  }
  if (policy === "harris-trump" && (
    scope.length !== 2 || scope[0] !== "harris" || scope[1] !== "trump"
  )) {
    throw new Error("Analytic requires the Harris-Trump candidate scope");
  }
  if (policy === "target-candidate" && (
    scope.length !== 1 || (scope[0] !== "harris" && scope[0] !== "trump")
  )) {
    throw new Error("Analytic requires one major-party target candidate");
  }
  if (policy === "explicit" && (scope.length === 0 || scope.includes("all-candidates"))) {
    throw new Error("Analytic requires an explicit candidate scope");
  }
}

function normalizeOperand(operand: AnalyticOperand | null | undefined, label: string) {
  if (operand == null) return null;
  if (!(["votes", "ballots", "returns"] as const).includes(operand.unit)) {
    throw new Error(`${label} unit is invalid`);
  }
  return Object.freeze({
    label: requireNonemptyText(operand.label, `${label} label`),
    value: requireSafeInteger(operand.value, `${label} value`, true),
    unit: operand.unit,
  });
}

function analyticIdentity(analytic: AnalyticEnvelope) {
  return [
    analytic.definitionId,
    analytic.geography.level,
    analytic.geography.id,
    analytic.candidateScope.join(","),
  ].join("/");
}

export function createAnalyticEnvelope(input: CreateAnalyticEnvelopeInput): AnalyticEnvelope {
  const definition = getAnalyticDefinition(input.definitionId);
  const status = input.status ?? "available";
  if (!(["available", "partial", "unavailable"] as const).includes(status)) {
    throw new Error(`${definition.id} availability is invalid`);
  }
  if (status === "unavailable" && input.value !== null) {
    throw new Error("Unavailable analytics must have a null value");
  }
  if (status !== "unavailable" && input.value === null) {
    throw new Error("Available and partial analytics must have a numeric value");
  }
  if (input.value !== null) requireSafeInteger(input.value, `${definition.id} value`);

  const candidateScope = normalizeUniqueStrings(
    input.candidateScope,
    `${definition.id} candidate scope`,
  );
  validateCandidateScope(definition.candidateScopePolicy, candidateScope);
  const numerator = normalizeOperand(input.numerator, `${definition.id} numerator`);
  const denominator = normalizeOperand(input.denominator, `${definition.id} denominator`);
  if (definition.requiresRatioOperands && status !== "unavailable") {
    if (!numerator || !denominator || denominator.value <= 0) {
      throw new Error(`${definition.id} requires a positive explicit denominator`);
    }
    if (numerator.value > denominator.value) {
      throw new Error(`${definition.id} numerator cannot exceed its denominator`);
    }
    if (numerator.unit !== denominator.unit || numerator.unit !== definition.ratioOperandUnit) {
      throw new Error(`${definition.id} ratio operands must use ${definition.ratioOperandUnit}`);
    }
  }
  if (!definition.requiresRatioOperands && (numerator || denominator)) {
    throw new Error(`${definition.id} does not accept ratio operands`);
  }

  if (!(["national", "state", "county", "reporting-unit"] as const).includes(input.geography.level)) {
    throw new Error(`${definition.id} geography level is invalid`);
  }

  return deepFreeze({
    schemaVersion: ANALYTIC_ENVELOPE_SCHEMA_VERSION,
    registryVersion: ANALYTIC_REGISTRY_VERSION,
    definitionId: input.definitionId,
    semanticClass: definition.semanticClass,
    status,
    value: input.value,
    unit: definition.unit,
    geography: {
      level: input.geography.level,
      id: requireNonemptyText(input.geography.id, `${definition.id} geography identity`),
    },
    timeScope: definition.timeScope,
    candidateScope,
    numerator,
    denominator,
    sourceIds: normalizeUniqueStrings(input.sourceIds, `${definition.id} source identities`),
    transformVersion: requireNonemptyText(input.transformVersion, `${definition.id} transform version`),
    caveat: input.caveat == null ? null : requireNonemptyText(input.caveat, `${definition.id} caveat`),
  });
}

export function createRatioAnalyticEnvelope(
  input: Omit<CreateAnalyticEnvelopeInput, "value" | "numerator" | "denominator"> & {
    numerator: AnalyticOperand;
    denominator: AnalyticOperand;
  },
) {
  requireSafeInteger(input.numerator.value, "Ratio numerator", true);
  requireSafeInteger(input.denominator.value, "Ratio denominator", true);
  if (input.denominator.value <= 0) throw new Error("Ratio denominator must be positive");
  if (input.numerator.value > input.denominator.value) {
    throw new Error("Ratio numerator cannot exceed its denominator");
  }
  const scaledNumerator = BigInt(input.numerator.value) * 1_000_000n;
  const denominator = BigInt(input.denominator.value);
  const roundedPartsPerMillion = Number(
    (scaledNumerator * 2n + denominator) / (denominator * 2n),
  );
  return createAnalyticEnvelope({
    ...input,
    value: roundedPartsPerMillion,
  });
}

export function validateAnalyticEnvelope(analytic: AnalyticEnvelope) {
  const recreated = createAnalyticEnvelope({
    definitionId: analytic.definitionId,
    status: analytic.status,
    value: analytic.value,
    geography: analytic.geography,
    candidateScope: analytic.candidateScope,
    numerator: analytic.numerator,
    denominator: analytic.denominator,
    sourceIds: analytic.sourceIds,
    transformVersion: analytic.transformVersion,
    caveat: analytic.caveat,
  });
  if (canonicalSerialize(recreated as unknown as CanonicalValue)
    !== canonicalSerialize(analytic as unknown as CanonicalValue)) {
    throw new Error("Analytic envelope contains noncanonical or registry-incompatible content");
  }
  return recreated;
}

export function createAnalyticCollection(analytics: readonly AnalyticEnvelope[]): AnalyticCollection {
  if (analytics.length === 0) throw new Error("Analytic collection must not be empty");
  const validated = analytics.map(validateAnalyticEnvelope).sort((left, right) => (
    canonicalStringCompare(analyticIdentity(left), analyticIdentity(right))
  ));
  for (let index = 1; index < validated.length; index += 1) {
    if (analyticIdentity(validated[index - 1]) === analyticIdentity(validated[index])) {
      throw new Error(`Duplicate analytic identity ${analyticIdentity(validated[index])}`);
    }
  }
  return deepFreeze({
    schemaVersion: ANALYTIC_COLLECTION_SCHEMA_VERSION,
    registryVersion: ANALYTIC_REGISTRY_VERSION,
    analytics: validated,
  });
}

export function serializeAnalyticCollection(collection: AnalyticCollection) {
  return canonicalSerialize(createAnalyticCollection(collection.analytics) as unknown as CanonicalValue);
}

export async function fingerprintAnalyticCollection(
  analytics: readonly AnalyticEnvelope[],
): Promise<FingerprintedAnalyticCollection> {
  const collection = createAnalyticCollection(analytics);
  return deepFreeze({
    collection,
    fingerprint: await sha256Fingerprint(
      canonicalSerialize(collection as unknown as CanonicalValue),
    ),
  });
}

export function serializeFingerprintedAnalyticCollection(
  collection: FingerprintedAnalyticCollection,
) {
  return canonicalSerialize(collection as unknown as CanonicalValue);
}

export async function deserializeFingerprintedAnalyticCollection(serialized: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("Analytic collection is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Analytic collection is malformed");
  const candidate = parsed as FingerprintedAnalyticCollection;
  if (!isSha256Fingerprint(candidate.fingerprint)) {
    throw new Error("Analytic collection fingerprint is invalid");
  }
  const expected = await fingerprintAnalyticCollection(candidate.collection?.analytics ?? []);
  if (canonicalSerialize(expected as unknown as CanonicalValue)
    !== canonicalSerialize(candidate as unknown as CanonicalValue)) {
    throw new Error("Analytic collection fingerprint or content is invalid");
  }
  return expected;
}
