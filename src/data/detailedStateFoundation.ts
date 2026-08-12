import type { MichiganDemographicFoundation } from "./miDemographics.ts";
import type { PennsylvaniaDemographicFoundation } from "./paDemographics.ts";

export type DetailedStateFoundation =
  | MichiganDemographicFoundation
  | PennsylvaniaDemographicFoundation;

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
