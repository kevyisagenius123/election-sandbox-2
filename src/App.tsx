import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  aggregateNational,
  deriveBehaviorContributions,
  preferenceShiftBounds,
  type BehaviorScenarioUnit,
  type StatewidePresidentialResult,
  type ThirdPartyCandidate,
} from "../packages/election-model/src/scenario.ts";
import { GeographyInspector } from "./components/GeographyInspector.tsx";
import {
  buildDetailedScenarioCounties,
  getDetailedStateCounties,
  getDetailedStateElection,
  getDetailedStateGeographies,
  getDetailedStateSource,
  scenarioDetailedGeographyMap,
  toDetailedBehaviorModelUnits,
} from "./data/detailedStateData.ts";
import {
  getDetailedStateManifest,
  isDetailedStateCode,
  listDetailedStateManifests,
  pennsylvaniaDetailedStateManifest,
  type DetailedStateCode,
} from "./data/detailedStateManifest.ts";
import {
  buildDetailedCountyInspector,
  buildDetailedGeographyInspector,
} from "./data/detailedStateInspector.ts";
import { isPennsylvaniaFoundation, isWisconsinFoundation } from "./data/detailedStateFoundation.ts";
import {
  buildScenarioUrl,
  decodeScenarioSearch,
  DEFAULT_SCENARIO_URL_STATE,
  SCENARIO_DATA_VERSION,
  SCENARIO_ENGINE_VERSION,
  SCENARIO_URL_SCHEMA_VERSION,
  type ScenarioContributionScope,
  type ScenarioEditorMode,
  type ScenarioUrlLoadResult,
  type ScenarioUrlState,
  type ScenarioViewMode,
} from "./data/scenarioUrl.ts";
import { states2024 } from "./data/states.ts";
import { useDetailedStateScenario } from "./runtime/useDetailedStateScenario.ts";
import {
  createStateScenarioRecipe,
  DEFAULT_STATE_BEHAVIOR_SETTINGS,
  isDefaultStateBehaviorSettings,
  recipesAsRecord,
  stateScenarioRecipeFingerprint,
  summaryAsStateResult,
  type StateBehaviorRecipeSettings,
  type StateScenarioRecipe,
} from "./data/scenarioPortfolio.ts";
import { useScenarioPortfolio } from "./runtime/useScenarioPortfolio.ts";
import { useReplayExperience } from "./runtime/useReplayExperience.ts";
import type { NightCurrentReturn } from "./runtime/threeStateNightProtocol.ts";
import {
  buildElectionNightChronologyPreview,
  DEFAULT_ELECTION_NIGHT_BEHAVIOR,
  ELECTION_NIGHT_PROFILES,
  validateElectionNightBehavior,
  type ElectionNightCountyOverride,
  type ElectionNightBehavior,
  type ReportingOrder,
} from "./replay/threeStateElectionNight.ts";
import {
  buildElectoralConsequenceModel,
  candidateNames,
  electoralCausalSummary,
  electoralThresholdDetail,
  electoralThresholdHeadline,
  type MajorCandidate,
} from "./data/electoralConsequences.ts";
import {
  buildPathTo270Model,
  buildRouteConstructionPlan,
  buildStateFlipRequirement,
  type PathTo270Route,
  type RouteMetric,
} from "./data/pathTo270.ts";
import { getStateEvidenceLedger, nationalCoverageRows } from "./data/provenance.ts";
import { getStateModelSemantics } from "./data/modelSemantics.ts";
import { installRuntimeDiagnosticsHook } from "./runtime/runtimeDiagnostics.ts";

installRuntimeDiagnosticsHook();

type ViewMode = ScenarioViewMode;
type BehaviorEditorMode = ScenarioEditorMode;
type ContributionScope = ScenarioContributionScope;
type WorkspaceMode = "home" | "laboratory";
type ExperienceMode = "swingometer" | "election-night";
type LaboratoryDrawerSnap = "collapsed" | "working" | "expanded";
type LaboratoryDrawerTab = "behavior" | "contributors" | "inspector" | "assumptions" | "data";
type NightDockTab = "live" | "direct" | "returns" | "method";

const laboratoryDrawerTabs: LaboratoryDrawerTab[] = ["behavior", "contributors", "inspector", "assumptions", "data"];
const nightDockTabs: readonly NightDockTab[] = ["live", "direct", "returns", "method"];

interface ContributionRow {
  id: string;
  name: string;
  context: string;
  countyFips: string;
  vtdGeoid: string | null;
  marginDelta: number;
}

const AtlasMapScene = lazy(() => import("./map/AtlasMapScene.tsx").then((module) => ({
  default: module.AtlasMapScene,
})));

const numberFormat = new Intl.NumberFormat("en-US");
const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const replayClockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});
const replayTimeShortFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatCompact(value: number) {
  return compactFormat.format(value);
}

function margin(result: Pick<StatewidePresidentialResult, "harrisVotes" | "trumpVotes" | "totalVotes">) {
  return ((result.harrisVotes - result.trumpVotes) / result.totalVotes) * 100;
}

function replayCandidateVotes(
  value: { candidateVotes: readonly { candidateId: string; votes: number }[] } | null | undefined,
  candidateId: string,
) {
  return value?.candidateVotes.find((candidate) => candidate.candidateId === candidateId)?.votes ?? 0;
}

function describeReturnMovement(value: NightCurrentReturn) {
  const movement = value.netHarrisMarginVotes;
  if (movement === 0) return "No two-party margin change";
  const candidate = movement > 0 ? "Harris" : "Trump";
  const amount = formatCompact(Math.abs(movement));
  const before = value.stateMarginBeforeVotes;
  const after = value.stateMarginAfterVotes;
  if (before !== 0 && Math.sign(before) !== Math.sign(after)) {
    return `${candidate} takes the ${value.jurisdictionId} lead by ${formatCompact(Math.abs(after))}`;
  }
  if (after === 0) return `${value.jurisdictionId} moves to an exact tie`;
  return `Net ${amount} toward ${candidate}`;
}

function formatMargin(value: number) {
  if (Math.abs(value) < 0.005) return "EVEN";
  return `${value > 0 ? "D" : "R"} +${Math.abs(value).toFixed(1)}`;
}

function formatPreferenceMovement(value: number) {
  if (Math.abs(value) < 0.0005) return "No transfer";
  return `+${Math.abs(value).toFixed(1)} pts ${value > 0 ? "D" : "R"}`;
}

function formatMarginVotes(value: number) {
  if (value === 0) return "No movement";
  return `+${formatCompact(Math.abs(value))} ${value > 0 ? "D" : "R"}`;
}

function electoralDeltaClass(value: number, target: MajorCandidate) {
  if (value === 0) return "";
  const movesTowardHarris = target === "harris" ? value > 0 : value < 0;
  return movesTowardHarris ? "toward-dem" : "toward-rep";
}

const thirdPartyLabels: Record<ThirdPartyCandidate, string> = {
  stein: "Stein",
  oliver: "Oliver",
  residual_other: "Other/write-in",
};

const routeMetricLabels: Record<RouteMetric, string> = {
  "fewest-states": "Fewest states",
  "margin-movement": "Margin movement",
  "margin-votes": "Net margin votes",
};

