import type { FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { DetailedStateManifest } from "./detailedStateManifest.ts";

type TopologySource = Parameters<typeof feature>[0];
type TopologyGeometry = Parameters<typeof feature>[1];

export interface DetailedPrecinctResultProperties {
  geoid: string;
  countyFips: string;
  vtdCode?: string;
  censusName?: string;
  precinctCode?: string;
  censusVtdCode?: string | null;
  precinctName?: string;
  sourceName: string | null;
  sourceUnitCount: number;
  resultQuality: string;
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

export interface DetailedPrecinctCountyManifest {
  countyFips: string;
  resultReportingUnitCount: number;
  matchedReportingUnitCount: number;
  unmatchedReportingUnitCount: number;
  geometryFeatureCount: number;
  matchedGeometryFeatureCount: number;
  unmatchedGeometryFeatureCount: number;
  resultVotes: VoteTotals;
  matchedVotes: VoteTotals;
  resultVoteCoveragePct: number;
  bounds: [number, number, number, number];
  dataUrl: string;
  byteSize: number;
}

interface DetailedPrecinctManifestDocument {
  stateCode: string;
  counties: DetailedPrecinctCountyManifest[];
}

export interface LoadedDetailedPrecinctCounty {
  metadata: DetailedPrecinctCountyManifest;
  features: FeatureCollection<Geometry, DetailedPrecinctResultProperties>;
}

const manifestCache = new Map<string, Promise<DetailedPrecinctManifestDocument>>();
const countyCache = new Map<string, LoadedDetailedPrecinctCounty>();

function publicUrl(path: string) {
  const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}

function loadManifest(manifest: DetailedStateManifest) {
  const key = manifest.code;
  let request = manifestCache.get(key);
  if (!request) {
    request = fetch(publicUrl(manifest.geography.precinctGeometryManifestPath))
      .then((response) => {
        if (!response.ok) throw new Error(`Precinct manifest request failed with ${response.status}`);
        return response.json() as Promise<DetailedPrecinctManifestDocument>;
      })
      .catch((error) => {
        manifestCache.delete(key);
        throw error;
      });
    manifestCache.set(key, request);
  }
  return request;
}

export async function loadDetailedPrecinctCounty(
  manifest: DetailedStateManifest,
  countyFips: string,
  signal?: AbortSignal,
): Promise<LoadedDetailedPrecinctCounty> {
  const key = `${manifest.code}:${countyFips}`;
  const cached = countyCache.get(key);
  if (cached) return cached;
  const document = await loadManifest(manifest);
  if (document.stateCode !== manifest.code) throw new Error("Precinct manifest state mismatch");
  const metadata = document.counties.find((county) => county.countyFips === countyFips);
  if (!metadata) throw new Error(`No ${manifest.name} precinct geometry for ${countyFips}`);
  const response = await fetch(publicUrl(metadata.dataUrl), { signal });
  if (!response.ok) throw new Error(`Precinct geometry request failed with ${response.status}`);
  const source = await response.json() as TopologySource;
  const object = (source.objects as Record<string, TopologyGeometry | undefined>).precincts;
  if (!object) throw new Error(`Precinct topology ${countyFips} has no precincts object`);
  const loaded = {
    metadata,
    features: feature(source, object) as unknown as FeatureCollection<Geometry, DetailedPrecinctResultProperties>,
  };
  countyCache.set(key, loaded);
  return loaded;
}

export function detailedPrecinctName(properties: DetailedPrecinctResultProperties) {
  return properties.precinctName || properties.censusName || properties.sourceName || properties.geoid;
}
