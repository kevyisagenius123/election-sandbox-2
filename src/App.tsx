import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
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

type ViewMode = ScenarioViewMode;
type BehaviorEditorMode = ScenarioEditorMode;
type ContributionScope = ScenarioContributionScope;

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

const thirdPartyLabels: Record<ThirdPartyCandidate, string> = {
  stein: "Stein",
  oliver: "Oliver",
  residual_other: "Other/write-in",
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

export function App() {
  const [initialScenarioUrlLoad] = useState(() => decodeScenarioSearch(window.location.search));
  const initialScenarioUrlState = initialScenarioUrlLoad.state;
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
  const [scenarioLinkNotice, setScenarioLinkNotice] = useState<string | null>(
    scenarioUrlNotice(initialScenarioUrlLoad),
  );
  const [copiedScenarioUrl, setCopiedScenarioUrl] = useState<string | null>(null);
  const [failedScenarioUrl, setFailedScenarioUrl] = useState<string | null>(null);
  const observedScenarioSearch = useRef(window.location.search);
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
      if (window.location.search === observedScenarioSearch.current) return;
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
    selectedCountyFips,
    selectedStateCode,
    selectedVtdGeoid,
    thirdPartyCandidate,
    thirdPartyHarrisExchangeShare,
    turnoutIncreasePoints,
    viewMode,
  ]);

  const currentScenarioShareUrl = useMemo(() => buildScenarioUrl(
    window.location.href,
    scenarioUrlState,
    { force: true, clearHash: true },
  ), [scenarioUrlState]);
  const shareStatus = copiedScenarioUrl === currentScenarioShareUrl
    ? "copied"
    : failedScenarioUrl === currentScenarioShareUrl
      ? "error"
      : "idle";

  useEffect(() => {
    if (!demographicFoundation || scenarioPending) return;
    const nextUrl = buildScenarioUrl(window.location.href, scenarioUrlState);
    if (nextUrl !== window.location.href) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
    observedScenarioSearch.current = window.location.search;
  }, [demographicFoundation, scenarioPending, scenarioUrlState]);

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
  const detailedStateFlipped = detailedScenario.harrisVotes > detailedScenario.trumpVotes;
  const activeScenarioChanged = !isDefaultStateBehaviorSettings(currentStateRecipeSettings);
  const scenarioChanged = portfolioRecipes.length > 0;
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
  const readoutShift = readoutActualMargin == null || readoutScenarioMargin == null
    ? null
    : readoutScenarioMargin - readoutActualMargin;
  const selectedGeographyName = selectedVtd?.name
    ?? selectedActualCounty?.name
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

  function selectNation() {
    setStoredScenarioRecipes(scenarioRecipeRecord);
    setSelectedVtdGeoid(null);
    setSelectedCountyFips(null);
    setSelectedStateCode(null);
  }

  function selectCounty(fips: string | null) {
    setSelectedVtdGeoid(null);
    setSelectedCountyFips(fips);
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
  }

  function chooseThirdPartyCandidate(candidate: ThirdPartyCandidate) {
    setThirdPartyCandidate(candidate);
    setThirdPartyShiftPoints(0);
  }

  return (
    <main className="application-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Sandbox 2.0 home">
          <span className="brand-rule" aria-hidden="true"><i /><i /></span>
          <span>
            <span className="overline">American electorate laboratory</span>
            <strong>Sandbox 2.0</strong>
          </span>
        </a>

        <nav className="primary-nav" aria-label="Primary navigation">
          <button className="nav-item active" type="button">Explore</button>
          <button className="nav-item" onClick={() => setAssumptionsOpen(true)} type="button">Assumptions</button>
          <a className="nav-item" href="#methodology">Sources</a>
        </nav>

        <div className="build-status"><span />Multi-state behavior lab · v0.14</div>
      </header>

      <div className="workbench" id="top">
        <section className="editorial-column" aria-labelledby="page-heading">
          <p className="overline">Historical counterfactual simulator</p>
          <h1 id="page-heading">Change America.<br />Watch the map answer.</h1>
          <p className="lede">
            Test an electoral assumption, trace the votes it moves, and follow the consequence from a state to the presidency.
          </p>

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

        <section className="map-column" aria-label="National election workbench">
          <div className="map-toolbar">
            <div>
              <span className="overline">Geographic scope</span>
              <div className="breadcrumb">
                <button onClick={selectNation} type="button">United States</button>
                {selectedStateCode && <><span>/</span>{selectedCountyFips ? <button onClick={() => selectCounty(null)} type="button">{selectedActual.name}</button> : <strong>{selectedActual.name}</strong>}</>}
                {selectedActualCounty && <><span>/</span>{selectedVtd ? <button onClick={() => setSelectedVtdGeoid(null)} type="button">{selectedActualCounty.name}</button> : <strong>{selectedActualCounty.name}</strong>}</>}
                {selectedVtd && <><span>/</span><strong>{selectedVtd.name}</strong></>}
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
                activeCountyFips={selectedCountyFips}
                activePrecinctGeoid={selectedVtdGeoid}
                activeStateCode={selectedStateCode}
                activeDetailedStateManifest={selectedStateCode === activeDetailedStateCode ? activeDetailedStateManifest : null}
                actualDetailedCounties={detailedCounties}
                actualStates={states2024}
                onActiveCountyChange={selectCounty}
                onActivePrecinctChange={setSelectedVtdGeoid}
                onActiveStateChange={selectState}
                scenarioDetailedCounties={scenarioDetailedCounties}
                scenarioDetailedGeographies={scenarioDetailedGeographies}
                scenarioStates={scenarioStates}
                viewMode={viewMode}
              />
            </Suspense>

            <div className="selected-readout" data-drilled={Boolean(selectedStateCode)} aria-live="polite">
              <div>
                <span className="overline">Selected</span>
                <strong>{selectedGeographyName}</strong>
              </div>
              <div className="readout-margin">
                <span>Actual</span><strong>{readoutActualMargin == null ? "NO RETURN" : formatMargin(readoutActualMargin)}</strong>
              </div>
              <div className="readout-arrow" aria-hidden="true">→</div>
              <div className="readout-margin">
                <span>Scenario</span><strong>{readoutScenarioMargin == null ? "NO RETURN" : formatMargin(readoutScenarioMargin)}</strong>
              </div>
              <div className={`shift-chip ${readoutShift != null && readoutShift > 0.05 ? "toward-dem" : ""}`}>
                {readoutShift == null
                  ? "Unavailable"
                  : Math.abs(readoutShift) < 0.05
                    ? "No change"
                    : `${readoutShift > 0 ? "+" : ""}${readoutShift.toFixed(1)} pts D`}
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
                >{shareStatus === "copied" ? "Copied" : shareStatus === "error" ? "Try copy" : "Copy link"}</button>
              </div>
            </div>
            <div className="scenario-score">
              <div><span>Harris</span><strong className="dem-text">{scenarioNational.harrisElectoralVotes}</strong></div>
              <div className="score-divider"><span>270</span></div>
              <div><strong className="rep-text">{scenarioNational.trumpElectoralVotes}</strong><span>Trump</span></div>
            </div>
            <div className="scenario-message" data-flipped={detailedStateFlipped}>
              <span className="message-dot" />
              {detailedStateFlipped
                ? `${activeDetailedStateManifest.name} flips to Harris`
                : activeScenarioChanged
                  ? `Synthetic ${activeDetailedStateManifest.name} behavior scenario active`
                  : scenarioChanged
                    ? `${portfolioRecipes.length} state ${portfolioRecipes.length === 1 ? "scenario" : "scenarios"} active`
                  : "Scenario matches the certified EV baseline"}
            </div>
            {portfolioRecipes.length > 0 && (
              <div className="scenario-portfolio" aria-label="Active state scenarios">
                <span>Active states</span>
                <div>
                  {portfolioRecipes.map((recipe) => {
                    const summary = recipe.stateCode === activeDetailedStateCode
                      ? detailedScenarioPending
                        ? null
                        : { scenarioMargin: margin(detailedScenario) }
                      : inactiveScenarioSummaries.get(recipe.stateCode);
                    return (
                      <button
                        aria-pressed={recipe.stateCode === activeDetailedStateCode}
                        data-testid={`portfolio-state-${recipe.stateCode}`}
                        key={recipe.stateCode}
                        onClick={() => selectState(recipe.stateCode)}
                        type="button"
                      >
                        <strong>{recipe.stateCode}</strong>
                        <small>{summary ? formatMargin(summary.scenarioMargin) : "Updating"}</small>
                      </button>
                    );
                  })}
                </div>
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
              <strong aria-live="polite">{scenarioPending ? "Updating scenario" : shareStatus === "copied" ? "Link copied" : shareStatus === "error" ? "Copy unavailable" : ""}</strong>
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

          {selectedInspector && (
            <GeographyInspector
              model={selectedInspector}
              onClearVtd={() => setSelectedVtdGeoid(null)}
            />
          )}

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
                <button aria-pressed={contributionScope === "vtd"} onClick={() => setContributionScope("vtd")} type="button">Precincts</button>
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
                  : "Top mapped precincts shown"}</span>
                {contributionScope === "county" && contributionSummary.outsideCountyMarginDelta !== 0 && (
                  <strong>{formatMarginVotes(contributionSummary.outsideCountyMarginDelta)} statewide-only residual</strong>
                )}
                {contributionScope === "vtd" && contributionSummary.outsideTerrainMarginDelta !== 0 && (
                  <strong>{formatMarginVotes(contributionSummary.outsideTerrainMarginDelta)} outside terrain</strong>
                )}
              </div>
            </div>
          </section>

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

          <div className="model-warning">
            <strong>What this model does not claim</strong>
            <p>Turnout uses 2020 population age 18 and over, not citizen or 2024 eligible population. Third-party exchanges follow the chosen Harris/Trump source share; they are a transparent counterfactual, not an estimate of voter migration.</p>
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