function formatThirdPartyMovement(value: number, candidate: ThirdPartyCandidate) {
  if (Math.abs(value) < 0.0005) return "No transfer";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} pts ${thirdPartyLabels[candidate]}`;
}

function normalizeBidirectionalSlider(value: number, minimum: number, maximum: number) {
  if (value <= minimum) return minimum;
  if (value >= maximum) return maximum;
  return Math.min(maximum, Math.max(minimum, Number(value.toFixed(1))));
}

function scenarioUrlNotice(load: ScenarioUrlLoadResult) {
  if (load.status === "none") return null;
  return load.message;
}

async function writeClipboardText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function isLaboratoryPath(pathname: string) {
  return /\/app\/?$/.test(pathname);
}

function workspaceUrl(mode: WorkspaceMode, href = window.location.href) {
  const url = new URL(href);
  url.pathname = url.pathname.replace(/\/app\/?$/, "/");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  if (mode === "laboratory") url.pathname += "app/";
  url.search = "";
  url.hash = "";
  return url;
}

const NIGHT_PROFILE_STORAGE_KEY = "sandbox-2-election-night-profiles-v1";

interface SavedNightProfile {
  id: string;
  name: string;
  behavior: ElectionNightBehavior;
}

function cloneNightBehavior(value: ElectionNightBehavior): ElectionNightBehavior {
  const behavior = validateElectionNightBehavior(value);
  return {
    ...behavior,
    stateDelayMinutes: { ...behavior.stateDelayMinutes },
    countyOverrides: behavior.countyOverrides.map((override) => ({ ...override })),
  };
}

function nightBehaviorFingerprint(value: ElectionNightBehavior) {
  return JSON.stringify(validateElectionNightBehavior(value));
}

function readSavedNightProfiles(): SavedNightProfile[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NIGHT_PROFILE_STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): SavedNightProfile[] => {
      if (!entry || typeof entry !== "object") return [];
      const candidate = entry as Partial<SavedNightProfile>;
      if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !candidate.name.trim() || !candidate.behavior) return [];
      try {
        return [{ id: candidate.id, name: candidate.name.slice(0, 40), behavior: cloneNightBehavior(candidate.behavior) }];
      } catch {
        return [];
      }
    }).slice(0, 12);
  } catch {
    return [];
  }
}

function persistNightProfiles(profiles: readonly SavedNightProfile[]) {
  try {
    window.localStorage.setItem(NIGHT_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // The editor remains usable when storage is unavailable.
  }
}

function ScenarioApp() {
  const [initialScenarioUrlLoad] = useState(() => decodeScenarioSearch(window.location.search));
  const initialScenarioUrlState = initialScenarioUrlLoad.state;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => (
    isLaboratoryPath(window.location.pathname) || window.location.search ? "laboratory" : "home"
  ));
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(
    initialScenarioUrlState.selectedStateCode,
  );
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(
    initialScenarioUrlState.selectedCountyFips,
  );
  const [selectedVtdGeoid, setSelectedVtdGeoid] = useState<string | null>(
    initialScenarioUrlState.selectedVtdGeoid,
  );
  const [activeDetailedStateCode, setActiveDetailedStateCode] = useState<DetailedStateCode>(() => (
    initialScenarioUrlState.activeDetailedStateCode
      ?? (isDetailedStateCode(initialScenarioUrlState.selectedStateCode ?? "")
        ? initialScenarioUrlState.selectedStateCode as DetailedStateCode
        : pennsylvaniaDetailedStateManifest.code)
  ));
  const [storedScenarioRecipes, setStoredScenarioRecipes] = useState(() => {
    if (initialScenarioUrlState.portfolioRecipes) {
      return recipesAsRecord(initialScenarioUrlState.portfolioRecipes);
    }
    const initialSettings: StateBehaviorRecipeSettings = {
      turnoutIncreasePoints: initialScenarioUrlState.turnoutIncreasePoints,
      addedVoterHarrisShare: initialScenarioUrlState.addedVoterHarrisShare,
      preferenceShiftPoints: initialScenarioUrlState.preferenceShiftPoints,
      thirdPartyCandidate: initialScenarioUrlState.thirdPartyCandidate,
      thirdPartyShiftPoints: initialScenarioUrlState.thirdPartyShiftPoints,
      thirdPartyHarrisExchangeShare: initialScenarioUrlState.thirdPartyHarrisExchangeShare,
    };
    return isDefaultStateBehaviorSettings(initialSettings)
      ? {}
      : recipesAsRecord([createStateScenarioRecipe(
        isDetailedStateCode(initialScenarioUrlState.selectedStateCode ?? "")
          ? initialScenarioUrlState.selectedStateCode as DetailedStateCode
          : pennsylvaniaDetailedStateManifest.code,
        initialSettings,
      )]);
  });
  const [viewMode, setViewMode] = useState<ViewMode>(initialScenarioUrlState.viewMode);
  const [targetCandidate, setTargetCandidate] = useState<MajorCandidate>(
    initialScenarioUrlState.targetCandidate,
  );
  const [routeMetric, setRouteMetric] = useState<RouteMetric>(initialScenarioUrlState.routeMetric);
  const [selectedRouteStateCodes, setSelectedRouteStateCodes] = useState<string[]>(
    initialScenarioUrlState.selectedRouteStateCodes,
  );
  const [behaviorEditorMode, setBehaviorEditorMode] = useState<BehaviorEditorMode>(
    initialScenarioUrlState.behaviorEditorMode,
  );
  const [turnoutIncreasePoints, setTurnoutIncreasePoints] = useState(
    initialScenarioUrlState.turnoutIncreasePoints,
  );
  const [addedVoterHarrisShare, setAddedVoterHarrisShare] = useState(
    initialScenarioUrlState.addedVoterHarrisShare,
  );
  const [preferenceShiftPoints, setPreferenceShiftPoints] = useState(
    initialScenarioUrlState.preferenceShiftPoints,
  );
  const [thirdPartyCandidate, setThirdPartyCandidate] = useState<ThirdPartyCandidate>(
    initialScenarioUrlState.thirdPartyCandidate,
  );
  const [thirdPartyShiftPoints, setThirdPartyShiftPoints] = useState(
    initialScenarioUrlState.thirdPartyShiftPoints,
  );
  const [thirdPartyHarrisExchangeShare, setThirdPartyHarrisExchangeShare] = useState(
    initialScenarioUrlState.thirdPartyHarrisExchangeShare,
  );
  const [contributionScope, setContributionScope] = useState<ContributionScope>(
    initialScenarioUrlState.contributionScope,
  );
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("swingometer");
  const [nightBehavior, setNightBehavior] = useState<ElectionNightBehavior>(() => ({
    ...DEFAULT_ELECTION_NIGHT_BEHAVIOR,
    stateDelayMinutes: { ...DEFAULT_ELECTION_NIGHT_BEHAVIOR.stateDelayMinutes },
    countyOverrides: [],
  }));
  const [appliedNightBehavior, setAppliedNightBehavior] = useState<ElectionNightBehavior | null>(null);
  const [savedNightProfiles, setSavedNightProfiles] = useState<SavedNightProfile[]>(readSavedNightProfiles);
  const [selectedNightProfileId, setSelectedNightProfileId] = useState("balanced");
  const [nightProfileName, setNightProfileName] = useState("");
  const [nightProfileFeedback, setNightProfileFeedback] = useState<string | null>(null);
  const [nightOverrideState, setNightOverrideState] = useState<DetailedStateCode>("PA");
  const [nightOverrideCountyId, setNightOverrideCountyId] = useState("");
  const [nightDockTab, setNightDockTab] = useState<NightDockTab>("live");
  const replay = useReplayExperience();
  const nightChronologyPreview = useMemo(
    () => buildElectionNightChronologyPreview(nightBehavior),
    [nightBehavior],
  );
  const nightOverrideCounties = useMemo(
    () => getDetailedStateCounties(nightOverrideState),
    [nightOverrideState],
  );
  const nightBehaviorDirty = appliedNightBehavior == null
    || nightBehaviorFingerprint(appliedNightBehavior) !== nightBehaviorFingerprint(nightBehavior);
  const [laboratoryDrawerSnap, setLaboratoryDrawerSnap] = useState<LaboratoryDrawerSnap>(
    initialScenarioUrlState.selectedCountyFips || initialScenarioUrlState.selectedVtdGeoid ? "working" : "collapsed",
  );
  const [laboratoryDrawerTab, setLaboratoryDrawerTab] = useState<LaboratoryDrawerTab>(
    initialScenarioUrlState.selectedCountyFips || initialScenarioUrlState.selectedVtdGeoid ? "inspector" : "behavior",
  );
  const [laboratoryDrawerDragHeight, setLaboratoryDrawerDragHeight] = useState<number | null>(null);
  const [fitSelectionRequest, setFitSelectionRequest] = useState(0);
  const [routeAlternativesOpen, setRouteAlternativesOpen] = useState(false);
  const laboratoryDrawerRef = useRef<HTMLDivElement>(null);
  const drawerDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const routeAlternativesButtonRef = useRef<HTMLButtonElement>(null);
  const replaySeekTimerRef = useRef<number | null>(null);
  const replayTimelineInputRef = useRef<HTMLInputElement>(null);
  const [scenarioLinkNotice, setScenarioLinkNotice] = useState<string | null>(
    scenarioUrlNotice(initialScenarioUrlLoad),
  );
  const [copiedScenarioUrl, setCopiedScenarioUrl] = useState<string | null>(null);
  const [failedScenarioUrl, setFailedScenarioUrl] = useState<string | null>(null);
  const observedScenarioSearch = useRef(window.location.search);
  const observedWorkspacePath = useRef(window.location.pathname);
  const behaviorScenarioSettings = useMemo(() => ({
    turnoutIncreasePoints,
    addedVoterHarrisShare: addedVoterHarrisShare / 100,
    preferenceShiftPoints,
    thirdPartyCandidate,
    thirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare: thirdPartyHarrisExchangeShare / 100,
  }), [
    addedVoterHarrisShare,
    preferenceShiftPoints,
    thirdPartyCandidate,
    thirdPartyHarrisExchangeShare,
    thirdPartyShiftPoints,
    turnoutIncreasePoints,
  ]);
  const activeDetailedStateManifest = getDetailedStateManifest(activeDetailedStateCode);
  const {
    foundation: detailedStateFoundation,
    scenario: behaviorScenario,
    error: demographicError,
    pending: detailedScenarioPending,
  } = useDetailedStateScenario(
    activeDetailedStateManifest,
    behaviorScenarioSettings,
  );
  const demographicFoundation = detailedStateFoundation?.stateCode === activeDetailedStateCode
    ? detailedStateFoundation
    : null;

  const applyScenarioUrlState = useCallback((state: ScenarioUrlState) => {
    setTargetCandidate(state.targetCandidate);
    setRouteMetric(state.routeMetric);
    setSelectedRouteStateCodes(state.selectedRouteStateCodes);
    setTurnoutIncreasePoints(state.turnoutIncreasePoints);
    setAddedVoterHarrisShare(state.addedVoterHarrisShare);
    setPreferenceShiftPoints(state.preferenceShiftPoints);
    setThirdPartyCandidate(state.thirdPartyCandidate);
    setThirdPartyShiftPoints(state.thirdPartyShiftPoints);
    setThirdPartyHarrisExchangeShare(state.thirdPartyHarrisExchangeShare);
    setViewMode(state.viewMode);
    setBehaviorEditorMode(state.behaviorEditorMode);
    setContributionScope(state.contributionScope);
    setSelectedStateCode(state.selectedStateCode);
    setSelectedCountyFips(state.selectedCountyFips);
    setSelectedVtdGeoid(state.selectedVtdGeoid);
    if (state.selectedCountyFips || state.selectedVtdGeoid) {
      setLaboratoryDrawerTab("inspector");
      setLaboratoryDrawerSnap("working");
    } else if (!state.selectedStateCode) {
      setLaboratoryDrawerSnap("collapsed");
    }
    const nextActiveState = state.activeDetailedStateCode
      ?? (isDetailedStateCode(state.selectedStateCode ?? "")
        ? state.selectedStateCode as DetailedStateCode
        : pennsylvaniaDetailedStateManifest.code);
    setActiveDetailedStateCode(nextActiveState);
    if (state.portfolioRecipes) {
      setStoredScenarioRecipes(recipesAsRecord(state.portfolioRecipes));
    } else {
      const settings: StateBehaviorRecipeSettings = {
        turnoutIncreasePoints: state.turnoutIncreasePoints,
        addedVoterHarrisShare: state.addedVoterHarrisShare,
        preferenceShiftPoints: state.preferenceShiftPoints,
        thirdPartyCandidate: state.thirdPartyCandidate,
        thirdPartyShiftPoints: state.thirdPartyShiftPoints,
        thirdPartyHarrisExchangeShare: state.thirdPartyHarrisExchangeShare,
      };
      setStoredScenarioRecipes(isDefaultStateBehaviorSettings(settings)
        ? {}
        : recipesAsRecord([createStateScenarioRecipe(nextActiveState, settings)]));
    }
  }, []);

  useEffect(() => {
    function restoreBrowserHistoryState() {
      const nextWorkspaceMode: WorkspaceMode = isLaboratoryPath(window.location.pathname) || window.location.search
        ? "laboratory"
        : "home";
      setWorkspaceMode(nextWorkspaceMode);
      if (
        window.location.search === observedScenarioSearch.current
        && window.location.pathname === observedWorkspacePath.current
      ) return;
      observedWorkspacePath.current = window.location.pathname;
      if (nextWorkspaceMode === "home" && !window.location.search) {
        observedScenarioSearch.current = "";
        return;
      }
      observedScenarioSearch.current = window.location.search;
      const load = decodeScenarioSearch(window.location.search);
      applyScenarioUrlState(load.state);
      setScenarioLinkNotice(scenarioUrlNotice(load));
      setCopiedScenarioUrl(null);
      setFailedScenarioUrl(null);
    }
    window.addEventListener("popstate", restoreBrowserHistoryState);
    return () => window.removeEventListener("popstate", restoreBrowserHistoryState);
  }, [applyScenarioUrlState]);

  useEffect(() => {
    if (!routeAlternativesOpen) return;
    const closeAlternatives = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setRouteAlternativesOpen(false);
      requestAnimationFrame(() => routeAlternativesButtonRef.current?.focus());
    };
    window.addEventListener("keydown", closeAlternatives, true);
    return () => window.removeEventListener("keydown", closeAlternatives, true);
  }, [routeAlternativesOpen]);

  useEffect(() => () => {
    if (replaySeekTimerRef.current != null) window.clearTimeout(replaySeekTimerRef.current);
  }, []);

  useEffect(() => {
    if (replaySeekTimerRef.current == null && replayTimelineInputRef.current) {
      replayTimelineInputRef.current.value = String(replay.timelineProgressMillionths);
    }
  }, [replay.timelineProgressMillionths]);

  const detailedActual = states2024.find(
    (state) => state.code === activeDetailedStateCode,
  )!;
  const detailedCounties = useMemo(
    () => getDetailedStateCounties(activeDetailedStateCode),
    [activeDetailedStateCode],
  );
  const detailedElection = useMemo(
    () => getDetailedStateElection(activeDetailedStateCode),
    [activeDetailedStateCode],
  );
  const detailedSource = useMemo(
    () => getDetailedStateSource(activeDetailedStateCode),
    [activeDetailedStateCode],
  );
  const detailedGeographies = useMemo(
    () => demographicFoundation ? getDetailedStateGeographies(demographicFoundation) : [],
    [demographicFoundation],
  );
  const behaviorModelUnits = useMemo(
    () => demographicFoundation ? toDetailedBehaviorModelUnits(demographicFoundation) : null,
    [demographicFoundation],
  );
  const preferenceBase = useMemo(() => ({
    harrisVotes: detailedActual.harrisVotes + (behaviorScenario?.turnout.harrisVotes ?? 0),
    trumpVotes: detailedActual.trumpVotes + (behaviorScenario?.turnout.trumpVotes ?? 0),
    totalVotes: detailedActual.totalVotes + (behaviorScenario?.turnout.addedVotes ?? 0),
  }), [behaviorScenario, detailedActual]);
  const preferenceBounds = useMemo(
    () => preferenceShiftBounds(preferenceBase),
    [preferenceBase],
  );
  const effectivePreferenceShiftPoints = Math.min(
    preferenceBounds.towardHarrisPoints,
    Math.max(preferenceBounds.towardTrumpPoints, preferenceShiftPoints),
  );
  const fallbackThirdPartyVotes = thirdPartyCandidate === "stein"
    ? detailedElection.totals.steinVotes
    : thirdPartyCandidate === "oliver"
      ? detailedElection.totals.oliverVotes
      : detailedElection.totals.residualOtherVotes;
  const thirdPartyBallotTotal = behaviorScenario?.thirdParty.ballotTotal
    ?? detailedElection.totals.totalVotes;
  const thirdPartyStartingVotes = behaviorScenario?.thirdParty.startingCandidateVotes
    ?? fallbackThirdPartyVotes;
  const thirdPartyExchangeCapacity = behaviorScenario?.thirdParty.exchangeCapacity
    ?? Math.min(detailedElection.totals.harrisVotes, detailedElection.totals.trumpVotes) * 2;
  const thirdPartyMinimumPoints = -(thirdPartyStartingVotes * 100) / thirdPartyBallotTotal;
  const thirdPartyMaximumPoints = (thirdPartyExchangeCapacity * 100) / thirdPartyBallotTotal;
  const effectiveThirdPartyShiftPoints = Math.min(
    thirdPartyMaximumPoints,
    Math.max(thirdPartyMinimumPoints, thirdPartyShiftPoints),
  );
  const currentStateRecipeSettings = useMemo<StateBehaviorRecipeSettings>(() => ({
    turnoutIncreasePoints,
    addedVoterHarrisShare,
    preferenceShiftPoints: effectivePreferenceShiftPoints,
    thirdPartyCandidate,
    thirdPartyShiftPoints: effectiveThirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare,
  }), [
    addedVoterHarrisShare,
    effectivePreferenceShiftPoints,
    effectiveThirdPartyShiftPoints,
    thirdPartyCandidate,
    thirdPartyHarrisExchangeShare,
    turnoutIncreasePoints,
  ]);
  const scenarioRecipeRecord = useMemo(() => {
    const next = { ...storedScenarioRecipes };
    if (isDefaultStateBehaviorSettings(currentStateRecipeSettings)) {
      delete next[activeDetailedStateCode];
    } else {
      next[activeDetailedStateCode] = createStateScenarioRecipe(
        activeDetailedStateCode,
        currentStateRecipeSettings,
      );
    }
    return next;
  }, [activeDetailedStateCode, currentStateRecipeSettings, storedScenarioRecipes]);
  const portfolioRecipes = useMemo(
    () => (Object.values(scenarioRecipeRecord) as StateScenarioRecipe[])
      .sort((left, right) => left.stateCode.localeCompare(right.stateCode)),
    [scenarioRecipeRecord],
  );
  const inactivePortfolioRecipes = useMemo(
    () => portfolioRecipes.filter((recipe) => recipe.stateCode !== activeDetailedStateCode),
    [activeDetailedStateCode, portfolioRecipes],
  );
  const {
    summaries: inactiveScenarioSummaries,
    pending: portfolioPending,
    error: portfolioError,
  } = useScenarioPortfolio(inactivePortfolioRecipes);
  const scenarioPending = detailedScenarioPending || portfolioPending;
  const scenarioUrlState = useMemo<ScenarioUrlState>(() => ({
    targetCandidate,
    routeMetric,
    selectedRouteStateCodes,
    turnoutIncreasePoints,
    addedVoterHarrisShare,
    preferenceShiftPoints: effectivePreferenceShiftPoints,
    thirdPartyCandidate,
    thirdPartyShiftPoints: effectiveThirdPartyShiftPoints,
    thirdPartyHarrisExchangeShare,
    viewMode,
    behaviorEditorMode,
    contributionScope,
    selectedStateCode,
    selectedCountyFips,
    selectedVtdGeoid,
    activeDetailedStateCode,
    portfolioRecipes,
  }), [
    activeDetailedStateCode,
    addedVoterHarrisShare,
    behaviorEditorMode,
    contributionScope,
    effectivePreferenceShiftPoints,
    effectiveThirdPartyShiftPoints,
    portfolioRecipes,
    routeMetric,
    selectedRouteStateCodes,
    selectedCountyFips,
    selectedStateCode,
    selectedVtdGeoid,
    thirdPartyCandidate,
    thirdPartyHarrisExchangeShare,
    targetCandidate,
    turnoutIncreasePoints,
    viewMode,
  ]);

  const currentScenarioShareUrl = useMemo(() => buildScenarioUrl(
    workspaceUrl("laboratory").toString(),
    scenarioUrlState,
    { force: true, clearHash: true },
  ), [scenarioUrlState]);
  const shareStatus = copiedScenarioUrl === currentScenarioShareUrl
    ? "copied"
    : failedScenarioUrl === currentScenarioShareUrl
      ? "error"
      : "idle";

  useEffect(() => {
    if (workspaceMode !== "laboratory" || !demographicFoundation || scenarioPending) return;
    const laboratoryHref = workspaceUrl("laboratory").toString();
    const nextUrl = buildScenarioUrl(laboratoryHref, scenarioUrlState);
    if (nextUrl !== window.location.href) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
    observedScenarioSearch.current = window.location.search;
    observedWorkspacePath.current = window.location.pathname;
  }, [demographicFoundation, scenarioPending, scenarioUrlState, workspaceMode]);

  const detailedScenario = useMemo<StatewidePresidentialResult>(() => {
    if (!behaviorScenario) return detailedActual;
    const harrisWins = behaviorScenario.totals.harrisVotes > behaviorScenario.totals.trumpVotes;
    return {
      ...detailedActual,
      ...behaviorScenario.totals,
      harrisElectoralVotes: harrisWins
        ? activeDetailedStateManifest.election.electoralVotes
        : 0,
      trumpElectoralVotes: harrisWins
        ? 0
        : activeDetailedStateManifest.election.electoralVotes,
    };
  }, [activeDetailedStateManifest, behaviorScenario, detailedActual]);

  const scenarioStates = useMemo(() => states2024.map((state) => {
    const recipe = scenarioRecipeRecord[state.code as DetailedStateCode];
    if (!recipe) return state;
    if (state.code === activeDetailedStateCode) {
      return detailedScenarioPending ? state : detailedScenario;
    }
    const summary = inactiveScenarioSummaries.get(state.code);
    return summary?.recipeFingerprint === stateScenarioRecipeFingerprint(recipe)
      ? summaryAsStateResult(summary, state)
      : state;
  }), [
    activeDetailedStateCode,
    detailedScenario,
    detailedScenarioPending,
    inactiveScenarioSummaries,
    scenarioRecipeRecord,
  ]);

  const actualNational = useMemo(() => aggregateNational(states2024), []);
  const scenarioNational = useMemo(
    () => aggregateNational(scenarioStates),
    [scenarioStates],
  );
  const electoralConsequences = useMemo(() => buildElectoralConsequenceModel(
    states2024,
    scenarioStates,
    portfolioRecipes.map((recipe) => recipe.stateCode),
    targetCandidate,
  ), [portfolioRecipes, scenarioStates, targetCandidate]);
  const consequenceSummary = useMemo(
    () => electoralCausalSummary(electoralConsequences),
    [electoralConsequences],
  );
  const pathTo270 = useMemo(() => buildPathTo270Model(
    scenarioStates,
    portfolioRecipes.map((recipe) => recipe.stateCode),
    listDetailedStateManifests().map((manifest) => manifest.code),
    electoralConsequences.consequentialRows
      .filter((row) => row.targetElectoralDelta > 0)
      .map((row) => row.stateCode),
    targetCandidate,
    routeMetric,
  ), [electoralConsequences, portfolioRecipes, routeMetric, scenarioStates, targetCandidate]);
  const routeConstructionPlan = useMemo(() => buildRouteConstructionPlan(
    states2024,
    scenarioStates,
    portfolioRecipes.map((recipe) => recipe.stateCode),
    listDetailedStateManifests().map((manifest) => manifest.code),
    selectedRouteStateCodes,
    targetCandidate,
  ), [portfolioRecipes, scenarioStates, selectedRouteStateCodes, targetCandidate]);
  const selectedRouteConstructionState = routeConstructionPlan?.states.find(
    (state) => state.stateCode === selectedStateCode,
  ) ?? null;
  const activeRouteConstructionState = selectedRouteConstructionState?.detailedModelAvailable
    && selectedStateCode === activeDetailedStateCode
    ? selectedRouteConstructionState
    : null;
  const scenarioDetailedCounties = useMemo(
    () => buildDetailedScenarioCounties(
      detailedCounties,
      behaviorModelUnits,
      behaviorScenario?.units ?? null,
    ),
    [behaviorModelUnits, behaviorScenario, detailedCounties],
  );
  const scenarioDetailedGeographies = useMemo(
    () => scenarioDetailedGeographyMap(behaviorScenario?.units ?? []),
    [behaviorScenario],
  );
  const replayJurisdictions = replay.current?.election.jurisdictions;
  const replayScenarioStates = useMemo<StatewidePresidentialResult[]>(() => (
    replayJurisdictions?.flatMap((jurisdiction) => {
      if (jurisdiction.totalReportedVotes === 0) return [];
      const harrisVotes = replayCandidateVotes(jurisdiction, "harris");
      const trumpVotes = replayCandidateVotes(jurisdiction, "trump");
      return [{
        code: jurisdiction.jurisdictionId,
        harrisVotes,
        trumpVotes,
        otherVotes: jurisdiction.totalReportedVotes - harrisVotes - trumpVotes,
        totalVotes: jurisdiction.totalReportedVotes,
        harrisElectoralVotes: 0,
        trumpElectoralVotes: 0,
      }];
    }) ?? []
  ), [replayJurisdictions]);
  const replayDetailedCounties = useMemo(() => {
    const actualByFips = new Map(detailedCounties.map((county) => [county.fips, county]));
    return replay.reportedCounties
      .filter((county) => county.jurisdictionId === activeDetailedStateCode)
      .flatMap((county) => {
        const actual = actualByFips.get(county.countyId);
        if (!actual) return [];
        const harrisVotes = replayCandidateVotes(county, "harris");
        const trumpVotes = replayCandidateVotes(county, "trump");
        return [{
          ...actual,
          harrisVotes,
          trumpVotes,
          otherVotes: county.totalReportedVotes - harrisVotes - trumpVotes,
          totalVotes: county.totalReportedVotes,
          netHarrisGain: 0,
        }];
      });
  }, [activeDetailedStateCode, detailedCounties, replay.reportedCounties]);
  const replayDetailedGeographies = useMemo(() => {
    if (!behaviorModelUnits) return new Map<string, BehaviorScenarioUnit>();
    const reportedByUnitId = new Map(replay.publishedUnits
      .filter((unit) => unit.jurisdictionId === activeDetailedStateCode)
      .map((unit) => [unit.unitId, unit]));
    const reportedUnits = behaviorModelUnits.flatMap((unit): BehaviorScenarioUnit[] => {
      const reported = reportedByUnitId.get(unit.id);
      if (!reported || !unit.geometryId || reported.totalReportedVotes === 0) return [];
      const harrisVotes = replayCandidateVotes(reported, "harris");
      const trumpVotes = replayCandidateVotes(reported, "trump");
      return [{
        ...unit,
        harrisVotes,
        trumpVotes,
        otherVotes: reported.totalReportedVotes - harrisVotes - trumpVotes,
        steinVotes: replayCandidateVotes(reported, "stein"),
        oliverVotes: replayCandidateVotes(reported, "oliver"),
        residualOtherVotes: replayCandidateVotes(reported, "other-residual"),
        totalVotes: reported.totalReportedVotes,
        turnoutAddedVotes: 0,
        turnoutHarrisVotes: 0,
        turnoutTrumpVotes: 0,
        preferenceNetHarrisGain: 0,
        thirdPartyCandidateDelta: 0,
        netHarrisGain: 0,
      }];
    });
    return scenarioDetailedGeographyMap(reportedUnits);
  }, [activeDetailedStateCode, behaviorModelUnits, replay.publishedUnits]);
  const displayedScenarioStates = experienceMode === "election-night"
    ? replayScenarioStates
    : scenarioStates;
  const displayedDetailedCounties = experienceMode === "election-night"
    ? replayDetailedCounties
    : scenarioDetailedCounties;
  const displayedDetailedGeographies = experienceMode === "election-night"
    ? replayDetailedGeographies
    : scenarioDetailedGeographies;
  const contributionSummary = useMemo(() => {
    const empty = {
      counties: [] as ContributionRow[],
      vtds: [] as ContributionRow[],
      statewideMarginDelta: 0,
      outsideCountyMarginDelta: 0,
      outsideTerrainMarginDelta: 0,
    };
    if (!behaviorModelUnits || !behaviorScenario || !demographicFoundation) return empty;

    const contributions = deriveBehaviorContributions(
      behaviorModelUnits,
      behaviorScenario.units,
    );
    const countyNames = new Map(
      detailedCounties.map((county) => [county.fips, county.name]),
    );
    const countyTotals = new Map<string, number>();
    let statewideMarginDelta = 0;
    let countyMappedMarginDelta = 0;
    let mappedMarginDelta = 0;
    for (const contribution of contributions) {
      statewideMarginDelta += contribution.marginDelta;
      if (contribution.countyFips) {
        countyMappedMarginDelta += contribution.marginDelta;
        countyTotals.set(
          contribution.countyFips,
          (countyTotals.get(contribution.countyFips) ?? 0) + contribution.marginDelta,
        );
      }
      if (contribution.geometryId) mappedMarginDelta += contribution.marginDelta;
    }
    const counties = [...countyTotals.entries()]
      .map(([countyFips, marginDelta]) => ({
        id: countyFips,
        name: countyNames.get(countyFips) ?? countyFips,
        context: "County total",
        countyFips,
        vtdGeoid: null,
        marginDelta,
      }))
      .filter((row) => row.marginDelta !== 0)
      .sort((left, right) => Math.abs(right.marginDelta) - Math.abs(left.marginDelta));
    const geographyById = new Map(detailedGeographies.map((geography) => [geography.id, geography]));
    const vtds = contributions
      .filter((contribution) => contribution.geometryId && contribution.marginDelta !== 0)
      .map((contribution) => {
        const geography = geographyById.get(contribution.geometryId!);
        const countyFips = contribution.countyFips ?? geography?.countyFips ?? "";
        return {
          id: contribution.geometryId!,
          name: geography?.name ?? contribution.geometryId!,
          context: countyNames.get(countyFips) ?? countyFips,
          countyFips,
          vtdGeoid: contribution.geometryId!,
          marginDelta: contribution.marginDelta,
        };
      })
      .sort((left, right) => Math.abs(right.marginDelta) - Math.abs(left.marginDelta));
    return {
      counties,
      vtds,
      statewideMarginDelta,
      outsideCountyMarginDelta: statewideMarginDelta - countyMappedMarginDelta,
      outsideTerrainMarginDelta: statewideMarginDelta - mappedMarginDelta,
    };
  }, [behaviorModelUnits, behaviorScenario, demographicFoundation, detailedCounties, detailedGeographies]);

  const selectedActual = states2024.find((state) => state.code === selectedStateCode) ?? detailedActual;
  const selectedScenario = scenarioStates.find((state) => state.code === selectedStateCode) ?? detailedScenario;
  const selectedStateFlipRequirement = selectedStateCode
    ? buildStateFlipRequirement(selectedActual, selectedScenario, targetCandidate)
    : null;
  const selectedActualCounty = detailedCounties.find(
    (county) => county.fips === selectedCountyFips,
  );
  const selectedScenarioCounty = scenarioDetailedCounties.find(
    (county) => county.fips === selectedCountyFips,
  );
  const selectedVtd = useMemo(
    () => selectedVtdGeoid
      ? detailedGeographies.find((geography) => geography.id === selectedVtdGeoid)
      : undefined,
    [detailedGeographies, selectedVtdGeoid],
  );
  const selectedVtdScenario = selectedVtdGeoid
    ? scenarioDetailedGeographies.get(selectedVtdGeoid)
    : undefined;
  const replaySelectedState = replay.current?.election.jurisdictions.find(
    (jurisdiction) => jurisdiction.jurisdictionId === selectedStateCode,
  ) ?? null;
  const replaySelectedCounty = replay.reportedCounties.find(
    (county) => county.jurisdictionId === selectedStateCode && county.countyId === selectedCountyFips,
  ) ?? null;
  const replaySelectedModelUnit = selectedVtdGeoid
    ? behaviorModelUnits?.find((unit) => unit.geometryId === selectedVtdGeoid)
    : null;
  const replaySelectedUnit = replaySelectedModelUnit
    ? replay.publishedUnits.find((unit) => (
      unit.jurisdictionId === selectedStateCode && unit.unitId === replaySelectedModelUnit.id
    )) ?? null
    : null;
  const replayPresentedResult = replaySelectedUnit
    ?? replaySelectedCounty
    ?? replaySelectedState
    ?? replay.current?.election.national
    ?? null;
  const replayPresentedHarrisVotes = replayCandidateVotes(replayPresentedResult, "harris");
  const replayPresentedTrumpVotes = replayCandidateVotes(replayPresentedResult, "trump");
  const replayPresentedTotalVotes = replayPresentedResult?.totalReportedVotes ?? 0;
  const replayPresentedMargin = replayPresentedTotalVotes > 0
    ? ((replayPresentedHarrisVotes - replayPresentedTrumpVotes) / replayPresentedTotalVotes) * 100
    : null;
  const replayNational = replay.current?.election.national ?? null;
  const replayNationalHarrisVotes = replayCandidateVotes(replayNational, "harris");
  const replayNationalTrumpVotes = replayCandidateVotes(replayNational, "trump");
  const replayNationalMarginVotes = replayNationalHarrisVotes - replayNationalTrumpVotes;
  const activeModelSemantics = useMemo(
    () => getStateModelSemantics(activeDetailedStateCode),
    [activeDetailedStateCode],
  );
  const activeOperationSemantics = activeModelSemantics.operations[behaviorEditorMode];
  const replayCountyNames = useMemo(() => new Map(
    (["PA", "MI", "WI"] as const).flatMap((stateCode) => (
      getDetailedStateCounties(stateCode).map((county) => [`${stateCode}:${county.fips}`, county.name] as const)
    )),
  ), []);
  const selectedInspector = useMemo(() => {
    if (!demographicFoundation || !behaviorScenario) return null;
    if (selectedVtd) {
      return buildDetailedGeographyInspector(
        selectedVtd,
        selectedVtdScenario,
        selectedActualCounty?.name ?? activeDetailedStateManifest.name,
        thirdPartyCandidate,
      );
    }
    if (selectedActualCounty && selectedScenarioCounty) {
      return buildDetailedCountyInspector(
        selectedActualCounty,
        selectedScenarioCounty,
        demographicFoundation,
        detailedGeographies,
        behaviorScenario.units,
        thirdPartyCandidate,
      );
    }
    return null;
  }, [
    behaviorScenario,
    activeDetailedStateManifest,
    demographicFoundation,
    detailedGeographies,
    selectedActualCounty,
    selectedScenarioCounty,
    selectedVtd,
    selectedVtdScenario,
    thirdPartyCandidate,
  ]);
  const activeScenarioChanged = !isDefaultStateBehaviorSettings(currentStateRecipeSettings);
  const contributionRows = contributionScope === "county"
    ? contributionSummary.counties.slice(0, 5)
    : contributionSummary.vtds.slice(0, 5);
  const contributionEmptyText = activeScenarioChanged && contributionSummary.statewideMarginDelta === 0
    ? "The active operations change ballots but net to no Harris minus Trump margin movement."
    : contributionScope === "county" && contributionSummary.outsideCountyMarginDelta !== 0
      ? "This movement is confined to the statewide-only residual and has no honest county placement."
      : contributionScope === "vtd" && contributionSummary.outsideTerrainMarginDelta !== 0
        ? "This movement remains outside mapped VTD terrain."
        : "Move any behavior control to reveal the geography of the change.";
  const contributionMaximum = Math.max(
    1,
    ...contributionRows.map((row) => Math.abs(row.marginDelta)),
  );
  const preferenceZeroPosition = (
    Math.abs(preferenceBounds.towardTrumpPoints)
    / (preferenceBounds.towardHarrisPoints - preferenceBounds.towardTrumpPoints)
  ) * 100;
  const thirdPartyZeroPosition = (
    Math.abs(thirdPartyMinimumPoints)
    / (thirdPartyMaximumPoints - thirdPartyMinimumPoints)
  ) * 100;
  const thirdPartyScenarioVotes = thirdPartyStartingVotes
    + (behaviorScenario?.thirdParty.realizedCandidateDelta ?? 0);
  const readoutActualMargin = selectedVtd
    ? selectedVtd.baselineVotes.totalVotes > 0
      ? margin(selectedVtd.baselineVotes)
      : null
    : selectedActualCounty
      ? margin(selectedActualCounty)
    : selectedStateCode
      ? margin(selectedActual)
      : ((actualNational.harrisVotes - actualNational.trumpVotes) / actualNational.totalVotes) * 100;
  const readoutScenarioMargin = selectedVtd
    ? selectedVtdScenario && selectedVtdScenario.totalVotes > 0
      ? margin(selectedVtdScenario)
      : null
    : selectedScenarioCounty
      ? margin(selectedScenarioCounty)
    : selectedStateCode
      ? margin(selectedScenario)
      : ((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100;
  const selectedGeographyName = selectedVtd?.name
    ?? selectedActualCounty?.name
    ?? (selectedStateCode ? selectedActual.name : "United States");
  const presentedGeographyName = workspaceMode === "home" ? "United States" : selectedGeographyName;
  const presentedActualMargin = workspaceMode === "home"
    ? ((actualNational.harrisVotes - actualNational.trumpVotes) / actualNational.totalVotes) * 100
    : readoutActualMargin;
  const presentedScenarioMargin = workspaceMode === "home"
    ? ((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100
    : readoutScenarioMargin;
  const presentedShift = presentedActualMargin == null || presentedScenarioMargin == null
    ? null
    : presentedScenarioMargin - presentedActualMargin;
  const activeGeographyShortLabel = activeDetailedStateManifest.geography.unitLabelPlural;
  const activeGeographyFullLabel = activeDetailedStateCode === "PA"
    ? "Voting districts (VTDs)"
    : activeDetailedStateCode === "WI"
      ? "LTSB reconstructed wards"
      : "2024 precinct reporting units";
  const evidenceLedger = getStateEvidenceLedger(activeDetailedStateCode);
  const mutationScopeName = selectedActualCounty?.name
    ?? (selectedStateCode ? selectedActual.name : "United States");

  function applyStateRecipeSettings(settings: StateBehaviorRecipeSettings) {
    setTurnoutIncreasePoints(settings.turnoutIncreasePoints);
    setAddedVoterHarrisShare(settings.addedVoterHarrisShare);
    setPreferenceShiftPoints(settings.preferenceShiftPoints);
    setThirdPartyCandidate(settings.thirdPartyCandidate);
    setThirdPartyShiftPoints(settings.thirdPartyShiftPoints);
    setThirdPartyHarrisExchangeShare(settings.thirdPartyHarrisExchangeShare);
  }

  function selectState(code: string | null) {
    setSelectedVtdGeoid(null);
    setSelectedCountyFips(null);
    setSelectedStateCode(code);
    if (!code || !isDetailedStateCode(code) || code === activeDetailedStateCode) return;
    setStoredScenarioRecipes(scenarioRecipeRecord);
    setActiveDetailedStateCode(code);
    applyStateRecipeSettings(scenarioRecipeRecord[code]?.settings ?? DEFAULT_STATE_BEHAVIOR_SETTINGS);
  }

  function selectMapState(code: string | null) {
    if (experienceMode === "election-night" && code && !isDetailedStateCode(code)) return;
    if (workspaceMode === "home" && code) navigateWorkspace("laboratory");
    selectState(code);
  }

  function selectRoute(route: PathTo270Route, stateCode?: string) {
    setSelectedRouteStateCodes(
      route.states.map((state) => state.stateCode).sort((left, right) => left.localeCompare(right)),
    );
    if (stateCode) selectState(stateCode);
  }

  function changeTargetCandidate(candidate: MajorCandidate) {
    if (candidate !== targetCandidate) setSelectedRouteStateCodes([]);
    setTargetCandidate(candidate);
  }

  function selectNation() {
    setStoredScenarioRecipes(scenarioRecipeRecord);
    setSelectedVtdGeoid(null);
    setSelectedCountyFips(null);
    setSelectedStateCode(null);
    setLaboratoryDrawerSnap("collapsed");
  }

  function navigateWorkspace(mode: WorkspaceMode) {
    if (mode === "laboratory") {
      const laboratoryUrl = buildScenarioUrl(
        workspaceUrl("laboratory").toString(),
        scenarioUrlState,
      );
      window.history.pushState(window.history.state, "", laboratoryUrl);
      observedScenarioSearch.current = window.location.search;
      observedWorkspacePath.current = window.location.pathname;
      setWorkspaceMode("laboratory");
      return;
    }
    replay.stop();
    setExperienceMode("swingometer");
    const homeUrl = workspaceUrl("home");
    window.history.pushState(window.history.state, "", homeUrl);
    observedScenarioSearch.current = "";
    observedWorkspacePath.current = window.location.pathname;
    setWorkspaceMode("home");
  }

  function selectCounty(fips: string | null) {
    setSelectedVtdGeoid(null);
    setSelectedCountyFips(fips);
    if (fips) {
      setLaboratoryDrawerTab("inspector");
      setLaboratoryDrawerSnap("working");
    }
  }

  function selectPrecinct(geoid: string | null) {
    setSelectedVtdGeoid(geoid);
    if (geoid) {
      setLaboratoryDrawerTab("inspector");
      setLaboratoryDrawerSnap("working");
    }
  }

  function openLaboratoryPanel(tab: LaboratoryDrawerTab) {
    setAssumptionsOpen(true);
    setLaboratoryDrawerTab(tab);
    if (laboratoryDrawerSnap === "collapsed") changeDrawerSnap("working");
  }

  function handleLaboratoryTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, tab: LaboratoryDrawerTab) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = laboratoryDrawerTabs.indexOf(tab);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? laboratoryDrawerTabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + laboratoryDrawerTabs.length) % laboratoryDrawerTabs.length;
    const nextTab = laboratoryDrawerTabs[nextIndex];
    openLaboratoryPanel(nextTab);
    requestAnimationFrame(() => document.getElementById(`laboratory-tab-${nextTab}`)?.focus());
  }

  function resetScenario() {
    setTurnoutIncreasePoints(DEFAULT_SCENARIO_URL_STATE.turnoutIncreasePoints);
    setAddedVoterHarrisShare(DEFAULT_SCENARIO_URL_STATE.addedVoterHarrisShare);
    setPreferenceShiftPoints(DEFAULT_SCENARIO_URL_STATE.preferenceShiftPoints);
    setThirdPartyCandidate(DEFAULT_SCENARIO_URL_STATE.thirdPartyCandidate);
    setThirdPartyShiftPoints(DEFAULT_SCENARIO_URL_STATE.thirdPartyShiftPoints);
    setThirdPartyHarrisExchangeShare(
      DEFAULT_SCENARIO_URL_STATE.thirdPartyHarrisExchangeShare,
    );
    setViewMode(DEFAULT_SCENARIO_URL_STATE.viewMode);
  }

  async function copyScenarioLink() {
    const copied = await writeClipboardText(currentScenarioShareUrl);
    if (copied) {
      setCopiedScenarioUrl(currentScenarioShareUrl);
      setFailedScenarioUrl(null);
    } else {
      setFailedScenarioUrl(currentScenarioShareUrl);
      setCopiedScenarioUrl(null);
    }
  }

  function focusContribution(row: ContributionRow) {
    selectState(activeDetailedStateCode);
    setSelectedCountyFips(row.countyFips);
    setSelectedVtdGeoid(row.vtdGeoid);
    setLaboratoryDrawerTab("inspector");
    setLaboratoryDrawerSnap("working");
  }

  function changeDrawerSnap(snap: LaboratoryDrawerSnap) {
    setLaboratoryDrawerDragHeight(null);
    setLaboratoryDrawerSnap(snap);
  }

  function handleDrawerPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const drawer = laboratoryDrawerRef.current;
    if (!drawer) return;
    drawerDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: drawer.getBoundingClientRect().height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDrawerPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = drawerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const minimum = 64;
    const maximum = Math.max(320, window.innerHeight - 210);
    setLaboratoryDrawerDragHeight(Math.min(maximum, Math.max(minimum, drag.startHeight + drag.startY - event.clientY)));
  }

  function handleDrawerPointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = drawerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const height = laboratoryDrawerRef.current?.getBoundingClientRect().height ?? 64;
    drawerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    changeDrawerSnap(height < window.innerHeight * 0.25 ? "collapsed" : height > window.innerHeight * 0.6 ? "expanded" : "working");
  }

  function chooseThirdPartyCandidate(candidate: ThirdPartyCandidate) {
    setThirdPartyCandidate(candidate);
    setThirdPartyShiftPoints(0);
  }

  function beginElectionNight() {
    if (scenarioPending) return;
    const recipes = Object.fromEntries((["PA", "MI", "WI"] as const).map((stateCode) => [
      stateCode,
      (scenarioRecipeRecord[stateCode]
        ?? createStateScenarioRecipe(stateCode, DEFAULT_STATE_BEHAVIOR_SETTINGS)).settings,
    ])) as Record<DetailedStateCode, StateBehaviorRecipeSettings>;
    replay.start({
      recipes,
      behavior: nightBehavior,
    });
    setAppliedNightBehavior(cloneNightBehavior(nightBehavior));
    setNightProfileFeedback("Chronology applied. The count restarted from zero.");
    if (selectedStateCode && !isDetailedStateCode(selectedStateCode)) selectNation();
    setViewMode("scenario");
    if (experienceMode !== "election-night") {
      window.requestAnimationFrame(() => setFitSelectionRequest((request) => request + 1));
      setNightDockTab("live");
      changeDrawerSnap("collapsed");
    }
    setExperienceMode("election-night");
  }

  function returnToSwingometer() {
    replay.stop();
    setExperienceMode("swingometer");
    window.requestAnimationFrame(() => setFitSelectionRequest((request) => request + 1));
  }

  function updateNightBehavior<Key extends keyof ElectionNightBehavior>(
    key: Key,
    value: ElectionNightBehavior[Key],
  ) {
    setNightBehavior((current) => ({ ...current, [key]: value }));
    setSelectedNightProfileId("draft");
    setNightProfileFeedback(null);
  }

  function updateStateDelay(stateCode: DetailedStateCode, minutes: number) {
    setNightBehavior((current) => ({
      ...current,
      stateDelayMinutes: { ...current.stateDelayMinutes, [stateCode]: minutes },
    }));
    setSelectedNightProfileId("draft");
    setNightProfileFeedback(null);
  }

  function loadNightProfile(profileId: string) {
    const builtIn = ELECTION_NIGHT_PROFILES.find((profile) => profile.id === profileId);
    const saved = savedNightProfiles.find((profile) => profile.id === profileId);
    const profile = builtIn ?? saved;
    if (!profile) return;
    setNightBehavior(cloneNightBehavior(profile.behavior));
    setSelectedNightProfileId(profile.id);
    setNightProfileName("name" in profile ? profile.name : profile.label);
    setNightProfileFeedback(`${"name" in profile ? profile.name : profile.label} loaded as a draft. Apply it to restart the count.`);
  }

  function saveNightProfile() {
    const name = nightProfileName.trim().slice(0, 40);
    if (!name) {
      setNightProfileFeedback("Name this chronology before saving it.");
      return;
    }
    const existing = savedNightProfiles.find((profile) => profile.name.toLowerCase() === name.toLowerCase());
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || "chronology";
    const id = existing?.id ?? `saved:${Date.now().toString(36)}:${slug}`;
    const entry: SavedNightProfile = { id, name, behavior: cloneNightBehavior(nightBehavior) };
    const next = existing
      ? savedNightProfiles.map((profile) => profile.id === existing.id ? entry : profile)
      : [...savedNightProfiles, entry].slice(-12);
    setSavedNightProfiles(next);
    persistNightProfiles(next);
    setSelectedNightProfileId(id);
    setNightProfileFeedback(existing ? `Updated ${name} in this browser.` : `Saved ${name} in this browser.`);
  }

  function deleteNightProfile() {
    if (!selectedNightProfileId.startsWith("saved:")) return;
    const next = savedNightProfiles.filter((profile) => profile.id !== selectedNightProfileId);
    setSavedNightProfiles(next);
    persistNightProfiles(next);
    setSelectedNightProfileId("draft");
    setNightProfileFeedback("Saved chronology removed. The current draft is unchanged.");
  }

  function addNightCountyOverride() {
    if (!nightOverrideCountyId) return;
    const key = `${nightOverrideState}:${nightOverrideCountyId}`;
    setNightBehavior((current) => ({
      ...current,
      countyOverrides: [
        ...current.countyOverrides.filter((override) => `${override.stateCode}:${override.countyId}` !== key),
        {
          stateCode: nightOverrideState,
          countyId: nightOverrideCountyId,
          startOffsetMinutes: 0,
          countDurationPercent: 100,
        },
      ],
    }));
    setSelectedNightProfileId("draft");
    setNightProfileFeedback(null);
  }

  function updateNightCountyOverride(
    stateCode: DetailedStateCode,
    countyId: string,
    changes: Partial<Pick<ElectionNightCountyOverride, "startOffsetMinutes" | "countDurationPercent">>,
  ) {
    setNightBehavior((current) => ({
      ...current,
      countyOverrides: current.countyOverrides.map((override) => (
        override.stateCode === stateCode && override.countyId === countyId
          ? { ...override, ...changes }
          : override
      )),
    }));
    setSelectedNightProfileId("draft");
    setNightProfileFeedback(null);
  }

  function removeNightCountyOverride(stateCode: DetailedStateCode, countyId: string) {
    setNightBehavior((current) => ({
      ...current,
      countyOverrides: current.countyOverrides.filter((override) => (
        override.stateCode !== stateCode || override.countyId !== countyId
      )),
    }));
    setSelectedNightProfileId("draft");
    setNightProfileFeedback(null);
  }

  function openNightDock(tab: NightDockTab) {
    setNightDockTab(tab);
    if (laboratoryDrawerSnap === "collapsed") changeDrawerSnap("working");
  }

  function scheduleReplaySeek(progressMillionths: number) {
    if (replaySeekTimerRef.current != null) window.clearTimeout(replaySeekTimerRef.current);
    replaySeekTimerRef.current = window.setTimeout(() => {
      replaySeekTimerRef.current = null;
      replay.seek(progressMillionths);
    }, 140);
  }

  return (
    <main
      className="application-shell"
      data-experience-mode={experienceMode}
      data-geography-level={selectedVtdGeoid ? "reporting-unit" : selectedCountyFips ? "county" : selectedStateCode ? "state" : "national"}
      data-workspace-mode={workspaceMode}
    >
      <header className="masthead">
        <button className="brand" onClick={() => navigateWorkspace("home")} type="button" aria-label="Sandbox 2.0 editorial home">
          <span className="brand-rule" aria-hidden="true"><i /><i /></span>
          <span>
            <span className="overline">American electorate laboratory</span>
            <strong>Sandbox 2.0</strong>
          </span>
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {workspaceMode === "home" ? <>
            <button className="nav-item active" type="button">Home</button>
            <button className="nav-item" onClick={() => navigateWorkspace("laboratory")} type="button">Open Sandbox</button>
            <a className="nav-item" href="#methodology">Sources</a>
          </> : <>
            <button
              className={`nav-item ${experienceMode === "swingometer" ? "active" : ""}`}
              onClick={returnToSwingometer}
              type="button"
            >Swingometer</button>
            <button
              className={`nav-item ${experienceMode === "election-night" ? "active" : ""}`}
              disabled={scenarioPending}
              onClick={beginElectionNight}
              type="button"
            >Election Night</button>
            <button className="nav-item" onClick={() => navigateWorkspace("home")} type="button">Home</button>
          </>}
        </nav>

        <div className="build-status"><span />{experienceMode === "election-night" ? "Scenario replay · reporting-unit-first · v0.23B" : "Three-state swingometer · v0.24"}</div>
      </header>

      <div className="workbench" id="top">
        <section className="editorial-column" aria-labelledby="page-heading">
          {workspaceMode === "laboratory" && (
            <div className="laboratory-context">
              <span className="overline">{experienceMode === "election-night" ? "Election night replay" : `${selectedStateCode ? selectedActual.name : "United States"} laboratory`}</span>
              <strong>{experienceMode === "election-night"
                ? selectedVtd
                  ? selectedVtd.name
                  : selectedActualCounty
                    ? `${selectedActualCounty.name}, unit by unit`
                    : selectedStateCode
                      ? `${selectedActual.name}, county by county`
                      : "America, as the count moves"
                : selectedStateCode ? selectedGeographyName : "United States"}</strong>
              {experienceMode === "election-night" && <p className="night-editorial-dek">
                {selectedActualCounty
                  ? `Each ${activeDetailedStateManifest.geography.unitLabel.toLowerCase()} publishes once. Those returns continually reshape the county and statewide count.`
                  : selectedStateCode
                    ? `Local returns arrive in irregular waves. County margins move first, then determine ${selectedActual.name}'s live color.`
                    : "Only Pennsylvania, Michigan, and Wisconsin participate. Every visible result is built upward from detailed local returns."}
              </p>}
              <div>
                {experienceMode === "election-night" ? <>
                  <span>Reported <b>{replayPresentedMargin == null ? "No return" : formatMargin(replayPresentedMargin)}</b></span>
                  <span>Ballots <b>{formatCompact(replayPresentedTotalVotes)}</b></span>
                  <span>Returns <b>{replaySelectedState?.returnsPublished ?? replay.current?.election.national.returnsPublished ?? 0}</b></span>
                </> : <>
                  <span>Actual <b>{readoutActualMargin == null ? "Unavailable" : formatMargin(readoutActualMargin)}</b></span>
                  <span>Scenario <b>{readoutScenarioMargin == null ? "Unavailable" : formatMargin(readoutScenarioMargin)}</b></span>
                  {!selectedStateCode && <span>Electoral College <b>{electoralConsequences.scenarioNational.harrisElectoralVotes}–{electoralConsequences.scenarioNational.trumpElectoralVotes}</b></span>}
                </>}
              </div>
              {selectedStateCode && <button onClick={selectedCountyFips ? () => selectCounty(null) : selectNation} type="button">
                ← {selectedCountyFips ? selectedActual.name : "United States"}
              </button>}
              {!selectedStateCode && <div className="supported-state-links"><span>Detailed states</span><button onClick={() => selectState("PA")} type="button">Pennsylvania</button><button onClick={() => selectState("MI")} type="button">Michigan</button><button onClick={() => selectState("WI")} type="button">Wisconsin</button></div>}
              <button className="fit-selection-button" onClick={() => setFitSelectionRequest((request) => request + 1)} type="button">
                {selectedStateCode ? "Fit selection" : "Fit United States"}
              </button>
            </div>
          )}
          <p className="overline">Election modeling and replay studio</p>
          <h1 id="page-heading">Build the electorate.<br />Then watch it count.</h1>
          <p className="lede">
            Create a detailed counterfactual, trace where every vote moves, and direct how the result arrives on election night.
          </p>

          <button className="open-sandbox-button" onClick={() => navigateWorkspace("laboratory")} type="button">Enter the laboratory <span aria-hidden="true">→</span></button>

          <div className="baseline-lockup">
            <div className="baseline-head">
              <span className="overline">Actual 2024</span>
              <span className="verified-pill">Official statewide baseline</span>
            </div>
            <div className="baseline-score">
              <div><strong className="dem-text">226</strong><span>Harris</span></div>
              <div className="to-win"><b>270</b><span>to win</span></div>
              <div><strong className="rep-text">312</strong><span>Trump</span></div>
            </div>
          </div>

          <div className="principle-note">
            <span className="index">01</span>
            <div>
              <strong>No changes means the actual result.</strong>
              <p>Pennsylvania, Michigan, and Wisconsin reconcile to their statewide results. Unmatched geography and reconstructed local values remain explicit.</p>
            </div>
          </div>

          <div className="foundation-progress" aria-label="Foundation progress">
            <div className="progress-title"><span>Foundation status</span><strong>6 / 6</strong></div>
            <ol>
              <li className="complete"><span />Independent product</li>
              <li className="complete"><span />State baseline</li>
              <li className="complete"><span />Deterministic mutation</li>
              <li className="complete"><span />Three detailed-state foundations</li>
              <li className="complete"><span />State-specific geometry contracts</li>
              <li className="complete"><span />Demographic denominator</li>
            </ol>
          </div>
        </section>

        <section className="map-column" aria-label={workspaceMode === "home" ? "National election introduction" : selectedStateCode ? `${selectedActual.name} election laboratory` : "United States election laboratory"}>
          <div className="map-toolbar">
            <div>
              <span className="overline">Geographic scope</span>
              <div className="breadcrumb">
                {workspaceMode === "home" || !selectedStateCode
                  ? <strong aria-current="location">United States</strong>
                  : <button onClick={selectNation} type="button">United States</button>}
                {workspaceMode === "laboratory" && selectedStateCode && <><span>/</span>{selectedCountyFips ? <button onClick={() => selectCounty(null)} type="button">{selectedActual.name}</button> : <strong aria-current="location">{selectedActual.name}</strong>}</>}
                {workspaceMode === "laboratory" && selectedActualCounty && <><span>/</span>{selectedVtd ? <button onClick={() => selectPrecinct(null)} type="button">{selectedActualCounty.name}</button> : <strong aria-current="location">{selectedActualCounty.name}</strong>}</>}
                {workspaceMode === "laboratory" && selectedVtd && <><span>/</span><strong aria-current="location">{selectedVtd.name}</strong></>}
              </div>
            </div>
            {experienceMode === "election-night" ? (
              <div className="night-map-status"><span />Reported returns</div>
            ) : <div className="segmented" aria-label="Map comparison mode">
              {(["actual", "scenario", "difference"] as ViewMode[]).map((mode) => (
                <button
                  aria-pressed={viewMode === mode}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {mode === "difference" ? "Shift" : mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>}
          </div>

          <div className="map-stage">
            <Suspense fallback={<div className="map-loading"><span /> Preparing the election terrain</div>}>
              <AtlasMapScene
                activeCountyFips={workspaceMode === "home" ? null : selectedCountyFips}
                activePrecinctGeoid={workspaceMode === "home" ? null : selectedVtdGeoid}
                activeStateCode={workspaceMode === "home" ? null : selectedStateCode}
                activeDetailedStateManifest={workspaceMode === "laboratory" && selectedStateCode === activeDetailedStateCode ? activeDetailedStateManifest : null}
                actualDetailedCounties={detailedCounties}
                actualStates={states2024}
                onActiveCountyChange={selectCounty}
                onActivePrecinctChange={selectPrecinct}
                onActiveStateChange={selectMapState}
                scenarioDetailedCounties={displayedDetailedCounties}
                scenarioDetailedGeographies={displayedDetailedGeographies}
                scenarioStates={displayedScenarioStates}
                fitSelectionRequest={fitSelectionRequest}
                viewMode={experienceMode === "election-night" ? "scenario" : viewMode}
                scenarioIsPartial={experienceMode === "election-night"}
                highlightedReturn={experienceMode === "election-night" && replay.currentReturn ? {
                  stateCode: replay.currentReturn.jurisdictionId,
                  countyFips: replay.currentReturn.countyId,
                  precinctGeoid: replay.currentReturn.geometryId,
                } : null}
                routeIndicators={experienceMode === "election-night" ? [] : (routeConstructionPlan?.states ?? []).map((state, index) => ({
                  stateCode: state.stateCode,
                  status: state.status,
                  order: index + 1,
                }))}
              />
            </Suspense>

            {experienceMode === "election-night" && replay.phase !== "ready" && (
              <div className="night-initialization" role="status">
                <span aria-hidden="true" />
                <div>
                  <strong>{replay.phase === "error"
                    ? "Election night could not start"
                    : replay.phase === "loading-data"
                      ? "Locking your Swingometer scenario"
                      : "Compiling precinct-level returns off-thread"}</strong>
                  <p>{replay.error ?? "The same map stays mounted while three detailed state endpoints are prepared. Unchanged states use the direct certified path, and chronology restarts reuse the active worker cache."}</p>
                </div>
                {replay.phase === "error" && <button onClick={returnToSwingometer} type="button">Back to Swingometer</button>}
              </div>
            )}

            {experienceMode === "swingometer" && <div className="selected-readout" data-drilled={Boolean(selectedStateCode)} aria-live="polite">
              <div>
                <span className="overline">Selected</span>
                <strong>{presentedGeographyName}</strong>
              </div>
              <div className="readout-margin">
                <span>Actual</span><strong>{presentedActualMargin == null ? "NO RETURN" : formatMargin(presentedActualMargin)}</strong>
              </div>
              <div className="readout-arrow" aria-hidden="true">→</div>
              <div className="readout-margin">
                <span>Scenario</span><strong>{presentedScenarioMargin == null ? "NO RETURN" : formatMargin(presentedScenarioMargin)}</strong>
              </div>
              <div className={`shift-chip ${presentedShift != null && presentedShift > 0.05 ? "toward-dem" : ""}`}>
                {presentedShift == null
                  ? "Unavailable"
                  : Math.abs(presentedShift) < 0.05
                    ? "No change"
                    : `${presentedShift > 0 ? "+" : ""}${presentedShift.toFixed(1)} pts D`}
              </div>
            </div>}
          </div>

          <div className="legend-row">
            <span>Democratic</span>
            <div className="margin-ramp" aria-hidden="true" />
            <span>Republican</span>
            <i />
            <span>Tile color: statewide winning margin</span>
          </div>
          {workspaceMode === "laboratory" && (
            <div className="causal-strip" aria-live="polite">
              {experienceMode === "election-night" ? <>
                <span>{replay.current?.controller.status ?? replay.phase}</span>
                <i aria-hidden="true">→</i>
                <strong>{replayPresentedMargin == null
                  ? `${selectedGeographyName} has no published return`
                  : `${selectedGeographyName} ${formatMargin(replayPresentedMargin)} reported`}</strong>
                <i aria-hidden="true">→</i>
                <b>{replaySelectedState?.geographyAvailability === "detailed"
                  ? `${replaySelectedState.returnsPublished} reporting-unit returns`
                  : "Statewide-only capability"}</b>
              </> : <>
              <span>{!selectedStateCode
                ? `${portfolioRecipes.length} active detailed ${portfolioRecipes.length === 1 ? "state" : "states"}`
                : behaviorEditorMode === "preference"
                ? formatPreferenceMovement(effectivePreferenceShiftPoints)
                : behaviorEditorMode === "turnout"
                  ? `Turnout +${turnoutIncreasePoints.toFixed(1)} pts`
                  : formatThirdPartyMovement(effectiveThirdPartyShiftPoints, thirdPartyCandidate)}</span>
              <i aria-hidden="true">→</i>
              <strong>{selectedStateCode
                ? `${activeDetailedStateCode} ${formatMarginVotes(contributionSummary.statewideMarginDelta)} margin`
                : `${electoralConsequences.scenarioNational.harrisElectoralVotes} Harris · ${electoralConsequences.scenarioNational.trumpElectoralVotes} Trump`}</strong>
              {activeRouteConstructionState && <><i aria-hidden="true">→</i><b>{activeRouteConstructionState.status === "satisfied"
                ? `+${activeRouteConstructionState.electoralVotes} EV verified`
                : `${formatCompact(activeRouteConstructionState.remainingNetMarginVotes)} still required`}</b></>}
              </>}
            </div>
          )}
        </section>

        <aside className={`control-column ${assumptionsOpen ? "open" : ""}`} aria-label="Scenario editor">
          {experienceMode === "election-night" && (
            <section className="night-three-state-card" aria-label="Three-state election night desk">
              <div className="card-heading"><div><span className="overline">Election night desk</span><strong>Detailed states only</strong></div><span className="year-chip">2024</span></div>
              <p>Only jurisdictions with approved reporting-unit data enter this count.</p>
              <div className="night-state-ledger">
                {(["PA", "MI", "WI"] as const).map((stateCode) => {
                  const state = replayJurisdictions?.find((item) => item.jurisdictionId === stateCode);
                  const harris = replayCandidateVotes(state, "harris");
                  const trump = replayCandidateVotes(state, "trump");
                  const reportedMargin = state?.totalReportedVotes
                    ? (harris - trump) / state.totalReportedVotes * 100
                    : null;
                  return <div className="night-state-row" data-selected={selectedStateCode === stateCode} key={stateCode}>
                    <span><strong>{stateCode}</strong><small>{getDetailedStateManifest(stateCode).geography.unitLabelPlural}</small></span>
                    <span><b>{reportedMargin == null ? "NO RETURNS" : formatMargin(reportedMargin)}</b><small>{state?.returnsPublished ?? 0} / {state?.expectedReturns ?? 0}</small></span>
                  </div>;
                })}
              </div>
              <div className="night-exclusion-note"><span />48 other jurisdictions excluded. No statewide fallback returns.</div>
            </section>
          )}
          <section className="scenario-card">
            <div className="card-heading">
              <div><span className="overline">Your scenario</span><strong>Electoral College</strong></div>
              <div className="scenario-actions">
                <span className="year-chip">{activeDetailedStateManifest.election.year}</span>
                <button
                  className="share-button"
                  disabled={!demographicFoundation || scenarioPending}
                  onClick={copyScenarioLink}
                  type="button"
                >{shareStatus === "copied" ? "Scenario link copied" : shareStatus === "error" ? "Try copy" : "Copy scenario link"}</button>
              </div>
            </div>
            <div className="target-selector" aria-label="Electoral College target candidate">
              <span>Explain for</span>
              <div>
                {(["harris", "trump"] as MajorCandidate[]).map((candidate) => (
                  <button
                    aria-pressed={targetCandidate === candidate}
                    key={candidate}
                    onClick={() => changeTargetCandidate(candidate)}
                    type="button"
                  >{candidateNames[candidate]}</button>
                ))}
              </div>
            </div>
            <div className="scenario-score">
              <div><span>Harris</span><strong className="dem-text">{scenarioNational.harrisElectoralVotes}</strong></div>
              <div className="score-divider"><span>{electoralConsequences.majorityThreshold}</span></div>
              <div><strong className="rep-text">{scenarioNational.trumpElectoralVotes}</strong><span>Trump</span></div>
            </div>
            <div className="threshold-lockup" data-status={electoralConsequences.thresholdStatus} data-target={targetCandidate}>
              <span>{electoralThresholdHeadline(electoralConsequences)}</span>
              <p>{electoralThresholdDetail(electoralConsequences)}</p>
            </div>
            <p className="consequence-summary" aria-live="polite">
              {scenarioPending ? "Verifying every active state before publishing the national consequence." : consequenceSummary}
            </p>
            {electoralConsequences.activeRows.length > 0 && (
              <div className="consequence-ledger" aria-label="Changed state Electoral College consequences" aria-busy={scenarioPending}>
                <div className="consequence-ledger-heading" data-target={targetCandidate}>
                  <span>Active scenarios</span>
                  <strong>{electoralConsequences.targetElectoralDelta === 0
                    ? "0 EV change"
                    : `${electoralConsequences.targetElectoralDelta > 0 ? "+" : "−"}${Math.abs(electoralConsequences.targetElectoralDelta)} ${candidateNames[targetCandidate]} EV`}</strong>
                </div>
                <div className="consequence-ledger-columns" aria-hidden="true">
                  <span>State</span><span>Actual</span><span>Scenario</span><span>Consequence</span>
                </div>
                {electoralConsequences.activeRows.map((row) => (
                  <button
                    aria-pressed={row.stateCode === activeDetailedStateCode}
                    className="consequence-row"
                    data-consequential={row.winnerChanged}
                    data-testid={`portfolio-state-${row.stateCode}`}
                    key={row.stateCode}
                    onClick={() => selectState(row.stateCode)}
                    type="button"
                  >
                    <span className="consequence-state"><strong>{row.stateName}</strong><small>{row.stateCode} · Modeled</small></span>
                    <span><small>{candidateNames[row.actualWinner]}</small><strong>{formatMargin(row.actualMargin)}</strong></span>
                    <span><small>{candidateNames[row.scenarioWinner]}</small><strong>{scenarioPending ? "Updating" : formatMargin(row.scenarioMargin)}</strong></span>
                    <span className={electoralDeltaClass(row.targetElectoralDelta, targetCandidate)}>
                      <small>{candidateNames[targetCandidate]}</small>
                      <strong>{row.targetElectoralDelta === 0
                        ? "0 EV"
                        : `${row.targetElectoralDelta > 0 ? "+" : "−"}${Math.abs(row.targetElectoralDelta)} EV`}</strong>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="popular-row">
              <span>National popular vote</span>
              <strong>{formatMargin(((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100)}</strong>
            </div>
            <div
              className="scenario-version-row"
              title={`Dataset ${SCENARIO_DATA_VERSION} · Engine ${SCENARIO_ENGINE_VERSION}`}
            >
              <span>Replay URL v{SCENARIO_URL_SCHEMA_VERSION}</span>
              <span>Data v2 · engine v1</span>
              <strong aria-live="polite">{scenarioPending ? "Updating scenario" : shareStatus === "copied" ? "Scenario link copied — this URL reconstructs your current assumptions." : shareStatus === "error" ? "Copy unavailable" : ""}</strong>
            </div>
            {scenarioLinkNotice && (
              <div className="scenario-link-notice" role="status">
                <span aria-hidden="true" />
                <p>{scenarioLinkNotice}</p>
                <button aria-label="Dismiss shared scenario notice" onClick={() => setScenarioLinkNotice(null)} type="button">Dismiss</button>
              </div>
            )}
            {portfolioError && (
              <div className="scenario-link-notice error" role="alert">
                <span aria-hidden="true" />
                <p>Inactive state verification is unavailable. {portfolioError}</p>
              </div>
            )}
          </section>

          {selectedStateFlipRequirement && (
            <section
              className="state-flip-card"
              aria-label={`Flip requirement for ${selectedStateFlipRequirement.stateName}`}
              data-satisfied={selectedStateFlipRequirement.satisfied}
            >
              <div className="card-heading compact">
                <div>
                  <span className="overline">To flip {selectedStateFlipRequirement.stateName}</span>
                  <strong>{selectedStateFlipRequirement.satisfied
                    ? `${candidateNames[targetCandidate]} now leads this state`
                    : `${candidateNames[targetCandidate]} needs ${formatNumber(selectedStateFlipRequirement.remainingNetMarginVotes)} net margin votes`}</strong>
                </div>
                <span className="state-fact-chip">State fact</span>
              </div>
              <div className="state-flip-metrics">
                <span><small>Certified requirement</small><strong>{formatNumber(selectedStateFlipRequirement.certifiedRequiredNetMarginVotes)}</strong></span>
                <span><small>Current modeled movement</small><strong>{selectedStateFlipRequirement.modeledNetMarginMovement >= 0 ? "+" : "−"}{formatNumber(Math.abs(selectedStateFlipRequirement.modeledNetMarginMovement))} {targetCandidate === "harris" ? "D" : "R"}</strong></span>
                <span><small>Still needed</small><strong>{formatNumber(selectedStateFlipRequirement.remainingNetMarginVotes)}</strong></span>
              </div>
              <p>The remaining requirement is recalculated from the current effective state result. It does not require a Path to 270 selection.</p>
            </section>
          )}

          {activeRouteConstructionState && routeConstructionPlan && (
            <section
              className="route-lab-card"
              aria-label={`Route construction for ${activeRouteConstructionState.stateName}`}
              data-status={activeRouteConstructionState.status}
            >
              <div className="card-heading compact">
                <div>
                  <span className="overline">Active path · {routeConstructionPlan.id.replaceAll("+", " + ")}</span>
                  <strong>{activeRouteConstructionState.stateName} route requirement</strong>
                </div>
                <span className="route-status-chip">{activeRouteConstructionState.status}</span>
              </div>
              <div className="route-lab-decision" aria-live="polite">
                <strong>{activeRouteConstructionState.status === "satisfied"
                  ? `${activeRouteConstructionState.stateName} satisfies this route.`
                  : activeRouteConstructionState.status === "modeled"
                    ? activeRouteConstructionState.modeledNetMarginMovement > 0
                      ? `${activeRouteConstructionState.stateName} improved in the model but remains Required.`
                      : activeRouteConstructionState.modeledNetMarginMovement < 0
                        ? `${activeRouteConstructionState.stateName} is modeled but moved away from the route target.`
                        : `${activeRouteConstructionState.stateName} is modeled but has not reduced the requirement.`
                    : `${activeRouteConstructionState.stateName} remains a mathematical requirement.`}</strong>
                <p>{activeRouteConstructionState.status === "satisfied"
                  ? `${candidateNames[targetCandidate]} receives ${activeRouteConstructionState.electoralVotes} verified electoral votes from the modeled result.`
                  : `${formatNumber(activeRouteConstructionState.remainingNetMarginVotes)} additional net ${candidateNames[targetCandidate]} margin votes are still needed to move past a tie.`}</p>
              </div>
              <div className="route-progress-track" aria-label={`${activeRouteConstructionState.progressPct.toFixed(1)} percent of certified route movement modeled`}>
                <span style={{ width: `${activeRouteConstructionState.progressPct}%` }} />
              </div>
              <div className="route-lab-metrics">
                <span><small>Certified requirement</small><strong>{formatNumber(activeRouteConstructionState.certifiedRequiredNetMarginVotes)}</strong></span>
                <span><small>Modeled movement</small><strong>{activeRouteConstructionState.modeledNetMarginMovement >= 0 ? "+" : "−"}{formatNumber(Math.abs(activeRouteConstructionState.modeledNetMarginMovement))}</strong></span>
                <span><small>Remaining gap</small><strong>{formatNumber(activeRouteConstructionState.remainingNetMarginVotes)}</strong></span>
              </div>
              <p className="route-lab-note"><strong>Modeled</strong> means a detailed {activeDetailedStateCode} scenario is active. <strong>Satisfied</strong> means that scenario actually changes the state winner. This route reuses the state fact above.</p>
            </section>
          )}

          <section className="path-card" aria-label="Path to 270" data-alternatives-open={routeAlternativesOpen}>
            <div className="card-heading compact">
              <div><span className="overline">Path to {pathTo270.majorityThreshold}</span><strong>Closest mathematical routes</strong></div>
              <span className="route-needed">{pathTo270.electoralVotesNeeded === 0
                ? "Majority reached"
                : `${pathTo270.electoralVotesNeeded} EV needed`}</span>
            </div>
            <div className="route-metrics" aria-label="Path ranking metric">
              {(Object.keys(routeMetricLabels) as RouteMetric[]).map((metric) => (
                <button
                  aria-pressed={routeMetric === metric}
                  key={metric}
                  onClick={() => setRouteMetric(metric)}
                  type="button"
                >{routeMetricLabels[metric]}</button>
              ))}
            </div>
            {workspaceMode === "laboratory" && (
              <button
                aria-expanded={routeAlternativesOpen}
                className="route-alternatives-button"
                onClick={() => setRouteAlternativesOpen((open) => !open)}
                ref={routeAlternativesButtonRef}
                type="button"
              >{routeAlternativesOpen ? "Close alternative routes" : "Compare alternative routes"}</button>
            )}
            {routeConstructionPlan && (
              <div className="route-construction" data-status={routeConstructionPlan.status}>
                <div className="route-construction-heading">
                  <div>
                    <span className="overline">Selected construction route</span>
                    <strong>{routeConstructionPlan.id.replaceAll("+", " + ")}</strong>
                  </div>
                  <button onClick={() => setSelectedRouteStateCodes([])} type="button">Clear</button>
                </div>
                <div className="route-construction-summary">
                  <strong>{routeConstructionPlan.status === "complete"
                    ? `${candidateNames[targetCandidate]} route satisfied`
                    : routeConstructionPlan.status === "insufficient"
                      ? "Selected states no longer reach the majority"
                    : `${routeConstructionPlan.satisfiedStateCount} of ${routeConstructionPlan.states.length} states satisfied`}</strong>
                  <span>{routeConstructionPlan.targetElectoralVotes} current · {routeConstructionPlan.projectedTargetElectoralVotes} with remaining requirements</span>
                </div>
                <div className="route-construction-states">
                  {routeConstructionPlan.states.map((state, index) => {
                    const content = <>
                      <b>{state.status === "satisfied" ? "✓" : index + 1}</b>
                      <span><strong>{state.stateName}</strong><small>{state.status}</small></span>
                      <span><small>{state.status === "satisfied" ? "Verified EV" : "Remaining"}</small><strong>{state.status === "satisfied" ? `+${state.electoralVotes} EV` : formatNumber(state.remainingNetMarginVotes)}</strong></span>
                    </>;
                    return state.detailedModelAvailable ? (
                      <button
                        aria-label={`Open ${state.stateName} route laboratory`}
                        key={state.stateCode}
                        onClick={() => selectState(state.stateCode)}
                        type="button"
                      >{content}</button>
                    ) : <div key={state.stateCode}>{content}</div>;
                  })}
                </div>
                <div className="route-term-guide" aria-label="Route status definitions">
                  <span><strong>Required</strong>Statewide movement is still needed. Not a forecast.</span>
                  <span><strong>Modeled</strong>A detailed PA or MI scenario is active.</span>
                  <span><strong>Satisfied</strong>The detailed scenario changes the state&apos;s electoral winner.</span>
                </div>
              </div>
            )}
            {pathTo270.electoralVotesNeeded === 0 ? (
              <div className="route-complete">
                <strong>{candidateNames[targetCandidate]} already holds a majority.</strong>
                <p>No additional Required state movement is needed in this scenario.</p>
              </div>
            ) : pathTo270.routes.length > 0 ? (
              <ol className="route-list">
                {pathTo270.routes.slice(0, 3).map((route, index) => (
                  <li data-testid={`path-route-${index + 1}`} key={route.id}>
                    <button
                      aria-pressed={routeConstructionPlan?.id === route.id}
                      className="route-heading"
                      onClick={() => selectRoute(route)}
                      type="button"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{route.states.map((state) => state.stateCode).join(" + ")}</strong>
                        <small>{route.completeness.replace("-", " ")} path</small>
                      </div>
                      <b>{pathTo270.targetElectoralVotes} → {route.projectedTargetElectoralVotes} EV</b>
                    </button>
                    <div className="route-states">
                      {route.states.map((state) => {
                        const stateContent = (
                          <>
                            <span><strong>{state.stateName}</strong><small>{state.currentClassification} → required</small></span>
                            <span><small>Current</small><strong>{formatMargin(targetCandidate === "harris" ? state.currentMargin : -state.currentMargin)}</strong></span>
                            <span><small>Required</small><strong>+{state.requiredMarginPoints.toFixed(1)} pts {targetCandidate === "harris" ? "D" : "R"}</strong></span>
                            <span><small>Net margin votes</small><strong>{formatNumber(state.requiredNetMarginVotes)}</strong></span>
                            <b>+{state.electoralVotes} EV</b>
                          </>
                        );
                        return state.detailedModelAvailable ? (
                          <button
                            aria-label={`Open ${state.stateName} detailed laboratory`}
                            key={state.stateCode}
                            onClick={() => selectRoute(route, state.stateCode)}
                            type="button"
                          >{stateContent}</button>
                        ) : (
                          <div key={state.stateCode}>{stateContent}</div>
                        );
                      })}
                    </div>
                    <div className="route-totals">
                      <span>{route.stateCount} {route.stateCount === 1 ? "state" : "states"}</span>
                      <span>{formatNumber(route.totalRequiredNetMarginVotes)} net margin votes</span>
                      <span>{route.totalRequiredMarginPoints.toFixed(1)} aggregate margin pts</span>
                    </div>
                    <p className="route-support-note">{route.states.every((state) => state.detailedModelAvailable)
                      ? "Every state in this route has detailed geography available."
                      : "Mathematical route only for unsupported states; no county or precinct behavior is implied."}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="route-complete error">
                <strong>No supported whole-state route reaches the threshold.</strong>
                <p>The current route contract excludes split-allocation approximations.</p>
              </div>
            )}
            <p className="route-disclosure">
              Required means statewide mathematical movement still needed, not a forecast. Modeled means a detailed PA or MI recipe exists. Satisfied means that recipe changes the state&apos;s electoral winner. Maine and Nebraska are excluded until district allocation is supported.
            </p>
          </section>

          {experienceMode === "election-night" && <div
            aria-label="Election night controls"
            className="laboratory-drawer night-command-dock"
            data-snap={laboratoryDrawerSnap}
            ref={laboratoryDrawerRef}
            role="region"
            style={laboratoryDrawerDragHeight == null ? undefined : { "--drawer-drag-height": `${laboratoryDrawerDragHeight}px` } as CSSProperties}
          >
            <button
              aria-label="Resize Election Night dock"
              className="drawer-grab-handle"
              onPointerCancel={handleDrawerPointerEnd}
              onPointerDown={handleDrawerPointerDown}
              onPointerMove={handleDrawerPointerMove}
              onPointerUp={handleDrawerPointerEnd}
              type="button"
            ><span /></button>
            <div className="drawer-toolbar night-dock-toolbar">
              <div className="drawer-intent night-dock-clock">
                <span className="overline">Run my election</span>
                <strong>{replay.current
                  ? replayClockFormat.format(new Date(replay.current.controller.logicalReplayTimeMs))
                  : "Preparing election night"}</strong>
                <small>{replay.current?.controller.appliedEventCount ?? 0} returns · {formatNumber(replayNational?.totalReportedVotes ?? 0)} ballots</small>
              </div>
              <div className="night-dock-playback" aria-label="Playback controls">
                <button
                  className="primary"
                  disabled={replay.phase !== "ready" || replay.current?.controller.status === "complete"}
                  onClick={replay.current?.controller.status === "playing" ? replay.pause : replay.play}
                  type="button"
                >{replay.current?.controller.status === "playing" ? "Pause" : "Play"}</button>
                <button disabled={replay.phase !== "ready"} onClick={replay.step} type="button">Next return</button>
                <button disabled={replay.phase !== "ready"} onClick={replay.reset} type="button">Reset</button>
                <button className="night-mobile-edit" onClick={returnToSwingometer} type="button">Edit Swingometer</button>
                <label><span>Speed</span><select aria-label="Election night speed" value={replay.speed} onChange={(event) => replay.setSpeed(Number(event.currentTarget.value))}>
                  {[0.1, 0.5, 1, 4, 12].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
                </select></label>
              </div>
              <label className="night-dock-timeline">
                <span><b>Start</b><b>{Math.round(replay.timelineProgressMillionths / 10_000)}%</b><b>End</b></span>
                <input
                  aria-label="Election night timeline"
                  defaultValue={0}
                  disabled={replay.phase !== "ready"}
                  max={1_000_000}
                  min={0}
                  onChange={(event) => scheduleReplaySeek(Number(event.currentTarget.value))}
                  ref={replayTimelineInputRef}
                  step={1_000}
                  type="range"
                />
              </label>
              <div className="drawer-tabs" role="tablist" aria-label="Election Night dock panels">
                {nightDockTabs.map((tab) => (
                  <button
                    aria-controls={`night-dock-panel-${tab}`}
                    aria-selected={nightDockTab === tab}
                    id={`night-dock-tab-${tab}`}
                    key={tab}
                    onClick={() => openNightDock(tab)}
                    role="tab"
                    tabIndex={nightDockTab === tab ? 0 : -1}
                    type="button"
                  >{tab === "direct" ? "Direct the count" : tab[0].toUpperCase() + tab.slice(1)}</button>
                ))}
              </div>
              <div className="drawer-snaps" aria-label="Dock position">
                <button onClick={returnToSwingometer} type="button">Edit Swingometer</button>
                {(["collapsed", "working", "expanded"] as LaboratoryDrawerSnap[]).map((snap) => (
                  <button aria-pressed={laboratoryDrawerSnap === snap} key={snap} onClick={() => changeDrawerSnap(snap)} type="button">{snap}</button>
                ))}
              </div>
            </div>
            <div className="drawer-panels night-dock-panels">
              <div aria-labelledby="night-dock-tab-live" className="drawer-panel" data-active={nightDockTab === "live"} id="night-dock-panel-live" role="tabpanel">
                <section className="night-live-grid">
                  <article className="night-live-lead">
                    <span className="overline">Three-state reported vote</span>
                    <strong>{replayNational?.totalReportedVotes
                      ? `${replayNationalMarginVotes >= 0 ? "Harris" : "Trump"} +${formatNumber(Math.abs(replayNationalMarginVotes))}`
                      : "No returns"}</strong>
                    <p>PA, MI, and WI are built upward from published local units. No other state participates.</p>
                  </article>
                  <div className="night-live-states">
                    {(["PA", "MI", "WI"] as const).map((stateCode) => {
                      const state = replayJurisdictions?.find((item) => item.jurisdictionId === stateCode);
                      const harris = replayCandidateVotes(state, "harris");
                      const trump = replayCandidateVotes(state, "trump");
                      const reportedMargin = state?.totalReportedVotes ? (harris - trump) / state.totalReportedVotes * 100 : null;
                      const unitProgress = state?.expectedReturns
                        ? Math.round((state.returnsPublished / state.expectedReturns) * 100)
                        : 0;
                      return <button data-fresh={replay.currentReturn?.jurisdictionId === stateCode} key={stateCode} onClick={() => selectState(stateCode)} type="button">
                        <span><b>{stateCode}</b><small>{state?.returnsPublished ?? 0} / {state?.expectedReturns ?? 0} units</small></span>
                        <strong>{reportedMargin == null ? "No returns" : formatMargin(reportedMargin)}</strong>
                        <em aria-label={`${unitProgress}% of ${stateCode} reporting units published`}><i style={{ width: `${unitProgress}%` }} /></em>
                      </button>;
                    })}
                  </div>
                  <article className="night-latest-return night-return-tape">
                    <span className="overline">Local return tape</span>
                    {replay.recentReturns.length ? <ol>
                      {replay.recentReturns.slice(0, 4).map((returnEvent) => <li key={returnEvent.eventId}>
                        <span><b>{returnEvent.jurisdictionId}</b><small>{returnEvent.countyId ? replayCountyNames.get(`${returnEvent.jurisdictionId}:${returnEvent.countyId}`) ?? returnEvent.countyId : "Off-map return"}</small></span>
                        <span><strong>{describeReturnMovement(returnEvent)}</strong><small>{formatNumber(returnEvent.totalVotes)} ballots · {replayTimeShortFormat.format(new Date(returnEvent.atMs))}</small></span>
                      </li>)}
                    </ol> : <div className="night-tape-empty"><strong>Waiting for the first unit</strong><p>Press Play or Next return when the scenario is ready.</p></div>}
                  </article>
                </section>
              </div>

              <div aria-labelledby="night-dock-tab-direct" className="drawer-panel" data-active={nightDockTab === "direct"} id="night-dock-panel-direct" role="tabpanel">
                <section className="night-dock-editor" aria-label="Election night behavior editor">
                  <div className="night-dock-section-heading"><div><span className="overline">Count behavior</span><strong>You direct how the result arrives</strong></div><p>Chronology changes. Every Swingometer vote stays locked.</p></div>

                  <div className="night-profile-bar">
                    <label><span>Reporting profile</span><select aria-label="Reporting profile" value={selectedNightProfileId} onChange={(event) => loadNightProfile(event.currentTarget.value)}>
                      {selectedNightProfileId === "draft" && <option value="draft" disabled>Unsaved draft</option>}
                      <optgroup label="Atlas profiles">{ELECTION_NIGHT_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</optgroup>
                      {savedNightProfiles.length > 0 && <optgroup label="Saved in this browser">{savedNightProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</optgroup>}
                    </select></label>
                    <label className="night-profile-name"><span>Save this chronology</span><input aria-label="Chronology profile name" maxLength={40} onChange={(event) => setNightProfileName(event.currentTarget.value)} placeholder="Profile name" type="text" value={nightProfileName} /></label>
                    <button onClick={saveNightProfile} type="button">Save</button>
                    {selectedNightProfileId.startsWith("saved:") && <button onClick={deleteNightProfile} type="button">Delete</button>}
                    <p aria-live="polite">{nightProfileFeedback ?? ELECTION_NIGHT_PROFILES.find((profile) => profile.id === selectedNightProfileId)?.description ?? "Custom draft. Save it to reuse this chronology in this browser."}</p>
                  </div>

                  <div className="night-behavior-grid">
                    <label><span>Reporting order</span><select value={nightBehavior.reportingOrder} onChange={(event) => updateNightBehavior("reportingOrder", event.currentTarget.value as ReportingOrder)}><option value="mixed">Mixed geography</option><option value="rural-first">Smaller areas first</option><option value="urban-first">Larger areas first</option></select></label>
                    <label><span>Count duration <b>{nightBehavior.durationHours}h</b></span><input min={2} max={36} step={1} type="range" value={nightBehavior.durationHours} onChange={(event) => updateNightBehavior("durationHours", Number(event.currentTarget.value))} /></label>
                    <label><span>Timing volatility <b>{nightBehavior.volatility}%</b></span><input min={0} max={100} step={1} type="range" value={nightBehavior.volatility} onChange={(event) => updateNightBehavior("volatility", Number(event.currentTarget.value))} /></label>
                    <label><span>Bursts and stalls <b>{nightBehavior.stallIntensity}%</b></span><input min={0} max={100} step={1} type="range" value={nightBehavior.stallIntensity} onChange={(event) => updateNightBehavior("stallIntensity", Number(event.currentTarget.value))} /></label>
                  </div>
                  <div className="night-state-delays">
                    <span>State activation delay after poll close</span>
                    {(["PA", "MI", "WI"] as const).map((stateCode) => <label key={stateCode}><b>{stateCode}</b><input min={0} max={360} step={1} type="number" value={nightBehavior.stateDelayMinutes[stateCode]} onChange={(event) => updateStateDelay(stateCode, Math.max(0, Math.min(360, Number(event.currentTarget.value))))} /><small>min</small></label>)}
                    <label><b>Seed</b><input step={1} type="number" value={nightBehavior.seed} onChange={(event) => updateNightBehavior("seed", Math.round(Number(event.currentTarget.value)))} /></label>
                  </div>

                  <section className="night-chronology-preview" aria-label="Chronology preview">
                    <div className="night-preview-heading"><div><span className="overline">Before you restart</span><strong>Planned reporting windows</strong></div><span data-dirty={nightBehaviorDirty}>{nightBehaviorDirty ? "Draft differs from running count" : "Running chronology"}</span></div>
                    <div className="night-preview-axis"><span>{replayTimeShortFormat.format(new Date(nightChronologyPreview.startsAtMs))}</span><span>{replayTimeShortFormat.format(new Date(nightChronologyPreview.endsAtMs))}</span></div>
                    <div className="night-preview-lanes">
                      {nightChronologyPreview.states.map((state) => {
                        const span = Math.max(1, nightChronologyPreview.endsAtMs - nightChronologyPreview.startsAtMs);
                        const left = (state.activationMs - nightChronologyPreview.startsAtMs) / span * 100;
                        const width = (state.plannedFinishMs - state.activationMs) / span * 100;
                        return <div className="night-preview-lane" key={state.stateCode}>
                          <b>{state.stateCode}</b>
                          <div><span style={{ left: `${left}%`, width: `${width}%` }} /></div>
                          <small>{replayTimeShortFormat.format(new Date(state.activationMs))}{state.overrideCount ? ` · ${state.overrideCount} local ${state.overrideCount === 1 ? "exception" : "exceptions"}` : ""}</small>
                        </div>;
                      })}
                    </div>
                    <p>These are statewide planning windows. Deterministic county waves, stalls, and local exceptions determine the exact return times inside them.</p>
                  </section>

                  <section className="night-county-overrides" aria-label="County timing overrides">
                    <div className="night-dock-section-heading compact"><div><span className="overline">Local exceptions</span><strong>County timing overrides</strong></div><p>Adjust chronology only. Candidate shares are never inputs.</p></div>
                    <div className="night-override-picker">
                      <label><span>State</span><select aria-label="County override state" value={nightOverrideState} onChange={(event) => { setNightOverrideState(event.currentTarget.value as DetailedStateCode); setNightOverrideCountyId(""); }}><option value="PA">Pennsylvania</option><option value="MI">Michigan</option><option value="WI">Wisconsin</option></select></label>
                      <label><span>County</span><select aria-label="County override county" value={nightOverrideCountyId} onChange={(event) => setNightOverrideCountyId(event.currentTarget.value)}><option value="">Choose county</option>{nightOverrideCounties.map((county) => <option key={county.fips} value={county.fips}>{county.name}</option>)}</select></label>
                      <button disabled={!nightOverrideCountyId} onClick={addNightCountyOverride} type="button">Add override</button>
                    </div>
                    {nightBehavior.countyOverrides.length > 0 ? <div className="night-override-list">
                      {nightBehavior.countyOverrides.map((override) => {
                        const county = getDetailedStateCounties(override.stateCode).find((candidate) => candidate.fips === override.countyId);
                        return <article key={`${override.stateCode}:${override.countyId}`}>
                          <div><strong>{county?.name ?? override.countyId}</strong><small>{override.stateCode} · {county?.reportingUnitCount ?? 0} reporting units</small></div>
                          <label><span>Start shift</span><input aria-label={`${override.stateCode} ${county?.name ?? override.countyId} start shift`} max={360} min={-240} onChange={(event) => updateNightCountyOverride(override.stateCode, override.countyId, { startOffsetMinutes: Number(event.currentTarget.value) })} step={5} type="number" value={override.startOffsetMinutes} /><small>min</small></label>
                          <label><span>Count length</span><input aria-label={`${override.stateCode} ${county?.name ?? override.countyId} count length`} max={300} min={25} onChange={(event) => updateNightCountyOverride(override.stateCode, override.countyId, { countDurationPercent: Number(event.currentTarget.value) })} step={5} type="number" value={override.countDurationPercent} /><small>%</small></label>
                          <button aria-label={`Remove ${override.stateCode} ${county?.name ?? override.countyId} override`} onClick={() => removeNightCountyOverride(override.stateCode, override.countyId)} type="button">Remove</button>
                        </article>;
                      })}
                    </div> : <p className="night-override-empty">No county exceptions. Every county follows its state profile.</p>}
                  </section>

                  <div className="night-apply-row"><p>{nightBehavior.countyOverrides.length} county {nightBehavior.countyOverrides.length === 1 ? "override" : "overrides"} · {nightBehavior.durationHours} hour plan · seed {nightBehavior.seed}</p><button className="night-apply-behavior" disabled={!nightBehaviorDirty || scenarioPending} onClick={beginElectionNight} type="button">Apply and restart count</button></div>
                </section>
              </div>

              <div aria-labelledby="night-dock-tab-returns" className="drawer-panel" data-active={nightDockTab === "returns"} id="night-dock-panel-returns" role="tabpanel">
                <section className="night-returns-panel">
                  <div className="night-dock-section-heading"><div><span className="overline">Geographic return ledger</span><strong>{selectedStateCode ? selectedGeographyName : "Three detailed states"}</strong></div><p>Click the map or state desk to change scope.</p></div>
                  <div className="night-return-metrics">
                    <span><small>Reported margin</small><strong>{replayPresentedMargin == null ? "No return" : formatMargin(replayPresentedMargin)}</strong></span>
                    <span><small>Ballots</small><strong>{formatNumber(replayPresentedTotalVotes)}</strong></span>
                    <span><small>Published units</small><strong>{replaySelectedState?.returnsPublished ?? replayNational?.returnsPublished ?? 0}</strong></span>
                    <span><small>Status</small><strong>{replay.current?.controller.status ?? replay.phase}</strong></span>
                  </div>
                </section>
              </div>

              <div aria-labelledby="night-dock-tab-method" className="drawer-panel" data-active={nightDockTab === "method"} id="night-dock-panel-method" role="tabpanel">
                <section className="night-method-grid">
                  <article><span>Final result</span><strong>Locked by Swingometer</strong><p>Timing controls never alter candidate totals at any reporting unit.</p></article>
                  <article><span>Atomicity</span><strong>One unit, one return</strong><p>No invented 20%, 50%, or 80% partial precinct batches appear.</p></article>
                  <article><span>Chronology</span><strong>Deterministic reconstruction</strong><p>County windows, bursts, stalls, and jitter are reproducible from the selected seed.</p></article>
                  <article><span>Coverage</span><strong>PA · MI · WI only</strong><p>The remaining 48 jurisdictions stay inert because they lack approved detailed inputs.</p></article>
                </section>
              </div>
            </div>
          </div>}

          {experienceMode === "swingometer" && <div
            aria-label="Laboratory desk"
            className="laboratory-drawer"
            data-snap={laboratoryDrawerSnap}
            ref={laboratoryDrawerRef}
            role="region"
            style={laboratoryDrawerDragHeight == null ? undefined : { "--drawer-drag-height": `${laboratoryDrawerDragHeight}px` } as CSSProperties}
          >
            <button
              aria-label="Resize laboratory drawer"
              className="drawer-grab-handle"
              onPointerCancel={handleDrawerPointerEnd}
              onPointerDown={handleDrawerPointerDown}
              onPointerMove={handleDrawerPointerMove}
              onPointerUp={handleDrawerPointerEnd}
              type="button"
            ><span /></button>
            <div className="drawer-toolbar">
              <div className="drawer-intent">
                <span className="overline">Change {mutationScopeName}</span>
                <strong>{laboratoryDrawerSnap === "collapsed"
                  ? selectedStateCode
                    ? "Turnout · Preference · Third party"
                    : "Choose Pennsylvania or Michigan to model voter behavior"
                  : selectedGeographyName}</strong>
                {laboratoryDrawerSnap === "collapsed" && (
                  <button onClick={() => openLaboratoryPanel("behavior")} type="button">Open controls</button>
                )}
              </div>
              <div className="drawer-tabs" role="tablist" aria-label="Laboratory panels">
                {laboratoryDrawerTabs.map((tab) => (
                  <button
                    aria-controls={`laboratory-panel-${tab}`}
                    aria-selected={laboratoryDrawerTab === tab}
                    id={`laboratory-tab-${tab}`}
                    key={tab}
                    onClick={() => openLaboratoryPanel(tab)}
                    onKeyDown={(event) => handleLaboratoryTabKeyDown(event, tab)}
                    role="tab"
                    tabIndex={laboratoryDrawerTab === tab ? 0 : -1}
                    type="button"
                  >
                    {tab[0].toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="drawer-snaps" aria-label="Drawer position">
                <span className="drawer-position-label">Drawer position</span>
                {(["collapsed", "working", "expanded"] as LaboratoryDrawerSnap[]).map((snap) => (
                  <button aria-pressed={laboratoryDrawerSnap === snap} key={snap} onClick={() => changeDrawerSnap(snap)} type="button">{snap}</button>
                ))}
              </div>
            </div>
            <div className="drawer-panels">
              <div aria-labelledby="laboratory-tab-inspector" className="drawer-panel" data-active={laboratoryDrawerTab === "inspector"} id="laboratory-panel-inspector" role="tabpanel">
                {!selectedStateCode ? <section className="national-drawer-summary" aria-label="United States data inspector">
                  <div className="card-heading compact"><div><span className="overline">National Inspector</span><strong>Certified and modeled America</strong></div></div>
                  <div className="national-summary-grid">
                    <span><small>Actual popular vote</small><strong>{formatMargin(((actualNational.harrisVotes - actualNational.trumpVotes) / actualNational.totalVotes) * 100)}</strong></span>
                    <span><small>Scenario popular vote</small><strong>{formatMargin(((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100)}</strong></span>
                    <span><small>Actual Electoral College</small><strong>{actualNational.harrisElectoralVotes}–{actualNational.trumpElectoralVotes}</strong></span>
                    <span><small>Scenario Electoral College</small><strong>{scenarioNational.harrisElectoralVotes}–{scenarioNational.trumpElectoralVotes}</strong></span>
                  </div>
                  <p>All states use certified statewide totals. Pennsylvania, Michigan, and Wisconsin provide detailed local foundations with state-specific evidence contracts.</p>
                </section> : selectedInspector ? (
                  <GeographyInspector model={selectedInspector} onClearVtd={() => selectPrecinct(null)} />
                ) : <div className="drawer-empty"><strong>No local geography selected.</strong><span>Choose a county or {activeDetailedStateManifest.geography.unitLabel.toLowerCase()} to inspect its baseline and scenario result.</span></div>}
              </div>

              <div aria-labelledby="laboratory-tab-behavior" className="drawer-panel" data-active={laboratoryDrawerTab === "behavior"} id="laboratory-panel-behavior" role="tabpanel">
          {!selectedStateCode && <div className="national-operation-note"><div><strong>Detailed-state operations</strong><span>Choose a supported state to edit audited local behavior. Active recipes continue to aggregate nationally.</span></div><div><button onClick={() => selectState("PA")} type="button">Open Pennsylvania</button><button onClick={() => selectState("MI")} type="button">Open Michigan</button><button onClick={() => selectState("WI")} type="button">Open Wisconsin</button></div></div>}
          <section className="assumption-card">
            <div className="card-heading">
              <div><span className="overline">Behavior editor</span><strong>Change participation or choice</strong></div>
              <button className="collapse-button" onClick={() => setAssumptionsOpen((value) => !value)} type="button" aria-expanded={assumptionsOpen}>
                {assumptionsOpen ? "−" : "+"}
              </button>
            </div>

            <div className="control-body">
              <div className="behavior-tabs" aria-label="Behavior operation">
                <button
                  aria-pressed={behaviorEditorMode === "turnout"}
                  onClick={() => setBehaviorEditorMode("turnout")}
                  type="button"
                >Turnout</button>
                <button
                  aria-pressed={behaviorEditorMode === "preference"}
                  onClick={() => setBehaviorEditorMode("preference")}
                  type="button"
                >Preference</button>
                <button
                  aria-pressed={behaviorEditorMode === "third-party"}
                  onClick={() => setBehaviorEditorMode("third-party")}
                  type="button"
                >Third party</button>
              </div>
              <div className="field-label">
                <span>Geography</span>
                <strong>{activeDetailedStateManifest.name}</strong>
              </div>
              <div className="field-label">
                <span>Population</span>
                <strong>{activeOperationSemantics.populationBasis}</strong>
              </div>

              <div className={`coverage-strip ${demographicError ? "error" : ""}`}>
                <span>{demographicError
                  ? "Data unavailable"
                  : demographicFoundation
                    ? behaviorEditorMode === "turnout"
                      ? "Turnout-ready denominator"
                      : behaviorEditorMode === "preference"
                        ? "Result-linked geometry"
                        : "Named candidate foundation"
                    : "Loading Census denominator"}</span>
                <strong>{demographicFoundation
                  ? behaviorEditorMode === "turnout"
                    ? isPennsylvaniaFoundation(demographicFoundation)
                      ? `${formatNumber(demographicFoundation.totals.denominatorStatus.availableVtdCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapVtdCount)} capped`
                      : isWisconsinFoundation(demographicFoundation)
                        ? `${formatNumber(demographicFoundation.totals.denominatorStatus.availableWardCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapWardCount)} capped`
                        : `${formatNumber(demographicFoundation.totals.denominatorStatus.availablePrecinctCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapPrecinctCount)} capped`
                    : behaviorEditorMode === "preference"
                      ? `${formatNumber(demographicFoundation.join.mappedElectionGeometryCount)} / ${formatNumber(demographicFoundation.join.geometryFeatureCount)} mapped ${activeDetailedStateManifest.geography.unitLabelPlural.toLowerCase()}`
                      : "Stein · Oliver · residual Other"
                  : "…"}</strong>
              </div>

              <section aria-label="Current slider contract" className="model-contract">
                <div className="model-contract-heading">
                  <span className="overline">Model contract</span>
                  <strong>{behaviorEditorMode === "turnout" ? "Participation" : behaviorEditorMode === "preference" ? "Two-party choice" : "Third-party exchange"}</strong>
                  <b>Scenario assumption, not a forecast</b>
                </div>
                <div className="model-contract-grid">
                  <span><small>Changes</small><strong>{activeOperationSemantics.changes}</strong></span>
                  <span><small>Stays fixed</small><strong>{activeOperationSemantics.preserves}</strong></span>
                  <span><small>Feasible boundary</small><strong>{activeOperationSemantics.boundary}</strong></span>
                </div>
                {behaviorEditorMode === "turnout" && <p><b>Denominator:</b> {activeModelSemantics.denominatorDisclosure}</p>}
              </section>

              {behaviorEditorMode === "turnout" ? (
                <>
                  <div className="slider-header">
                    <label htmlFor="pa-turnout">Participation increase</label>
                    <strong>+{turnoutIncreasePoints.toFixed(1)} pts VAP</strong>
                  </div>
                  <input
                    disabled={!demographicFoundation}
                    id="pa-turnout"
                    max="1.5"
                    min="0"
                    onChange={(event) => setTurnoutIncreasePoints(Number(event.currentTarget.value))}
                    onInput={(event) => setTurnoutIncreasePoints(Number(event.currentTarget.value))}
                    onKeyDown={(event) => {
                      const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                        ? 0.1
                        : event.key === "ArrowLeft" || event.key === "ArrowDown"
                          ? -0.1
                          : null;
                      if (movement == null && event.key !== "Home" && event.key !== "End") return;
                      event.preventDefault();
                      setTurnoutIncreasePoints((current) => {
                        if (event.key === "Home") return 0;
                        if (event.key === "End") return 1.5;
                        return Math.min(1.5, Math.max(0, Number((current + movement!).toFixed(1))));
                      });
                    }}
                    step="0.1"
                    type="range"
                    value={turnoutIncreasePoints}
                  />
                  <div className="range-labels"><span>Actual</span><span>+0.8 pts</span><span>+1.5 pts model window</span></div>

                  <div className="slider-header secondary-slider">
                    <label htmlFor="pa-new-voter-share">Harris share of added ballots</label>
                    <strong>{addedVoterHarrisShare.toFixed(0)}%</strong>
                  </div>
                  <input
                    disabled={!demographicFoundation}
                    id="pa-new-voter-share"
                    max="100"
                    min="0"
                    onChange={(event) => setAddedVoterHarrisShare(Number(event.currentTarget.value))}
                    onInput={(event) => setAddedVoterHarrisShare(Number(event.currentTarget.value))}
                    onKeyDown={(event) => {
                      const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                        ? 1
                        : event.key === "ArrowLeft" || event.key === "ArrowDown"
                          ? -1
                          : null;
                      if (movement == null && event.key !== "Home" && event.key !== "End") return;
                      event.preventDefault();
                      setAddedVoterHarrisShare((current) => {
                        if (event.key === "Home") return 0;
                        if (event.key === "End") return 100;
                        return Math.min(100, Math.max(0, current + movement!));
                      });
                    }}
                    step="1"
                    type="range"
                    value={addedVoterHarrisShare}
                  />
                  <div className="range-labels"><span>100% Trump</span><span>Even</span><span>100% Harris</span></div>

                  <div className="effect-grid">
                    <div><span>Added ballots</span><strong>{formatCompact(behaviorScenario?.turnout.addedVotes ?? 0)}</strong></div>
                    <div><span>Added vote split</span><strong>H {formatCompact(behaviorScenario?.turnout.harrisVotes ?? 0)} · T {formatCompact(behaviorScenario?.turnout.trumpVotes ?? 0)}</strong></div>
                    <div><span>{activeDetailedStateCode} result</span><strong>{formatMargin(margin(detailedScenario))}</strong></div>
                  </div>
                  <p className="transfer-explainer"><strong>{formatNumber(behaviorScenario?.turnout.addedVotes ?? 0)} of {formatNumber(behaviorScenario?.turnout.requestedVotes ?? 0)} requested ballots added.</strong>{" "}{formatNumber(behaviorScenario?.turnout.capacity ?? 0)} ballots of documented local capacity are available before this operation.</p>
                </>
              ) : behaviorEditorMode === "preference" ? (
                <>
                  <div className="slider-header">
                    <label htmlFor="pa-preference">Two-party preference transfer</label>
                    <strong>{formatPreferenceMovement(effectivePreferenceShiftPoints)}</strong>
                  </div>
                  <div
                    className="bidirectional-range"
                    style={{ "--zero-position": `${preferenceZeroPosition}%` } as CSSProperties}
                  >
                    <input
                      aria-valuetext={formatPreferenceMovement(effectivePreferenceShiftPoints)}
                      className="preference-range"
                      disabled={!demographicFoundation}
                      id="pa-preference"
                      max={preferenceBounds.towardHarrisPoints}
                      min={preferenceBounds.towardTrumpPoints}
                      onChange={(event) => setPreferenceShiftPoints(normalizeBidirectionalSlider(
                        Number(event.currentTarget.value),
                        preferenceBounds.towardTrumpPoints,
                        preferenceBounds.towardHarrisPoints,
                      ))}
                      onInput={(event) => setPreferenceShiftPoints(normalizeBidirectionalSlider(
                        Number(event.currentTarget.value),
                        preferenceBounds.towardTrumpPoints,
                        preferenceBounds.towardHarrisPoints,
                      ))}
                      onKeyDown={(event) => {
                        const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? 0.1
                          : event.key === "ArrowLeft" || event.key === "ArrowDown"
                            ? -0.1
                            : null;
                        if (movement == null && event.key !== "Home" && event.key !== "End") return;
                        event.preventDefault();
                        setPreferenceShiftPoints((current) => {
                          if (event.key === "Home") return preferenceBounds.towardTrumpPoints;
                          if (event.key === "End") return preferenceBounds.towardHarrisPoints;
                          return Math.min(
                            preferenceBounds.towardHarrisPoints,
                            Math.max(
                              preferenceBounds.towardTrumpPoints,
                              Number((current + movement!).toFixed(1)),
                            ),
                          );
                        });
                      }}
                      step="any"
                      type="range"
                      value={effectivePreferenceShiftPoints}
                    />
                    <span className="zero-tick" aria-hidden="true" />
                  </div>
                  <div className="range-labels preference-labels"><span>Harris → Trump {Math.abs(preferenceBounds.towardTrumpPoints).toFixed(1)} pts</span><span>Actual</span><span>Trump → Harris {preferenceBounds.towardHarrisPoints.toFixed(1)} pts</span></div>

                  <div className="effect-grid">
                    <div><span>Ballots transferred</span><strong>{formatCompact(Math.abs(behaviorScenario?.preference.realizedTransfer ?? 0))}</strong></div>
                    <div><span>State margin movement</span><strong>{formatMarginVotes(contributionSummary.statewideMarginDelta)}</strong></div>
                    <div><span>{activeDetailedStateCode} result</span><strong>{formatMargin(margin(detailedScenario))}</strong></div>
                  </div>
                  <p className="transfer-explainer">
                    <strong>{formatNumber(Math.abs(behaviorScenario?.preference.realizedTransfer ?? 0))} of {formatNumber(Math.abs(behaviorScenario?.preference.requestedTransfer ?? 0))} requested ballots transferred → {formatNumber(Math.abs(contributionSummary.statewideMarginDelta))} votes of {effectivePreferenceShiftPoints >= 0 ? "Harris−Trump" : "Trump−Harris"} margin movement.</strong>{" "}
                    Each direct Harris↔Trump transfer changes the two-candidate margin by 2 votes.
                  </p>
                </>
              ) : (
                <>
                  <div className="third-party-candidates" aria-label="Third-party candidate">
                    {(["stein", "oliver", "residual_other"] as ThirdPartyCandidate[]).map((candidate) => (
                      <button
                        aria-pressed={thirdPartyCandidate === candidate}
                        data-candidate={candidate}
                        key={candidate}
                        onClick={() => chooseThirdPartyCandidate(candidate)}
                        type="button"
                      >{thirdPartyLabels[candidate]}</button>
                    ))}
                  </div>

                  <div className="slider-header">
                    <label htmlFor="pa-third-party">Statewide candidate share movement</label>
                    <strong>{formatThirdPartyMovement(effectiveThirdPartyShiftPoints, thirdPartyCandidate)}</strong>
                  </div>
                  <div
                    className="bidirectional-range third-party-bidirectional"
                    data-candidate={thirdPartyCandidate}
                    style={{ "--zero-position": `${thirdPartyZeroPosition}%` } as CSSProperties}
                  >
                    <input
                      aria-valuetext={formatThirdPartyMovement(effectiveThirdPartyShiftPoints, thirdPartyCandidate)}
                      className="third-party-range"
                      disabled={!demographicFoundation}
                      id="pa-third-party"
                      max={thirdPartyMaximumPoints}
                      min={thirdPartyMinimumPoints}
                      onChange={(event) => setThirdPartyShiftPoints(normalizeBidirectionalSlider(
                        Number(event.currentTarget.value),
                        thirdPartyMinimumPoints,
                        thirdPartyMaximumPoints,
                      ))}
                      onInput={(event) => setThirdPartyShiftPoints(normalizeBidirectionalSlider(
                        Number(event.currentTarget.value),
                        thirdPartyMinimumPoints,
                        thirdPartyMaximumPoints,
                      ))}
                      onKeyDown={(event) => {
                        const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                          ? 0.1
                          : event.key === "ArrowLeft" || event.key === "ArrowDown"
                            ? -0.1
                            : null;
                        if (movement == null && event.key !== "Home" && event.key !== "End") return;
                        event.preventDefault();
                        setThirdPartyShiftPoints((current) => {
                          if (event.key === "Home") return thirdPartyMinimumPoints;
                          if (event.key === "End") return thirdPartyMaximumPoints;
                          return Math.min(
                            thirdPartyMaximumPoints,
                            Math.max(
                              thirdPartyMinimumPoints,
                              Number((current + movement!).toFixed(1)),
                            ),
                          );
                        });
                      }}
                      step="any"
                      type="range"
                      value={effectiveThirdPartyShiftPoints}
                    />
                    <span className="zero-tick" aria-hidden="true" />
                  </div>
                  <div className="range-labels third-party-labels"><span>−{Math.abs(thirdPartyMinimumPoints).toFixed(1)} pts {thirdPartyLabels[thirdPartyCandidate]}</span><span>Actual</span><span>+{thirdPartyMaximumPoints.toFixed(1)} pts capacity</span></div>

                  <div className="slider-header secondary-slider">
                    <label htmlFor="pa-third-party-source">Harris share of exchanged ballots</label>
                    <strong>{thirdPartyHarrisExchangeShare.toFixed(0)}%</strong>
                  </div>
                  <input
                    disabled={!demographicFoundation}
                    id="pa-third-party-source"
                    max="100"
                    min="0"
                    onChange={(event) => setThirdPartyHarrisExchangeShare(Number(event.currentTarget.value))}
                    onInput={(event) => setThirdPartyHarrisExchangeShare(Number(event.currentTarget.value))}
                    onKeyDown={(event) => {
                      const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                        ? 1
                        : event.key === "ArrowLeft" || event.key === "ArrowDown"
                          ? -1
                          : null;
                      if (movement == null && event.key !== "Home" && event.key !== "End") return;
                      event.preventDefault();
                      setThirdPartyHarrisExchangeShare((current) => {
                        if (event.key === "Home") return 0;
                        if (event.key === "End") return 100;
                        return Math.min(100, Math.max(0, current + movement!));
                      });
                    }}
                    step="1"
                    type="range"
                    value={thirdPartyHarrisExchangeShare}
                  />
                  <div className="range-labels"><span>100% Trump</span><span>Equal source</span><span>100% Harris</span></div>

                  <div className="effect-grid">
                    <div><span>{thirdPartyLabels[thirdPartyCandidate]} votes</span><strong>{formatCompact(thirdPartyScenarioVotes)}</strong></div>
                    <div><span>Ballots exchanged</span><strong>{formatCompact(Math.abs(behaviorScenario?.thirdParty.realizedCandidateDelta ?? 0))}</strong></div>
                    <div><span>{activeDetailedStateCode} result</span><strong>{formatMargin(margin(detailedScenario))}</strong></div>
                  </div>
                  <p className="transfer-explainer"><strong>{formatNumber(Math.abs(behaviorScenario?.thirdParty.realizedCandidateDelta ?? 0))} of {formatNumber(Math.abs(behaviorScenario?.thirdParty.requestedCandidateDelta ?? 0))} requested ballots exchanged.</strong>{" "}The operation changes Harris by {formatNumber(behaviorScenario?.thirdParty.harrisVoteDelta ?? 0)} and Trump by {formatNumber(behaviorScenario?.thirdParty.trumpVoteDelta ?? 0)} while preserving the statewide ballot total.</p>
                </>
              )}

              <button className="reset-button" disabled={!activeScenarioChanged} onClick={resetScenario} type="button">
                Reset {activeDetailedStateCode} to exact baseline
              </button>
            </div>
          </section>
              </div>

              <div aria-labelledby="laboratory-tab-contributors" className="drawer-panel" data-active={laboratoryDrawerTab === "contributors"} id="laboratory-panel-contributors" role="tabpanel">
          {!selectedStateCode && <section className="national-portfolio-contributors">
            <div className="card-heading compact"><div><span className="overline">National movement</span><strong>Active detailed states</strong></div></div>
            {electoralConsequences.activeRows.length > 0 ? electoralConsequences.activeRows.map((row) => <button key={row.stateCode} onClick={() => selectState(row.stateCode)} type="button"><span><strong>{row.stateName}</strong><small>{formatMargin(row.actualMargin)} → {formatMargin(row.scenarioMargin)}</small></span><b>{row.targetElectoralDelta === 0 ? "0 EV" : `${row.targetElectoralDelta > 0 ? "+" : "−"}${Math.abs(row.targetElectoralDelta)} EV`}</b></button>) : <p>No detailed state recipe is active. Pennsylvania, Michigan, and Wisconsin are available for modeling.</p>}
          </section>}
          <div className={!selectedStateCode ? "national-detail-reference" : undefined}>
          <section className="contribution-card">
            <div className="card-heading compact contribution-heading">
              <div><span className="overline">Where the result moved</span><strong>Top contributors</strong></div>
              <span className={`contribution-total ${contributionSummary.statewideMarginDelta < 0 ? "toward-rep" : ""}`}>
                {formatMarginVotes(contributionSummary.statewideMarginDelta)}
              </span>
            </div>
            <div className="contribution-body">
              <p className="contribution-definition">Change in the Harris minus Trump vote margin across every active operation.</p>
              <div className="contribution-tabs" aria-label="Contribution geography">
                <button aria-pressed={contributionScope === "county"} onClick={() => setContributionScope("county")} type="button">Counties</button>
                <button aria-pressed={contributionScope === "vtd"} onClick={() => setContributionScope("vtd")} type="button">{activeGeographyShortLabel}</button>
              </div>
              {contributionRows.length > 0 ? (
                <ol className="contribution-list">
                  {contributionRows.map((row, index) => (
                    <li key={row.id}>
                      <button onClick={() => focusContribution(row)} type="button">
                        <span className="contribution-rank">{String(index + 1).padStart(2, "0")}</span>
                        <span className="contribution-name"><strong>{row.name}</strong><small>{row.context}</small></span>
                        <span className={`contribution-value ${row.marginDelta < 0 ? "toward-rep" : ""}`}>{formatMarginVotes(row.marginDelta)}</span>
                        <span className="contribution-track" aria-hidden="true">
                          <i
                            className={row.marginDelta < 0 ? "toward-rep" : ""}
                            style={{ "--contribution-share": `${Math.abs(row.marginDelta) / contributionMaximum * 100}%` } as CSSProperties}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="contribution-empty">{contributionEmptyText}</div>
              )}
              <div className="contribution-footnote">
                <span>{contributionScope === "county"
                  ? "County-linked contributions shown"
                  : `Top mapped ${activeGeographyFullLabel.toLowerCase()} shown`}</span>
                {contributionScope === "county" && contributionSummary.outsideCountyMarginDelta !== 0 && (
                  <strong>{formatMarginVotes(contributionSummary.outsideCountyMarginDelta)} statewide-only residual</strong>
                )}
                {contributionScope === "vtd" && contributionSummary.outsideTerrainMarginDelta !== 0 && (
                  <strong>{formatMarginVotes(contributionSummary.outsideTerrainMarginDelta)} outside terrain</strong>
                )}
              </div>
            </div>
          </section>
          </div>
              </div>

              <div aria-labelledby="laboratory-tab-assumptions" className="drawer-panel" data-active={laboratoryDrawerTab === "assumptions"} id="laboratory-panel-assumptions" role="tabpanel">
          <section className="ledger-card">
            <div className="card-heading compact">
              <div><span className="overline">Assumption ledger</span><strong>3 ordered operations</strong></div>
            </div>
            <div className="ledger-line locked">
              <span className="ledger-index">00</span>
              <div><strong>Certified state baseline</strong><span>Locked · FEC 2024</span></div>
              <b>✓</b>
            </div>
            <div className={`ledger-line ${turnoutIncreasePoints === 0 ? "inactive" : ""}`}>
              <span className="ledger-index">01</span>
              <div><strong>VAP turnout addition</strong><span>Ballots created · Harris share explicit</span></div>
              <b>{turnoutIncreasePoints === 0 ? "Off" : `+${turnoutIncreasePoints.toFixed(1)}`}</b>
            </div>
            <div className={`ledger-line ${effectivePreferenceShiftPoints === 0 ? "inactive" : ""}`}>
              <span className="ledger-index">02</span>
              <div><strong>Two-party preference transfer</strong><span>Runs after turnout · ballots preserved</span></div>
              <b>{effectivePreferenceShiftPoints === 0 ? "Off" : formatPreferenceMovement(effectivePreferenceShiftPoints)}</b>
            </div>
            <div className={`ledger-line ${effectiveThirdPartyShiftPoints === 0 ? "inactive" : ""}`}>
              <span className="ledger-index">03</span>
              <div><strong>Named third-party exchange</strong><span>Runs last · source share explicit</span></div>
              <b>{effectiveThirdPartyShiftPoints === 0 ? "Off" : formatThirdPartyMovement(effectiveThirdPartyShiftPoints, thirdPartyCandidate)}</b>
            </div>
          </section>
              </div>

              <div aria-labelledby="laboratory-tab-data" className="drawer-panel" data-active={laboratoryDrawerTab === "data"} id="laboratory-panel-data" role="tabpanel">
          {!selectedStateCode ? (
            <section className="provenance-ledger national-provenance" aria-label="National data coverage">
              <div className="card-heading compact"><div><span className="overline">United States data foundation</span><strong>Certified arithmetic and detailed geography coverage</strong></div></div>
              <div className="coverage-matrix" role="table" aria-label="National model coverage matrix">
                <div className="coverage-matrix-head" role="row"><span>State</span><span>Electoral model</span><span>Detailed geography</span><span>Geometry contract</span><span>Coverage</span></div>
                {nationalCoverageRows.map((row) => (
                  <div className="coverage-matrix-row" role="row" key={row.state}>
                    <strong>{row.state}</strong><span>{row.electoralModel}</span><span>{row.detailedGeography}</span><span>{row.geometryContract}</span><span>{row.coverage}</span>
                  </div>
                ))}
              </div>
              <p className="evidence-note">Unsupported means the statewide certified result participates in national arithmetic, but no local geographic behavior model is available.</p>
            </section>
          ) : (
            <section className="provenance-ledger" aria-label={`${evidenceLedger.stateName} data foundation`}>
              <div className="card-heading compact"><div><span className="overline">{evidenceLedger.stateName} data foundation</span><strong>Source, geography, and coverage ledger</strong></div></div>
              <div className="evidence-grid">
                <article><span>Election results</span><strong>{evidenceLedger.election.publisher}</strong><p>{evidenceLedger.election.title}</p><small>Retrieved {evidenceLedger.election.retrievedAt} · {evidenceLedger.election.artifactVersion}</small><a href={evidenceLedger.election.sourceUrl} rel="noreferrer" target="_blank">Open official source</a></article>
                <article><span>Local geography</span><strong>{evidenceLedger.geography.label}</strong><p>{evidenceLedger.geography.contract}</p><small>{evidenceLedger.geography.method}</small></article>
                <article><span>Coverage</span><strong>{formatNumber(evidenceLedger.coverage.mappedUnits)} / {formatNumber(evidenceLedger.coverage.totalUnits)} mapped</strong><p>{formatNumber(evidenceLedger.coverage.mappedBallots)} of {formatNumber(evidenceLedger.coverage.certifiedBallots)} ballots appear on terrain.</p><small>{formatNumber(evidenceLedger.coverage.unmatchedUnits)} unmatched polygons or units · {formatNumber(evidenceLedger.coverage.offMapBallots)} off-map ballots</small></article>
                <article><span>Treatment</span><strong>No invented geography</strong><p>{evidenceLedger.treatment}</p><small>{evidenceLedger.denominator}</small></article>
              </div>
              <div className="evidence-actions"><a href={evidenceLedger.methodologyUrl} rel="noreferrer" target="_blank">Full methodology</a><span>Third-party exchanges are transparent counterfactuals, not estimates of voter migration.</span></div>
            </section>
          )}
              </div>
            </div>
          </div>}
        </aside>
      </div>

      {workspaceMode === "home" && <div className="home-product-story">
        <section className="home-capabilities" aria-labelledby="home-capabilities-heading">
          <div className="home-section-heading">
            <span className="overline">One continuous workflow</span>
            <h2 id="home-capabilities-heading">Model the result. Direct the night. Understand the change.</h2>
            <p>The scenario engine, reporting-unit map, and replay timeline share one deterministic election foundation.</p>
          </div>
          <div className="home-capability-grid">
            <article><span>01</span><strong>Model</strong><p>Change turnout, two-party preference, and third-party support across detailed local geography.</p><small>Swingometer</small></article>
            <article><span>02</span><strong>Direct</strong><p>Choose reporting order, pace, volatility, stalls, and state activation without changing the final result.</p><small>Election Night</small></article>
            <article><span>03</span><strong>Understand</strong><p>Follow the counties and reporting units responsible for every statewide and Electoral College consequence.</p><small>Contribution ledger</small></article>
          </div>
        </section>

        <section className="home-workflow" aria-labelledby="home-workflow-heading">
          <div className="home-workflow-copy">
            <span className="overline">Analyst workflow</span>
            <h2 id="home-workflow-heading">From certified baseline to a replayable election.</h2>
            <p>Every scenario is constructed in a visible order, preserved as a compact recipe, and rebuilt through the same state-specific evidence contracts.</p>
            <button onClick={() => navigateWorkspace("laboratory")} type="button">Start with Pennsylvania <span>→</span></button>
          </div>
          <ol>
            <li><b>01</b><div><strong>Select detailed geography</strong><p>Begin nationally, enter a supported state, then drill through county and reporting-unit terrain.</p></div></li>
            <li><b>02</b><div><strong>Change voter behavior</strong><p>Separate participation, preference, and third-party operations keep the arithmetic understandable.</p></div></li>
            <li><b>03</b><div><strong>Inspect the consequence</strong><p>See which places moved the margin and whether the Electoral College result changed.</p></div></li>
            <li><b>04</b><div><strong>Run election night</strong><p>Reuse the scenario on the same map and publish local returns through a user-directed chronology.</p></div></li>
          </ol>
        </section>

        <section className="home-foundation" aria-labelledby="home-foundation-heading">
          <div className="home-section-heading compact">
            <span className="overline">Evidence before spectacle</span>
            <h2 id="home-foundation-heading">Different state data models, one honest interface.</h2>
          </div>
          <div className="home-foundation-grid">
            <article><strong>Pennsylvania</strong><span>VTD-linked model units</span><p>Official 2024 reporting units linked to Census voting-district terrain with unmatched coverage retained explicitly.</p></article>
            <article><strong>Michigan</strong><span>Exact-cycle precincts</span><p>2024 precinct reporting units use their corresponding local geometry, including explicit off-map structures.</p></article>
            <article><strong>Wisconsin</strong><span>Detailed wards</span><p>Ward-level reconstructed values remain labeled as reconstruction and reconcile to the certified statewide result.</p></article>
          </div>
          <div className="home-final-cta"><div><span className="overline">American electorate laboratory</span><strong>A scenario should be reproducible before it is persuasive.</strong></div><button onClick={() => navigateWorkspace("laboratory")} type="button">Open Sandbox 2.0</button></div>
        </section>
      </div>}

      <footer className="methodology-footer" id="methodology">
        <div>
          <span className="overline">Baseline sources</span>
          <a href={detailedSource.sourceUrl} rel="noreferrer" target="_blank">{activeDetailedStateCode} official election returns</a>
          <a href="https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html" rel="noreferrer" target="_blank">Census 2020 P.L. 94-171 P4</a>
        </div>
        <div><span className="overline">Actual national vote</span><strong>{formatNumber(actualNational.totalVotes)} ballots</strong></div>
        <div><span className="overline">Product status</span><strong>PA + MI geography audit · not a forecast</strong></div>
      </footer>
    </main>
  );
}

export function App() {
  return <ScenarioApp />;
}
