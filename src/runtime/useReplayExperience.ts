import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDetailedStateManifest,
  resolveDetailedStateArtifactUrl,
  type DetailedStateCode,
} from "../data/detailedStateManifest.ts";
import type { StateBehaviorRecipeSettings } from "../data/scenarioPortfolio.ts";
import type { ElectionNightBehavior } from "../replay/threeStateElectionNight.ts";
import {
  THREE_STATE_NIGHT_PROTOCOL,
  type NightCurrentReturn,
  type NightHeadline,
  type NightPublishedUnit,
  type NightReportedCounty,
  type ThreeStateNightWorkerRequest,
  type ThreeStateNightWorkerResponse,
} from "./threeStateNightProtocol.ts";

type ReplayExperiencePhase = "idle" | "loading-data" | "ready" | "error";

export interface ReplayStartConfiguration {
  recipes: Readonly<Record<DetailedStateCode, StateBehaviorRecipeSettings>>;
  behavior: ElectionNightBehavior;
}

interface ReplayExperienceState {
  phase: ReplayExperiencePhase;
  error: string | null;
  current: NightHeadline | null;
  currentReturn: NightCurrentReturn | null;
  recentReturns: readonly NightCurrentReturn[];
  reportedCounties: readonly NightReportedCounty[];
  publishedUnits: readonly NightPublishedUnit[];
  timelineProgressMillionths: number;
}

const INITIAL_STATE: ReplayExperienceState = {
  phase: "idle",
  error: null,
  current: null,
  currentReturn: null,
  recentReturns: [],
  reportedCounties: [],
  publishedUnits: [],
  timelineProgressMillionths: 0,
};

function localKey(jurisdictionId: string, localId: string) {
  return `${jurisdictionId}:${localId}`;
}

export function useReplayExperience() {
  const [state, setState] = useState<ReplayExperienceState>(INITIAL_STATE);
  const [speed, setSpeed] = useState(1);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const initializationRequestIdRef = useRef(0);
  const countyMapRef = useRef(new Map<string, NightReportedCounty>());
  const unitMapRef = useRef(new Map<string, NightPublishedUnit>());

  const postCommand = useCallback((command: Extract<ThreeStateNightWorkerRequest, { type: "COMMAND" }>["command"]) => {
    if (!workerRef.current) return;
    requestIdRef.current += 1;
    workerRef.current.postMessage({
      protocolVersion: THREE_STATE_NIGHT_PROTOCOL,
      requestId: requestIdRef.current,
      type: "COMMAND",
      command,
    } satisfies ThreeStateNightWorkerRequest);
  }, []);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    countyMapRef.current.clear();
    unitMapRef.current.clear();
    setState(INITIAL_STATE);
  }, []);

  const start = useCallback((configuration: ReplayStartConfiguration) => {
    countyMapRef.current.clear();
    unitMapRef.current.clear();
    setState({ ...INITIAL_STATE, phase: "loading-data" });
    let worker = workerRef.current;
    if (!worker) {
      worker = new Worker(
        new URL("./threeStateNight.worker.ts", import.meta.url),
        { type: "module", name: "three-state-election-night" },
      );
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<ThreeStateNightWorkerResponse>) => {
        if (workerRef.current !== worker) return;
        const response = event.data;
        if (response.protocolVersion !== THREE_STATE_NIGHT_PROTOCOL) return;
        if (response.requestId < initializationRequestIdRef.current) return;
        if (response.type === "ERROR") {
          setState((current) => ({ ...current, phase: "error", error: response.message }));
          return;
        }
        if (response.replaceLocalState) {
          countyMapRef.current.clear();
          unitMapRef.current.clear();
        }
        for (const county of response.reportedCounties) {
          countyMapRef.current.set(localKey(county.jurisdictionId, county.countyId), county);
        }
        for (const unit of response.publishedUnits) {
          unitMapRef.current.set(localKey(unit.jurisdictionId, unit.unitId), unit);
        }
        setState((current) => {
          const incomingReturns = [...response.recentReturns].reverse();
          const recentReturns = response.replaceLocalState
            ? incomingReturns
            : [...incomingReturns, ...current.recentReturns]
              .filter((item, index, values) => values.findIndex((candidate) => candidate.eventId === item.eventId) === index)
              .slice(0, 12);
          return {
            phase: "ready",
            error: null,
            current: response.current,
            currentReturn: response.currentReturn,
            recentReturns,
            reportedCounties: [...countyMapRef.current.values()],
            publishedUnits: [...unitMapRef.current.values()],
            timelineProgressMillionths: response.timelineProgressMillionths,
          };
        });
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        setState((current) => ({
          ...current,
          phase: "error",
          error: "The three-state election-night worker could not start",
        }));
      };
    }
    requestIdRef.current += 1;
    initializationRequestIdRef.current = requestIdRef.current;
    const states = (["PA", "MI", "WI"] as const).map((stateCode) => {
      const manifest = getDetailedStateManifest(stateCode);
      return {
        stateCode,
        loader: manifest.runtime.loader,
        artifactUrl: resolveDetailedStateArtifactUrl(
          manifest,
          import.meta.env.BASE_URL,
          window.location.origin,
        ),
        settings: configuration.recipes[stateCode],
      };
    });
    worker.postMessage({
      protocolVersion: THREE_STATE_NIGHT_PROTOCOL,
      requestId: requestIdRef.current,
      type: "INITIALIZE",
      states,
      behavior: configuration.behavior,
    } satisfies ThreeStateNightWorkerRequest);
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const playbackStatus = state.current?.controller.status;
  useEffect(() => {
    if (playbackStatus !== "playing") return;
    const timer = window.setInterval(() => {
      postCommand({ type: "ADVANCE_LOGICAL_TIME", deltaMs: Math.max(1, Math.round(180_000 * speed)) });
    }, 250);
    return () => window.clearInterval(timer);
  }, [playbackStatus, postCommand, speed]);

  return {
    ...state,
    speed,
    setSpeed,
    start,
    stop,
    play: () => postCommand({ type: "PLAY" }),
    pause: () => postCommand({ type: "PAUSE" }),
    reset: () => postCommand({ type: "RESET" }),
    step: () => postCommand({ type: "STEP_NEXT_EVENT_TIME" }),
    seek: (progressMillionths: number) => postCommand({ type: "SEEK_PROGRESS", progressMillionths }),
  };
}
