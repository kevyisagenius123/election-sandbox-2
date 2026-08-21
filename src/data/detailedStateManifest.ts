export type DetailedStateCode = "MI" | "PA" | "WI";
export type DetailedStateRuntimeLoader = "mi-precinct-row-v1" | "pa-vtd-row-v1" | "wi-ward-row-v1";

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
    artifactByteSize: number;
    schemaVersion: number;
    encoding: string;
  };
  geography: {
    countyFipsPrefix: string;
    precinctGeometryManifestPath: string;
    unitLabel: "Precinct" | "VTD" | "Ward";
    unitLabelPlural: string;
    selectionIdKind: "mi_precinct_id" | "pa_vtd_geoid" | "wi_ward_geoid";
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
    dataVersion: "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1",
    engineVersion: "pa-behavior-v1",
  },
  runtime: {
    loader: "pa-vtd-row-v1",
    artifactPath: "data/pa/2020/vtd-demographics.json",
    artifactByteSize: 874568,
    schemaVersion: 3,
    encoding: "vtd-row-v1",
  },
  geography: {
    countyFipsPrefix: "42",
    precinctGeometryManifestPath: "data/pa/2024/precinct-geometry-manifest.json",
    unitLabel: "VTD",
    unitLabelPlural: "VTDs",
    selectionIdKind: "pa_vtd_geoid",
  },
  sources: {
    electionRegistryPath: "data-sources/pennsylvania/2024-general-presidential.json",
    demographicRegistryPath: "data-sources/pennsylvania/2020-pl94-vtd-demographics.json",
  },
} as const satisfies DetailedStateManifest);

export const michiganDetailedStateManifest = Object.freeze({
  schemaVersion: 1,
  code: "MI",
  name: "Michigan",
  election: {
    year: 2024,
    contestId: "2024-president",
    electoralVotes: 15,
  },
  compatibility: {
    dataVersion: "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1",
    engineVersion: "pa-behavior-v1",
  },
  runtime: {
    loader: "mi-precinct-row-v1",
    artifactPath: "data/mi/2020/precinct-demographics.json",
    artifactByteSize: 628735,
    schemaVersion: 1,
    encoding: "mi-precinct-row-v1",
  },
  geography: {
    countyFipsPrefix: "26",
    precinctGeometryManifestPath: "data/mi/2024/precinct-geometry-manifest.json",
    unitLabel: "Precinct",
    unitLabelPlural: "Precincts",
    selectionIdKind: "mi_precinct_id",
  },
  sources: {
    electionRegistryPath: "data-sources/michigan/2024-general-presidential.json",
    demographicRegistryPath: "data-sources/michigan/2020-pl94-precinct-demographics.json",
  },
} as const satisfies DetailedStateManifest);

export const wisconsinDetailedStateManifest = Object.freeze({
  schemaVersion: 1,
  code: "WI",
  name: "Wisconsin",
  election: {
    year: 2024,
    contestId: "2024-president",
    electoralVotes: 10,
  },
  compatibility: {
    dataVersion: "us2024-pa-vtd2020-mi-precinct2024-wi-ward2025-v1",
    engineVersion: "pa-behavior-v1",
  },
  runtime: {
    loader: "wi-ward-row-v1",
    artifactPath: "data/wi/2020/ward-demographics.json",
    artifactByteSize: 442354,
    schemaVersion: 1,
    encoding: "wi-ward-row-v1",
  },
  geography: {
    countyFipsPrefix: "55",
    precinctGeometryManifestPath: "data/wi/2024/precinct-geometry-manifest.json",
    unitLabel: "Ward",
    unitLabelPlural: "Wards",
    selectionIdKind: "wi_ward_geoid",
  },
  sources: {
    electionRegistryPath: "data-sources/wisconsin/2024-general-presidential.json",
    demographicRegistryPath: "data-sources/wisconsin/2020-vap-ward-denominator.json",
  },
} as const satisfies DetailedStateManifest);

const manifests = new Map<DetailedStateCode, DetailedStateManifest>([
  [michiganDetailedStateManifest.code, michiganDetailedStateManifest],
  [pennsylvaniaDetailedStateManifest.code, pennsylvaniaDetailedStateManifest],
  [wisconsinDetailedStateManifest.code, wisconsinDetailedStateManifest],
]);

export function isDetailedStateCode(code: string): code is DetailedStateCode {
  return manifests.has(code as DetailedStateCode);
}

export function listDetailedStateManifests() {
  return [...manifests.values()];
}

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
