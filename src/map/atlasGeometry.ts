import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import countiesTopology from "us-atlas/counties-albers-10m.json";
import statesTopology from "us-atlas/states-albers-10m.json";

type TopologySource = Parameters<typeof feature>[0];
type TopologyGeometry = Parameters<typeof feature>[1];

export type AtlasViewState = {
  target: [number, number, number];
  zoom: number;
  rotationX: number;
  rotationOrbit: number;
};

export const NATIONAL_VIEW: AtlasViewState = {
  target: [480, 300, 0],
  zoom: -0.28,
  rotationX: 47,
  rotationOrbit: 0,
};

export const atlasController = {
  dragRotate: true,
  doubleClickZoom: false,
  inertia: true,
} as const;

export const stateFipsByCode: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54",
  WI: "55", WY: "56",
};

export const stateCodeByFips = Object.fromEntries(
  Object.entries(stateFipsByCode).map(([code, fips]) => [fips, code]),
) as Record<string, string>;

function flipScreenY(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    return [value[0], 600 - value[1], ...value.slice(2)];
  }
  return value.map(flipScreenY);
}

function orientForOrbitView(collection: FeatureCollection): FeatureCollection {
  return {
    ...collection,
    features: collection.features.map((item) => {
      const geometry = item.geometry as Geometry & { coordinates?: unknown };
      if (!geometry || !("coordinates" in geometry)) return item;
      return {
        ...item,
        geometry: { ...geometry, coordinates: flipScreenY(geometry.coordinates) },
      } as Feature;
    }),
  };
}

function topologyToFeatures(topology: unknown, objectName: string): FeatureCollection {
  const source = topology as TopologySource;
  const object = (source.objects as Record<string, TopologyGeometry | undefined>)[objectName];
  if (!object) return { type: "FeatureCollection", features: [] };
  return orientForOrbitView(feature(source, object) as unknown as FeatureCollection);
}

export const stateFeatures = topologyToFeatures(statesTopology, "states");
export const countyFeatures = topologyToFeatures(countiesTopology, "counties");

export function normalizedFips(value: unknown, length: number) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return String(Math.trunc(numeric)).padStart(length, "0");
}

export function featureFips(item: Feature, length: number) {
  const properties = item.properties as Record<string, unknown> | null;
  return normalizedFips(item.id ?? properties?.GEOID, length) ?? "";
}

function visitCoordinates(value: unknown, callback: (x: number, y: number) => void): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    callback(value[0], value[1]);
    return;
  }
  value.forEach((child) => visitCoordinates(child, callback));
}

export function featureBounds(item: Feature) {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  visitCoordinates((item.geometry as Geometry & { coordinates?: unknown })?.coordinates, (x, y) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  });
  return bounds;
}
