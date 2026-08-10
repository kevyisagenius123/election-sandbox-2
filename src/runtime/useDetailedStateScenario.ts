import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BehaviorScenarioResult,
  BehaviorScenarioSettings,
} from "../../packages/election-model/src/scenario.ts";
import {
  resolveDetailedStateArtifactUrl,
  type DetailedStateManifest,
} from "../data/detailedStateManifest.ts";
import type { PennsylvaniaDemographicFoundation } from "../data/paDemographics.ts";
import type {
  DetailedStateWorkerRequest,
  DetailedStateWorkerResponse,
} from "./detailedStateWorkerProtocol.ts";

interface DetailedStateScenarioRuntime {
  foundation: PennsylvaniaDemographicFoundation | null;
  scenario: BehaviorScenarioResult | null;
  error: string | null;
  pending: boolean;
}

function settingsSignature(settings: BehaviorScenarioSettings) {
  return [
    settings.turnoutIncreasePoints,
    settings.addedVoterHarrisShare,
    settings.preferenceShiftPoints,
    settings.thirdPartyCandidate,
    settings.thirdPartyShiftPoints,
    settings.thirdPartyHarrisExchangeShare,
  ].join("|");
}

export function useDetailedStateScenario(
  manifest: DetailedStateManifest,
  settings: BehaviorScenarioSettings,
): DetailedStateScenarioRuntime {
  const [runtime, setRuntime] = useState<DetailedStateScenarioRuntime>({
    foundation: null,
    scenario: null,
    error: null,
    pending: true,
  });
  const workerRef = useRef<Worker | null>(null);
  const readyRef = useRef(false);
  const sequenceRef = useRef(0);
  const requestSignaturesRef = useRef(new Map<number, string>());
  const latestSettingsRef = useRef(settings);
  const latestSignature = settingsSignature(settings);
  const latestSignatureRef = useRef(latestSignature);

  useEffect(() => {
    latestSettingsRef.current = settings;
    latestSignatureRef.current = latestSignature;
  }, [latestSignature, settings]);

  const artifactUrl = useMemo(() => resolveDetailedStateArtifactUrl(
    manifest,
    import.meta.env.BASE_URL,
    window.location.origin,
  ), [manifest]);

  useEffect(() => {
    const worker = new Worker(
      new URL("./detailedStateScenario.worker.ts", import.meta.url),
      { type: "module", name: `${manifest.code.toLowerCase()}-scenario-runtime` },
    );
    workerRef.current = worker;
    readyRef.current = false;
    const requestSignatures = requestSignaturesRef.current;
    const initialRequestId = ++sequenceRef.current;
    const initialSignature = latestSignatureRef.current;
    requestSignatures.set(initialRequestId, initialSignature);

    function sendLatestCalculation() {
      const activeWorker = workerRef.current;
      if (!activeWorker || !readyRef.current) return;
      const requestId = ++sequenceRef.current;
      requestSignatures.clear();
      requestSignatures.set(requestId, latestSignatureRef.current);
      const request: DetailedStateWorkerRequest = {
        type: "calculate",
        requestId,
        settings: latestSettingsRef.current,
      };
      activeWorker.postMessage(request);
      setRuntime((current) => ({ ...current, pending: true, error: null }));
    }

    worker.onmessage = (event: MessageEvent<DetailedStateWorkerResponse>) => {
      const response = event.data;
      const responseSignature = requestSignatures.get(response.requestId);
      requestSignatures.delete(response.requestId);
      if (response.type === "error") {
        if (responseSignature !== latestSignatureRef.current && readyRef.current) return;
        setRuntime((current) => ({ ...current, error: response.message, pending: false }));
        return;
      }
      if (response.type === "ready") {
        readyRef.current = true;
        if (responseSignature === latestSignatureRef.current) {
          setRuntime({
            foundation: response.foundation,
            scenario: response.scenario,
            error: null,
            pending: false,
          });
        } else {
          setRuntime((current) => ({
            ...current,
            foundation: response.foundation,
            error: null,
            pending: true,
          }));
          sendLatestCalculation();
        }
        return;
      }
      if (responseSignature !== latestSignatureRef.current) return;
      setRuntime((current) => ({
        ...current,
        scenario: response.scenario,
        error: null,
        pending: false,
      }));
    };
    worker.onerror = () => {
      setRuntime((current) => ({
        ...current,
        error: "Detailed state worker could not complete the calculation",
        pending: false,
      }));
    };
    const request: DetailedStateWorkerRequest = {
      type: "initialize",
      requestId: initialRequestId,
      stateCode: manifest.code,
      artifactUrl,
      settings: latestSettingsRef.current,
    };
    worker.postMessage(request);

    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
      requestSignatures.clear();
    };
  }, [artifactUrl, manifest]);

  useEffect(() => {
    if (!readyRef.current || !workerRef.current) return;
    const requestId = ++sequenceRef.current;
    requestSignaturesRef.current.clear();
    requestSignaturesRef.current.set(requestId, latestSignature);
    const request: DetailedStateWorkerRequest = {
      type: "calculate",
      requestId,
      settings,
    };
    workerRef.current.postMessage(request);
    setRuntime((current) => ({ ...current, pending: true, error: null }));
  }, [latestSignature, settings]);

  return runtime;
}
