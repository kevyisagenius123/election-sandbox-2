import { useEffect, useMemo, useRef, useState } from "react";
import {
  resolveDetailedStateArtifactUrl,
  getDetailedStateManifest,
} from "../data/detailedStateManifest.ts";
import {
  stateScenarioRecipeFingerprint,
  type StateScenarioRecipe,
  type StateScenarioSummary,
} from "../data/scenarioPortfolio.ts";

interface PortfolioWorkerResponse {
  type: "complete" | "error";
  requestId: number;
  summaries?: StateScenarioSummary[];
  message?: string;
}

interface PublishedPortfolio {
  signature: string;
  summaries: ReadonlyMap<string, StateScenarioSummary>;
  error: string | null;
}

export function useScenarioPortfolio(recipes: readonly StateScenarioRecipe[]) {
  const sequenceRef = useRef(0);
  const signature = useMemo(
    () => recipes.map(stateScenarioRecipeFingerprint).sort().join("||"),
    [recipes],
  );
  const [published, setPublished] = useState<PublishedPortfolio>({
    signature: "",
    summaries: new Map(),
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(
      new URL("./scenarioPortfolio.worker.ts", import.meta.url),
      { type: "module", name: "scenario-portfolio-hydrator" },
    );
    const requestId = ++sequenceRef.current;
    worker.onmessage = (event: MessageEvent<PortfolioWorkerResponse>) => {
      if (event.data.requestId !== requestId) return;
      if (event.data.type === "error") {
        setPublished({ signature, summaries: new Map(), error: event.data.message ?? "Portfolio hydration failed" });
        return;
      }
      setPublished({
        signature,
        summaries: new Map((event.data.summaries ?? []).map((summary) => [summary.stateCode, summary])),
        error: null,
      });
    };
    worker.onerror = () => {
      setPublished({ signature, summaries: new Map(), error: "Portfolio worker could not complete hydration" });
    };
    const entries = recipes.map((recipe) => ({
      recipe,
      artifactUrl: resolveDetailedStateArtifactUrl(
        getDetailedStateManifest(recipe.stateCode),
        import.meta.env.BASE_URL,
        window.location.origin,
      ),
    }));
    worker.postMessage({ type: "hydrate", requestId, entries });
    return () => worker.terminate();
  }, [recipes, signature]);

  if (published.signature !== signature) {
    return { summaries: new Map<string, StateScenarioSummary>(), pending: true, error: null };
  }
  return { summaries: published.summaries, pending: false, error: published.error };
}
