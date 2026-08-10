import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";

type TopologySource = Parameters<typeof feature>[0];
type TopologyGeometry = Parameters<typeof feature>[1];

export interface PrecinctResultProperties {
  geoid: string;
  countyFips: string;
  vtdCode: string;
  censusName: string;
  sourceName: string | null;
  sourceUnitCount: number;
  resultQuality: "official_exact_vtd" | "official_canonical_name" | "unmatched_geometry";
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  totalVotes: number;
}

interface VoteTotals {
  harrisVotes: number;
  trumpVotes: number;
  otherVotes: number;
  totalVotes: number;
}

export interface PennsylvaniaPrecinctCountyManifest {
  countyFips: string;
  resultReportingUnitCount: number;
  matchedReportingUnitCount: number;
  unmatchedReportingUnitCount: number;
  exactIdentifierMatchCount: number;
  canonicalNameMatchCount: number;
  geometryFeatureCount: number;
  matchedGeometryFeatureCount: number;
  unmatchedGeometryFeatureCount: number;
  duplicateGeometryMatchCount: number;
  resultVotes: VoteTotals;
  matchedVotes: VoteTotals;
  resultVoteCoveragePct: number;
  bounds: [number, number, number, number];
  dataUrl: string;
  byteSize: number;
}

interface PennsylvaniaPrecinctManifest {
  counties: PennsylvaniaPrecinctCountyManifest[];
}

export interface LoadedPennsylvaniaPrecinctCounty {
  metadata: PennsylvaniaPrecinctCountyManifest;
  features: FeatureCollection<Geometry, PrecinctResultProperties>;
}

let manifestCache: PennsylvaniaPrecinctManifest | null = null;
const countyCache = new Map<string, LoadedPennsylvaniaPrecinctCounty>();

function publicUrl(path: string) {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}

async function loadManifest(signal?: AbortSignal) {
  if (manifestCache) return manifestCache;
  const response = await fetch(publicUrl("data/pa/2024/precinct-geometry-manifest.json"), { signal });
  if (!response.ok) throw new Error(`Precinct manifest request failed with ${response.status}`);
  manifestCache = await response.json() as PennsylvaniaPrecinctManifest;
  return manifestCache;
}

export async function loadPennsylvaniaPrecinctCounty(
  countyFips: string,
  signal?: AbortSignal,
): Promise<LoadedPennsylvaniaPrecinctCounty> {
  const cached = countyCache.get(countyFips);
  if (cached) return cached;

  const manifest = await loadManifest(signal);
  const metadata = manifest.counties.find((county) => county.countyFips === countyFips);
  if (!metadata) throw new Error(`No Pennsylvania precinct geometry manifest entry for ${countyFips}`);

  const response = await fetch(publicUrl(metadata.dataUrl), { signal });
  if (!response.ok) throw new Error(`Precinct geometry request failed with ${response.status}`);
  const source = await response.json() as TopologySource;
  const object = (source.objects as Record<string, TopologyGeometry | undefined>).precincts;
  if (!object) throw new Error(`Precinct topology ${countyFips} has no precincts object`);

  const loaded = {
    metadata,
    features: feature(source, object) as unknown as FeatureCollection<Geometry, PrecinctResultProperties>,
  };
  countyCache.set(countyFips, loaded);
  return loaded;
}
