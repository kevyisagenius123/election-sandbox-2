export type MajorParty = "DEM" | "GOP";

export const ATLAS_NEUTRAL = "#dfe2da";

const bands = [
  { max: 1, dem: "#dde9df", gop: "#f1e4bc" },
  { max: 3, dem: "#c9e2e1", gop: "#f2da9c" },
  { max: 5, dem: "#b2d9de", gop: "#f3ce82" },
  { max: 10, dem: "#98cbd7", gop: "#f2be6d" },
  { max: 15, dem: "#7ebacf", gop: "#eeaa5e" },
  { max: 20, dem: "#67a9c5", gop: "#e99553" },
  { max: 30, dem: "#5195b8", gop: "#e17e4a" },
  { max: 40, dem: "#3d7fab", gop: "#d56743" },
  { max: 50, dem: "#2e699c", gop: "#c6503d" },
  { max: 60, dem: "#22558a", gop: "#b43d38" },
  { max: Number.POSITIVE_INFINITY, dem: "#173f74", gop: "#982f32" },
] as const;

export function atlasMarginColor(margin: number, party: MajorParty | null) {
  if (!party || !Number.isFinite(margin)) return ATLAS_NEUTRAL;
  const band = bands.find((entry) => Math.abs(margin) < entry.max) ?? bands.at(-1)!;
  return party === "DEM" ? band.dem : band.gop;
}

export function hexToDeckColor(hex: string, alpha = 255): [number, number, number, number] {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}
