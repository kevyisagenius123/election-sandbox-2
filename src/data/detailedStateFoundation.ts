import type { MichiganDemographicFoundation } from "./miDemographics.ts";
import type { PennsylvaniaDemographicFoundation } from "./paDemographics.ts";
import type { WisconsinWardFoundation } from "./wiWards.ts";

export type DetailedStateFoundation =
  | MichiganDemographicFoundation
  | PennsylvaniaDemographicFoundation
  | WisconsinWardFoundation;

export function isMichiganFoundation(
  foundation: DetailedStateFoundation | null,
): foundation is MichiganDemographicFoundation {
  return foundation?.stateCode === "MI";
}

export function isPennsylvaniaFoundation(
  foundation: DetailedStateFoundation | null,
): foundation is PennsylvaniaDemographicFoundation {
  return foundation?.stateCode === "PA";
}

export function isWisconsinFoundation(
  foundation: DetailedStateFoundation | null,
): foundation is WisconsinWardFoundation {
  return foundation?.stateCode === "WI";
}
