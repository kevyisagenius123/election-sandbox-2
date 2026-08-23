import { getDetailedStateManifest, type DetailedStateCode } from "./detailedStateManifest.ts";
import { getStateEvidenceLedger } from "./provenance.ts";
import type { ScenarioEditorMode } from "./scenarioUrl.ts";

export interface BehaviorOperationSemantics {
  operation: ScenarioEditorMode;
  populationBasis: string;
  changes: string;
  preserves: string;
  boundary: string;
}

export interface StateModelSemantics {
  stateCode: DetailedStateCode;
  stateName: string;
  reportingUnitLabel: string;
  turnoutPopulationLabel: string;
  denominatorDisclosure: string;
  geographyDisclosure: string;
  operations: Readonly<Record<ScenarioEditorMode, BehaviorOperationSemantics>>;
}

const turnoutPopulationLabels: Readonly<Record<DetailedStateCode, string>> = Object.freeze({
  PA: "2020 Census voting-age population",
  MI: "2020 Census voting-age population bridge",
  WI: "LTSB 2020 voting-age population estimate",
});

export function getStateModelSemantics(stateCode: DetailedStateCode): StateModelSemantics {
  const manifest = getDetailedStateManifest(stateCode);
  const evidence = getStateEvidenceLedger(stateCode);
  const reportingUnits = manifest.geography.unitLabelPlural.toLowerCase();
  return Object.freeze({
    stateCode,
    stateName: manifest.name,
    reportingUnitLabel: manifest.geography.unitLabel,
    turnoutPopulationLabel: turnoutPopulationLabels[stateCode],
    denominatorDisclosure: evidence.denominator,
    geographyDisclosure: `${evidence.geography.contract}. ${evidence.treatment}`,
    operations: Object.freeze({
      turnout: Object.freeze({
        operation: "turnout",
        populationBasis: turnoutPopulationLabels[stateCode],
        changes: `Adds Harris or Trump ballots across turnout-ready ${reportingUnits}: denominator × selected points ÷ 100, rounded to whole ballots.`,
        preserves: "Every existing ballot and every third-party total stays fixed.",
        boundary: "The editor exposes 0 to +1.5 VAP points; each local unit is capped by its documented remaining capacity.",
      }),
      preference: Object.freeze({
        operation: "preference",
        populationBasis: "2024 counted Harris and Trump ballots",
        changes: "Transfers existing ballots directly between Harris and Trump: current ballots × selected points ÷ 200.",
        preserves: "Total ballots and all third-party totals stay fixed.",
        boundary: "Both directions extend to the full feasible statewide transfer derived from current two-party ballots.",
      }),
      "third-party": Object.freeze({
        operation: "third-party",
        populationBasis: "2024 counted candidate ballots",
        changes: "Exchanges the selected third-party bucket with Harris or Trump: current ballots × selected points ÷ 100.",
        preserves: "The statewide ballot total stays fixed throughout the exchange.",
        boundary: "The negative bound is zero candidate votes; the positive bound is the available Harris and Trump source supply.",
      }),
    }),
  });
}
