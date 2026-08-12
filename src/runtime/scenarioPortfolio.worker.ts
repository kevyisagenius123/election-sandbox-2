import { applyBehaviorScenario } from "../../packages/election-model/src/scenario.ts";
import { getDetailedStateManifest } from "../data/detailedStateManifest.ts";
import { getDetailedStateRuntimeAdapter } from "../data/detailedStateRuntimeLoaders.ts";
import {
  buildStateScenarioSummary,
  toBehaviorScenarioSettings,
  type StateScenarioRecipe,
  type StateScenarioSummary,
} from "../data/scenarioPortfolio.ts";
import { states2024 } from "../data/states.ts";

interface HydratePortfolioRequest {
  type: "hydrate";
  requestId: number;
  entries: Array<{ recipe: StateScenarioRecipe; artifactUrl: string }>;
}

type HydratePortfolioResponse =
  | { type: "complete"; requestId: number; summaries: StateScenarioSummary[] }
  | { type: "error"; requestId: number; message: string };

interface WorkerScope {
  onmessage: ((event: MessageEvent<HydratePortfolioRequest>) => void) | null;
  postMessage(message: HydratePortfolioResponse): void;
}

const workerScope = globalThis as unknown as WorkerScope;

async function hydrate(request: HydratePortfolioRequest) {
  const summaries: StateScenarioSummary[] = [];
  for (const entry of request.entries) {
    const manifest = getDetailedStateManifest(entry.recipe.stateCode);
    if (
      entry.recipe.electionId !== manifest.election.contestId
      || entry.recipe.dataVersion !== manifest.compatibility.dataVersion
      || entry.recipe.engineVersion !== manifest.compatibility.engineVersion
    ) {
      throw new Error(`${manifest.name} recipe is incompatible with this build`);
    }
    const response = await fetch(entry.artifactUrl);
    if (!response.ok) throw new Error(`${manifest.name} foundation request failed with ${response.status}`);
    const adapter = getDetailedStateRuntimeAdapter(manifest.runtime.loader);
    const foundation = adapter.decode(await response.json());
    const units = adapter.toBehaviorModelUnits(foundation);
    const scenario = applyBehaviorScenario(
      units,
      toBehaviorScenarioSettings(entry.recipe.settings),
    );
    const actual = states2024.find((state) => state.code === manifest.code);
    if (!actual) throw new Error(`${manifest.name} is missing its certified state baseline`);
    summaries.push(buildStateScenarioSummary(entry.recipe, actual, scenario));
  }
  workerScope.postMessage({ type: "complete", requestId: request.requestId, summaries });
}

workerScope.onmessage = (event) => {
  void hydrate(event.data).catch((error: unknown) => {
    workerScope.postMessage({
      type: "error",
      requestId: event.data.requestId,
      message: error instanceof Error ? error.message : "Scenario portfolio hydration failed",
    });
  });
};
