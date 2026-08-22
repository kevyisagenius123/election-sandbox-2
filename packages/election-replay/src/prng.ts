import { canonicalSerialize } from "./canonical.ts";
import { sha256Bytes } from "./hash.ts";

export const REPLAY_PRNG_VERSION = "rme-prng-sha256-xoshiro128ss-v1" as const;
export const XOSHIRO128_ALL_ZERO_FALLBACK = Object.freeze([
  0x6d2b79f5,
  0x1b56c4e9,
  0x9e3779b9,
  0x243f6a88,
]) as readonly number[];

export interface NamedReplayStreamDefinition {
  version: typeof REPLAY_PRNG_VERSION;
  rootSeed: string;
  namespace: string;
  streamName: string;
}

function rotateLeft(value: number, bits: number) {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

function uint32FromBigEndian(bytes: Uint8Array, offset: number) {
  return (
    ((bytes[offset] << 24) >>> 0)
    | (bytes[offset + 1] << 16)
    | (bytes[offset + 2] << 8)
    | bytes[offset + 3]
  ) >>> 0;
}

function seedHex(state: readonly number[]) {
  return state.map((value) => value.toString(16).padStart(8, "0")).join("");
}

export function normalizeXoshiro128State(state: readonly number[]) {
  if (
    state.length !== 4
    || state.some((value) => !Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff)
  ) {
    throw new Error("xoshiro128** state must contain four unsigned 32-bit integers");
  }
  return Object.freeze(
    state.every((value) => value === 0)
      ? [...XOSHIRO128_ALL_ZERO_FALLBACK]
      : [...state],
  ) as readonly number[];
}

export async function deriveNamedReplayStreamSeed(
  rootSeed: string,
  namespace: string,
  streamName: string,
) {
  const definition: NamedReplayStreamDefinition = {
    version: REPLAY_PRNG_VERSION,
    rootSeed: rootSeed.normalize("NFC"),
    namespace: namespace.normalize("NFC"),
    streamName: streamName.normalize("NFC"),
  };
  const digest = await sha256Bytes(canonicalSerialize([
    definition.version,
    definition.rootSeed,
    definition.namespace,
    definition.streamName,
  ]));
  const state: number[] = [0, 4, 8, 12]
    .map((offset) => uint32FromBigEndian(digest, offset));
  const normalizedState = normalizeXoshiro128State(state);
  return {
    definition: Object.freeze(definition),
    seedHex: seedHex(normalizedState),
    state: Object.freeze(normalizedState) as readonly number[],
  };
}

export interface NamedReplayRandomStream {
  readonly definition: Readonly<NamedReplayStreamDefinition>;
  readonly seedHex: string;
  nextUint32(): number;
  nextFloat(): number;
}

export async function createNamedReplayRandomStream(
  rootSeed: string,
  namespace: string,
  streamName: string,
): Promise<NamedReplayRandomStream> {
  const derived = await deriveNamedReplayStreamSeed(rootSeed, namespace, streamName);
  const state = [...derived.state];
  const nextUint32 = () => {
    const result = Math.imul(rotateLeft(Math.imul(state[1], 5) >>> 0, 7), 9) >>> 0;
    const shifted = (state[1] << 9) >>> 0;
    state[2] = (state[2] ^ state[0]) >>> 0;
    state[3] = (state[3] ^ state[1]) >>> 0;
    state[1] = (state[1] ^ state[2]) >>> 0;
    state[0] = (state[0] ^ state[3]) >>> 0;
    state[2] = (state[2] ^ shifted) >>> 0;
    state[3] = rotateLeft(state[3], 11);
    return result;
  };
  return {
    definition: derived.definition,
    seedHex: derived.seedHex,
    nextUint32,
    nextFloat() {
      return nextUint32() / 0x1_0000_0000;
    },
  };
}
