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
import { isPennsylvaniaFoundation } from "./data/detailedStateFoundation.ts";
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
import { installRuntimeDiagnosticsHook } from "./runtime/runtimeDiagnostics.ts";

installRuntimeDiagnosticsHook();

type ViewMode = ScenarioViewMode;
type BehaviorEditorMode = ScenarioEditorMode;
type ContributionScope = ScenarioContributionScope;
type WorkspaceMode = "home" | "laboratory";
type LaboratoryDrawerSnap = "collapsed" | "working" | "expanded";
type LaboratoryDrawerTab = "behavior" | "contributors" | "inspector" | "assumptions" | "data";

const laboratoryDrawerTabs: LaboratoryDrawerTab[] = ["behavior", "contributors", "inspector", "assumptions", "data"];

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

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function formatCompact(value: number) {
  return compactFormat.format(value);
}

function margin(result: Pick<StatewidePresidentialResult, "harrisVotes" | "trumpVotes" | "totalVotes">) {
  return ((result.harrisVotes - result.trumpVotes) / result.totalVotes) * 100;
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

export function App() {
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
  const activeGeographyShortLabel = activeDetailedStateCode === "PA" ? "VTDs" : "Precincts";
  const activeGeographyFullLabel = activeDetailedStateCode === "PA"
    ? "Voting districts (VTDs)"
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
    if (workspaceMode === "home" && code) navigateWorkspace("laboratory");
    selectState(code);
  }

  function selectRoute(route: PathTo270Route, stateCode?: string) {
    setSelectedRouteStateCodes(route.states.map((state) => state.stateCode).sort());
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

  return (
    <main
      className="application-shell"
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
            <button className="nav-item active" type="button">Laboratory</button>
            <button className="nav-item" onClick={() => openLaboratoryPanel("assumptions")} type="button">Assumptions</button>
            <button className="nav-item" onClick={() => navigateWorkspace("home")} type="button">Home</button>
          </>}
        </nav>

        <div className="build-status"><span />Alpha comprehension corrections · v0.19.1</div>
      </header>

      <div className="workbench" id="top">
        <section className="editorial-column" aria-labelledby="page-heading">
          {workspaceMode === "laboratory" && (
            <div className="laboratory-context">
              <span className="overline">{selectedStateCode ? selectedActual.name : "United States"} laboratory</span>
              <strong>{selectedStateCode ? selectedGeographyName : "United States"}</strong>
              <div>
                <span>Actual <b>{readoutActualMargin == null ? "Unavailable" : formatMargin(readoutActualMargin)}</b></span>
                <span>Scenario <b>{readoutScenarioMargin == null ? "Unavailable" : formatMargin(readoutScenarioMargin)}</b></span>
                {!selectedStateCode && <span>Electoral College <b>{electoralConsequences.scenarioNational.harrisElectoralVotes}–{electoralConsequences.scenarioNational.trumpElectoralVotes}</b></span>}
              </div>
              {selectedStateCode && <button onClick={selectedCountyFips ? () => selectCounty(null) : selectNation} type="button">
                ← {selectedCountyFips ? selectedActual.name : "United States"}
              </button>}
              {!selectedStateCode && <div className="supported-state-links"><span>Detailed states</span><button onClick={() => selectState("PA")} type="button">Pennsylvania</button><button onClick={() => selectState("MI")} type="button">Michigan</button></div>}
              <button className="fit-selection-button" onClick={() => setFitSelectionRequest((request) => request + 1)} type="button">
                {selectedStateCode ? "Fit selection" : "Fit United States"}
              </button>
            </div>
          )}
          <p className="overline">Historical counterfactual simulator</p>
          <h1 id="page-heading">Change America.<br />Watch the map answer.</h1>
          <p className="lede">
            Test an electoral assumption, trace the votes it moves, and follow the consequence from a state to the presidency.
          </p>

          <button className="open-sandbox-button" onClick={() => navigateWorkspace("laboratory")} type="button">Open Sandbox <span aria-hidden="true">→</span></button>

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
              <p>Pennsylvania and Michigan reconcile to certified results, with unmatched and non-geographic ballots kept explicit outside the terrain.</p>
            </div>
          </div>

          <div className="foundation-progress" aria-label="Foundation progress">
            <div className="progress-title"><span>Foundation status</span><strong>6 / 6</strong></div>
            <ol>
              <li className="complete"><span />Independent product</li>
              <li className="complete"><span />State baseline</li>
              <li className="complete"><span />Deterministic mutation</li>
              <li className="complete"><span />Pennsylvania and Michigan reporting units</li>
              <li className="complete"><span />Precinct geometry crosswalk</li>
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
            <div className="segmented" aria-label="Map comparison mode">
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
            </div>
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
                scenarioDetailedCounties={scenarioDetailedCounties}
                scenarioDetailedGeographies={scenarioDetailedGeographies}
                scenarioStates={scenarioStates}
                fitSelectionRequest={fitSelectionRequest}
                viewMode={viewMode}
                routeIndicators={(routeConstructionPlan?.states ?? []).map((state, index) => ({
                  stateCode: state.stateCode,
                  status: state.status,
                  order: index + 1,
                }))}
              />
            </Suspense>

            <div className="selected-readout" data-drilled={Boolean(selectedStateCode)} aria-live="polite">
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
            </div>
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
            </div>
          )}
        </section>

        <aside className={`control-column ${assumptionsOpen ? "open" : ""}`} aria-label="Scenario editor">
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

          <div
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
                  <p>All states use certified statewide totals. Pennsylvania and Michigan provide detailed county and reporting-unit foundations.</p>
                </section> : selectedInspector ? (
                  <GeographyInspector model={selectedInspector} onClearVtd={() => selectPrecinct(null)} />
                ) : <div className="drawer-empty"><strong>No local geography selected.</strong><span>Choose a county or {activeDetailedStateCode === "PA" ? "VTD" : "2024 precinct reporting unit"} to inspect its certified and scenario result.</span></div>}
              </div>

              <div aria-labelledby="laboratory-tab-behavior" className="drawer-panel" data-active={laboratoryDrawerTab === "behavior"} id="laboratory-panel-behavior" role="tabpanel">
          {!selectedStateCode && <div className="national-operation-note"><div><strong>Detailed-state operations</strong><span>Choose a supported state to edit certified reporting-unit behavior. Active recipes continue to aggregate nationally.</span></div><div><button onClick={() => selectState("PA")} type="button">Open Pennsylvania</button><button onClick={() => selectState("MI")} type="button">Open Michigan</button></div></div>}
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
                <strong>{behaviorEditorMode === "turnout" ? "2020 voting-age population" : "2024 counted ballots"}</strong>
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
                      : `${formatNumber(demographicFoundation.totals.denominatorStatus.availablePrecinctCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapPrecinctCount)} capped`
                    : behaviorEditorMode === "preference"
                      ? `${formatNumber(demographicFoundation.join.mappedElectionGeometryCount)} / ${formatNumber(demographicFoundation.join.geometryFeatureCount)} mapped precincts`
                      : "Stein · Oliver · residual Other"
                  : "…"}</strong>
              </div>

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
                  <div className="range-labels"><span>Actual</span><span>+0.8</span><span>+1.5</span></div>

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
                    <div><span>Available capacity</span><strong>{formatCompact(behaviorScenario?.turnout.capacity ?? 0)}</strong></div>
                    <div><span>{activeDetailedStateCode} result</span><strong>{formatMargin(margin(detailedScenario))}</strong></div>
                  </div>
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
                  <div className="range-labels preference-labels"><span>Harris → Trump</span><span>Actual</span><span>Trump → Harris</span></div>

                  <div className="effect-grid">
                    <div><span>Ballots transferred</span><strong>{formatCompact(Math.abs(behaviorScenario?.preference.realizedTransfer ?? 0))}</strong></div>
                    <div><span>State margin movement</span><strong>{formatMarginVotes(contributionSummary.statewideMarginDelta)}</strong></div>
                    <div><span>{activeDetailedStateCode} result</span><strong>{formatMargin(margin(detailedScenario))}</strong></div>
                  </div>
                  <p className="transfer-explainer">
                    <strong>{formatNumber(Math.abs(behaviorScenario?.preference.realizedTransfer ?? 0))} ballots transferred → {formatNumber(Math.abs(contributionSummary.statewideMarginDelta))} votes of {effectivePreferenceShiftPoints >= 0 ? "Harris−Trump" : "Trump−Harris"} margin movement.</strong>
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
                  <div className="range-labels third-party-labels"><span>Remove candidate vote</span><span>Actual</span><span>Exchange capacity</span></div>

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
            {electoralConsequences.activeRows.length > 0 ? electoralConsequences.activeRows.map((row) => <button key={row.stateCode} onClick={() => selectState(row.stateCode)} type="button"><span><strong>{row.stateName}</strong><small>{formatMargin(row.actualMargin)} → {formatMargin(row.scenarioMargin)}</small></span><b>{row.targetElectoralDelta === 0 ? "0 EV" : `${row.targetElectoralDelta > 0 ? "+" : "−"}${Math.abs(row.targetElectoralDelta)} EV`}</b></button>) : <p>No detailed state recipe is active. Pennsylvania and Michigan are available for modeling.</p>}
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
          </div>
        </aside>
      </div>

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
