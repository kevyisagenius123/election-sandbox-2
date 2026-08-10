export type DetailedStateCode = "PA";
export type DetailedStateRuntimeLoader = "pa-vtd-row-v1";

export interface DetailedStateManifest {
  schemaVersion: 1;
  code: DetailedStateCode;
  name: string;
  election: {
    year: number;
    contestId: string;
    electoralVotes: number;
  };
  compatibility: {
    dataVersion: string;
    engineVersion: string;
  };
  runtime: {
    loader: DetailedStateRuntimeLoader;
    artifactPath: string;
    schemaVersion: number;
    encoding: string;
  };
  geography: {
    countyFipsPrefix: string;
    precinctGeometryManifestPath: string;
  };
  sources: {
    electionRegistryPath: string;
    demographicRegistryPath: string;
  };
}

export const pennsylvaniaDetailedStateManifest = Object.freeze({
  schemaVersion: 1,
  code: "PA",
  name: "Pennsylvania",
  election: {
    year: 2024,
    contestId: "2024-president",
    electoralVotes: 19,
  },
  compatibility: {
    dataVersion: "us2024-pa-vtd2020-v2",
    engineVersion: "pa-behavior-v1",
  },
  runtime: {
    loader: "pa-vtd-row-v1",
    artifactPath: "data/pa/2020/vtd-demographics.json",
    schemaVersion: 3,
    encoding: "vtd-row-v1",
  },
  geography: {
    countyFipsPrefix: "42",
    precinctGeometryManifestPath: "data/pa/2024/precinct-geometry-manifest.json",
  },
  sources: {
    electionRegistryPath: "data-sources/pennsylvania/2024-general-presidential.json",
    demographicRegistryPath: "data-sources/pennsylvania/2020-pl94-vtd-demographics.json",
  },
} as const satisfies DetailedStateManifest);

const manifests = new Map<DetailedStateCode, DetailedStateManifest>([
  [pennsylvaniaDetailedStateManifest.code, pennsylvaniaDetailedStateManifest],
]);

export function getDetailedStateManifest(code: string) {
  const manifest = manifests.get(code as DetailedStateCode);
  if (!manifest) throw new Error(`Detailed state ${code} is not registered`);
  return manifest;
}

export function resolveDetailedStateArtifactUrl(
  manifest: DetailedStateManifest,
  publicBaseUrl: string,
  origin: string,
) {
  const normalizedBase = publicBaseUrl.endsWith("/") ? publicBaseUrl : `${publicBaseUrl}/`;
  return new URL(manifest.runtime.artifactPath, new URL(normalizedBase, origin)).toString();
}
