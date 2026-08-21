import type { BehaviorModelUnit } from "../../packages/election-model/src/scenario.ts";
import type { DetailedStateRuntimeLoader } from "./detailedStateManifest.ts";
import type { DetailedStateFoundation } from "./detailedStateFoundation.ts";
import {
  decodeMichiganDemographicFoundation,
  toMichiganBehaviorModelUnits,
} from "./miDemographics.ts";
import {
  decodePennsylvaniaDemographicFoundation,
  toBehaviorModelUnits as toPennsylvaniaBehaviorModelUnits,
} from "./paDemographics.ts";
import {
  decodeWisconsinWardFoundation,
  toWisconsinBehaviorModelUnits,
} from "./wiWards.ts";

interface DetailedStateRuntimeAdapter {
  decode(value: unknown): DetailedStateFoundation;
  toBehaviorModelUnits(foundation: DetailedStateFoundation): BehaviorModelUnit[];
}

const adapters = {
  "mi-precinct-row-v1": {
    decode: decodeMichiganDemographicFoundation,
    toBehaviorModelUnits(foundation) {
      if (foundation.stateCode !== "MI") {
        throw new Error("Michigan runtime adapter received another state's foundation");
      }
      return toMichiganBehaviorModelUnits(foundation);
    },
  },
  "pa-vtd-row-v1": {
    decode: decodePennsylvaniaDemographicFoundation,
    toBehaviorModelUnits(foundation) {
      if (foundation.stateCode !== "PA") {
        throw new Error("Pennsylvania runtime adapter received another state's foundation");
      }
      return toPennsylvaniaBehaviorModelUnits(foundation);
    },
  },
  "wi-ward-row-v1": {
    decode: decodeWisconsinWardFoundation,
    toBehaviorModelUnits(foundation) {
      if (foundation.stateCode !== "WI") {
        throw new Error("Wisconsin runtime adapter received another state's foundation");
      }
      return toWisconsinBehaviorModelUnits(foundation);
    },
  },
} satisfies Record<DetailedStateRuntimeLoader, DetailedStateRuntimeAdapter>;

export function getDetailedStateRuntimeAdapter(loader: DetailedStateRuntimeLoader) {
  return adapters[loader];
}
