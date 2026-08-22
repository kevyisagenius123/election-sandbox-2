export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

function compareCanonicalStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalString(value: string) {
  return JSON.stringify(value.normalize("NFC"));
}

function serialize(value: unknown, path: string): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return canonicalString(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${path} must be a finite safe integer for canonical serialization`);
    }
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (Array.isArray(value)) {
    const items = new Array<string>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new Error(`${path} cannot contain sparse array entries`);
      items[index] = serialize(value[index], `${path}[${index}]`);
    }
    return `[${items.join(",")}]`;
  }
  if (typeof value !== "object" || value == null) {
    throw new Error(`${path} contains an unsupported canonical value`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} must contain only plain objects`);
  }
  const normalizedEntries = Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => ({ key: key.normalize("NFC"), entry, originalKey: key }))
    .sort((left, right) => compareCanonicalStrings(left.key, right.key));
  for (let index = 1; index < normalizedEntries.length; index += 1) {
    if (normalizedEntries[index - 1].key === normalizedEntries[index].key) {
      throw new Error(
        `${path} has duplicate keys after Unicode normalization: `
        + `${normalizedEntries[index - 1].originalKey} and ${normalizedEntries[index].originalKey}`,
      );
    }
  }
  return `{${normalizedEntries.map(({ key, entry }) => (
    `${canonicalString(key)}:${serialize(entry, `${path}.${key}`)}`
  )).join(",")}}`;
}

export function canonicalSerialize(value: CanonicalValue) {
  return serialize(value, "$root");
}

export function canonicalStringCompare(left: string, right: string) {
  return compareCanonicalStrings(left.normalize("NFC"), right.normalize("NFC"));
}
