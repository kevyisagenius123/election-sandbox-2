export const ANALYTIC_REGISTRY_VERSION = "sandbox-analytic-registry-v1" as const;

export type AnalyticSemanticClass =
  | "certified"
  | "reported"
  | "scenario"
  | "derived"
  | "modeled"
  | "decision";

export type AnalyticUnit =
  | "votes"
  | "ballots"
  | "parts-per-million"
  | "returns"
  | "electoral-votes"
  | "duration-seconds";

export type AnalyticTimeScope = "endpoint" | "current-prefix" | "selected-window";

export type CandidateScopePolicy =
  | "all-candidates"
  | "one-candidate"
  | "harris-trump"
  | "target-candidate"
  | "explicit";

export interface AnalyticDefinition {
  id: string;
  semanticClass: AnalyticSemanticClass;
  unit: AnalyticUnit;
  timeScope: AnalyticTimeScope;
  candidateScopePolicy: CandidateScopePolicy;
  requiresRatioOperands: boolean;
  ratioOperandUnit?: "ballots" | "returns";
  description: string;
}

const definitions = [
  {
    id: "certified.total-ballots",
    semanticClass: "certified",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: false,
    description: "Certified ballots across the complete candidate field.",
  },
  {
    id: "certified.candidate-votes",
    semanticClass: "certified",
    unit: "votes",
    timeScope: "endpoint",
    candidateScopePolicy: "one-candidate",
    requiresRatioOperands: false,
    description: "Certified votes for one identified candidate or aggregate candidate bucket.",
  },
  {
    id: "certified.harris-trump-margin-votes",
    semanticClass: "certified",
    unit: "votes",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Certified signed Harris-minus-Trump vote margin.",
  },
  {
    id: "scenario.total-ballots",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: false,
    description: "Scenario endpoint ballots across the complete candidate field.",
  },
  {
    id: "scenario.candidate-votes",
    semanticClass: "scenario",
    unit: "votes",
    timeScope: "endpoint",
    candidateScopePolicy: "one-candidate",
    requiresRatioOperands: false,
    description: "Scenario endpoint votes for one identified candidate or aggregate candidate bucket.",
  },
  {
    id: "scenario.harris-trump-margin-votes",
    semanticClass: "scenario",
    unit: "votes",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Scenario endpoint signed Harris-minus-Trump vote margin.",
  },
  {
    id: "scenario.turnout-requested-ballots",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Ballots requested by the turnout operation before local capacity clipping.",
  },
  {
    id: "scenario.turnout-realized-ballots",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Ballots actually added by the turnout operation after local capacity clipping.",
  },
  {
    id: "scenario.preference-requested-transfers",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Signed direct Harris-Trump ballot transfers requested by the preference operation.",
  },
  {
    id: "scenario.preference-realized-transfers",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Signed direct Harris-Trump ballot transfers realized by the preference operation.",
  },
  {
    id: "scenario.third-party-requested-exchanges",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "explicit",
    requiresRatioOperands: false,
    description: "Signed selected-candidate ballot exchange requested by the third-party operation.",
  },
  {
    id: "scenario.third-party-realized-exchanges",
    semanticClass: "scenario",
    unit: "ballots",
    timeScope: "endpoint",
    candidateScopePolicy: "explicit",
    requiresRatioOperands: false,
    description: "Signed selected-candidate ballot exchange realized by the third-party operation.",
  },
  {
    id: "derived.geography-margin-contribution-votes",
    semanticClass: "derived",
    unit: "votes",
    timeScope: "endpoint",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Signed Harris-minus-Trump margin movement produced by one scenario geography.",
  },
  {
    id: "derived.electoral-vote-consequence",
    semanticClass: "derived",
    unit: "electoral-votes",
    timeScope: "endpoint",
    candidateScopePolicy: "target-candidate",
    requiresRatioOperands: false,
    description: "Signed Electoral College change for the identified target candidate.",
  },
  {
    id: "reported.total-ballots",
    semanticClass: "reported",
    unit: "ballots",
    timeScope: "current-prefix",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: false,
    description: "Ballots observable in the current replay prefix.",
  },
  {
    id: "reported.candidate-votes",
    semanticClass: "reported",
    unit: "votes",
    timeScope: "current-prefix",
    candidateScopePolicy: "one-candidate",
    requiresRatioOperands: false,
    description: "Votes for one candidate observable in the current replay prefix.",
  },
  {
    id: "reported.harris-trump-margin-votes",
    semanticClass: "reported",
    unit: "votes",
    timeScope: "current-prefix",
    candidateScopePolicy: "harris-trump",
    requiresRatioOperands: false,
    description: "Current-prefix signed Harris-minus-Trump vote margin.",
  },
  {
    id: "reported.returns-published",
    semanticClass: "reported",
    unit: "returns",
    timeScope: "current-prefix",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: false,
    description: "Atomic returns observable in the current replay prefix.",
  },
  {
    id: "derived.return-progress-ppm",
    semanticClass: "derived",
    unit: "parts-per-million",
    timeScope: "current-prefix",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: true,
    ratioOperandUnit: "returns",
    description: "Published atomic returns divided by the admitted expected return count.",
  },
  {
    id: "derived.represented-ballot-progress-ppm",
    semanticClass: "derived",
    unit: "parts-per-million",
    timeScope: "current-prefix",
    candidateScopePolicy: "all-candidates",
    requiresRatioOperands: true,
    ratioOperandUnit: "ballots",
    description: "Current-prefix ballots divided by the disclosed modeled endpoint ballot denominator.",
  },
] as const satisfies readonly AnalyticDefinition[];

const definitionById = new Map<string, AnalyticDefinition>();
for (const definition of definitions) {
  if (definitionById.has(definition.id)) {
    throw new Error(`Duplicate analytic definition ${definition.id}`);
  }
  definitionById.set(definition.id, Object.freeze({ ...definition }));
}

export const ANALYTIC_DEFINITIONS: readonly AnalyticDefinition[] = Object.freeze(
  [...definitionById.values()],
);

export type AnalyticDefinitionId = (typeof definitions)[number]["id"];

export function getAnalyticDefinition(id: string): AnalyticDefinition {
  const definition = definitionById.get(id);
  if (!definition) throw new Error(`Unknown analytic definition ${id}`);
  return definition;
}
