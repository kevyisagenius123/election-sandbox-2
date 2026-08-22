const SHA256_PREFIX = "sha256:";

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is required for canonical replay fingerprints");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

export async function sha256Fingerprint(value: string) {
  return `${SHA256_PREFIX}${bytesToHex(await sha256Bytes(value))}`;
}

export function isSha256Fingerprint(value: string) {
  return /^sha256:[0-9a-f]{64}$/.test(value);
}
