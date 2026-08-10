import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  aggregateNational,
  applyBehaviorScenario,
  deriveBehaviorContributions,
  preferenceShiftBounds,
  type BehaviorScenarioResult,
  type StatewidePresidentialResult,
  type ThirdPartyCandidate,
} from "../packages/election-model/src/scenario.ts";
import {
  loadPennsylvaniaDemographicFoundation,
  scenarioVtdMap,
  toBehaviorModelUnits,
  type PennsylvaniaDemographicFoundation,
} from "./data/paDemographics.ts";
import { states2024 } from "./data/states.ts";
import {
  pennsylvaniaCounties2024,
  pennsylvaniaCountySource,
  pennsylvania2024,
} from "./data/pennsylvania.ts";

type ViewMode = "actual" | "scenario" | "difference";
type BehaviorEditorMode = "turnout" | "preference" | "third-party";
type ContributionScope = "county" | "vtd";

interface ContributionRow {
  id: string;
  name: string;
  context: string;
  countyFips: string;
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

export function App() {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("scenario");
  const [behaviorEditorMode, setBehaviorEditorMode] = useState<BehaviorEditorMode>("turnout");
  const [turnoutIncreasePoints, setTurnoutIncreasePoints] = useState(0);
  const [addedVoterHarrisShare, setAddedVoterHarrisShare] = useState(55);
  const [preferenceShiftPoints, setPreferenceShiftPoints] = useState(0);
  const [thirdPartyCandidate, setThirdPartyCandidate] = useState<ThirdPartyCandidate>("stein");
  const [thirdPartyShiftPoints, setThirdPartyShiftPoints] = useState(0);
  const [thirdPartyHarrisExchangeShare, setThirdPartyHarrisExchangeShare] = useState(50);
  const [contributionScope, setContributionScope] = useState<ContributionScope>("county");
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);
  const [demographicFoundation, setDemographicFoundation] = useState<
    PennsylvaniaDemographicFoundation | null
  >(null);
  const [demographicError, setDemographicError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadPennsylvaniaDemographicFoundation()
      .then((foundation) => {
        if (!active) return;
        setDemographicFoundation(foundation);
        setDemographicError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDemographicError(
          error instanceof Error ? error.message : "Demographic foundation could not be loaded",
        );
      });
    return () => { active = false; };
  }, []);

  const paActual = states2024.find((state) => state.code === "PA")!;
  const behaviorModelUnits = useMemo(
    () => demographicFoundation ? toBehaviorModelUnits(demographicFoundation) : null,
    [demographicFoundation],
  );
  const behaviorScenario = useMemo<BehaviorScenarioResult | null>(
    () => behaviorModelUnits ? applyBehaviorScenario(behaviorModelUnits, {
      turnoutIncreasePoints,
      addedVoterHarrisShare: addedVoterHarrisShare / 100,
      preferenceShiftPoints,
      thirdPartyCandidate,
      thirdPartyShiftPoints,
      thirdPartyHarrisExchangeShare: thirdPartyHarrisExchangeShare / 100,
    }) : null,
    [
      addedVoterHarrisShare,
      behaviorModelUnits,
      preferenceShiftPoints,
      thirdPartyCandidate,
      thirdPartyHarrisExchangeShare,
      thirdPartyShiftPoints,
      turnoutIncreasePoints,
    ],
  );
  const preferenceBase = useMemo(() => ({
    harrisVotes: paActual.harrisVotes + (behaviorScenario?.turnout.harrisVotes ?? 0),
    trumpVotes: paActual.trumpVotes + (behaviorScenario?.turnout.trumpVotes ?? 0),
    totalVotes: paActual.totalVotes + (behaviorScenario?.turnout.addedVotes ?? 0),
  }), [behaviorScenario, paActual]);
  const preferenceBounds = useMemo(
    () => preferenceShiftBounds(preferenceBase),
    [preferenceBase],
  );
  const effectivePreferenceShiftPoints = Math.min(
    preferenceBounds.towardHarrisPoints,
    Math.max(preferenceBounds.towardTrumpPoints, preferenceShiftPoints),
  );
  const fallbackThirdPartyVotes = thirdPartyCandidate === "stein"
    ? pennsylvania2024.totals.steinVotes
    : thirdPartyCandidate === "oliver"
      ? pennsylvania2024.totals.oliverVotes
      : pennsylvania2024.totals.residualOtherVotes;
  const thirdPartyBallotTotal = behaviorScenario?.thirdParty.ballotTotal
    ?? pennsylvania2024.totals.totalVotes;
  const thirdPartyStartingVotes = behaviorScenario?.thirdParty.startingCandidateVotes
    ?? fallbackThirdPartyVotes;
  const thirdPartyExchangeCapacity = behaviorScenario?.thirdParty.exchangeCapacity
    ?? Math.min(pennsylvania2024.totals.harrisVotes, pennsylvania2024.totals.trumpVotes) * 2;
  const thirdPartyMinimumPoints = -(thirdPartyStartingVotes * 100) / thirdPartyBallotTotal;
  const thirdPartyMaximumPoints = (thirdPartyExchangeCapacity * 100) / thirdPartyBallotTotal;
  const effectiveThirdPartyShiftPoints = Math.min(
    thirdPartyMaximumPoints,
    Math.max(thirdPartyMinimumPoints, thirdPartyShiftPoints),
  );
  const paScenario = useMemo<StatewidePresidentialResult>(() => {
    if (!behaviorScenario) return paActual;
    const harrisWins = behaviorScenario.totals.harrisVotes > behaviorScenario.totals.trumpVotes;
    return {
      ...paActual,
      ...behaviorScenario.totals,
      harrisElectoralVotes: harrisWins ? 19 : 0,
      trumpElectoralVotes: harrisWins ? 0 : 19,
    };
  }, [behaviorScenario, paActual]);

  const scenarioStates = useMemo(
    () => states2024.map((state) => (
      state.code === "PA"
        ? paScenario
        : state
    )),
    [paScenario],
  );

  const actualNational = useMemo(() => aggregateNational(states2024), []);
  const scenarioNational = useMemo(
    () => aggregateNational(scenarioStates),
    [scenarioStates],
  );
  const scenarioPennsylvaniaCounties = useMemo(
    () => {
      if (!behaviorScenario) {
        return pennsylvaniaCounties2024.map((county) => ({ ...county, netHarrisGain: 0 }));
      }
      const totalsByCounty = new Map<string, {
        harrisVotes: number;
        trumpVotes: number;
        steinVotes: number;
        oliverVotes: number;
        residualOtherVotes: number;
        otherVotes: number;
        totalVotes: number;
      }>();
      for (const unit of behaviorScenario.units) {
        if (!unit.countyFips) continue;
        const total = totalsByCounty.get(unit.countyFips) ?? {
          harrisVotes: 0,
          trumpVotes: 0,
          steinVotes: 0,
          oliverVotes: 0,
          residualOtherVotes: 0,
          otherVotes: 0,
          totalVotes: 0,
        };
        total.harrisVotes += unit.harrisVotes;
        total.trumpVotes += unit.trumpVotes;
        total.steinVotes += unit.steinVotes;
        total.oliverVotes += unit.oliverVotes;
        total.residualOtherVotes += unit.residualOtherVotes;
        total.otherVotes += unit.otherVotes;
        total.totalVotes += unit.totalVotes;
        totalsByCounty.set(unit.countyFips, total);
      }
      return pennsylvaniaCounties2024.map((county) => {
        const scenario = totalsByCounty.get(county.fips);
        if (!scenario) throw new Error(`Scenario is missing county ${county.fips}`);
        return {
          ...county,
          ...scenario,
          netHarrisGain: scenario.harrisVotes - county.harrisVotes,
        };
      });
    },
    [behaviorScenario],
  );
  const scenarioPennsylvaniaVtds = useMemo(
    () => scenarioVtdMap(behaviorScenario?.units ?? []),
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
      pennsylvaniaCounties2024.map((county) => [county.fips, county.name]),
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
        marginDelta,
      }))
      .filter((row) => row.marginDelta !== 0)
      .sort((left, right) => Math.abs(right.marginDelta) - Math.abs(left.marginDelta));
    const vtdByGeoid = new Map(demographicFoundation.vtds.map((vtd) => [vtd.geoid, vtd]));
    const vtds = contributions
      .filter((contribution) => contribution.geometryId && contribution.marginDelta !== 0)
      .map((contribution) => {
        const vtd = vtdByGeoid.get(contribution.geometryId!);
        const countyFips = contribution.countyFips ?? contribution.geometryId!.slice(0, 5);
        return {
          id: contribution.geometryId!,
          name: vtd?.displayName ?? vtd?.censusName ?? contribution.geometryId!,
          context: countyNames.get(countyFips) ?? countyFips,
          countyFips,
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
  }, [behaviorModelUnits, behaviorScenario, demographicFoundation]);

  const selectedActual = states2024.find((state) => state.code === selectedStateCode) ?? states2024[38];
  const selectedScenario = scenarioStates.find((state) => state.code === selectedStateCode) ?? scenarioStates[38];
  const selectedActualCounty = pennsylvaniaCounties2024.find(
    (county) => county.fips === selectedCountyFips,
  );
  const selectedScenarioCounty = scenarioPennsylvaniaCounties.find(
    (county) => county.fips === selectedCountyFips,
  );
  const paFlipped = paScenario.harrisVotes > paScenario.trumpVotes;
  const scenarioChanged = turnoutIncreasePoints !== 0
    || effectivePreferenceShiftPoints !== 0
    || effectiveThirdPartyShiftPoints !== 0;
  const contributionRows = contributionScope === "county"
    ? contributionSummary.counties.slice(0, 5)
    : contributionSummary.vtds.slice(0, 5);
  const contributionEmptyText = scenarioChanged && contributionSummary.statewideMarginDelta === 0
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
  const readoutActualMargin = selectedActualCounty
    ? margin(selectedActualCounty)
    : selectedStateCode
      ? margin(selectedActual)
      : ((actualNational.harrisVotes - actualNational.trumpVotes) / actualNational.totalVotes) * 100;
  const readoutScenarioMargin = selectedScenarioCounty
    ? margin(selectedScenarioCounty)
    : selectedStateCode
      ? margin(selectedScenario)
      : ((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100;
  const readoutShift = readoutScenarioMargin - readoutActualMargin;
  const selectedGeographyName = selectedActualCounty?.name
    ?? (selectedStateCode ? selectedActual.name : "United States");

  function selectState(code: string | null) {
    setSelectedStateCode(code);
    if (code !== "PA") setSelectedCountyFips(null);
  }

  function selectNation() {
    setSelectedCountyFips(null);
    setSelectedStateCode(null);
  }

  function resetScenario() {
    setTurnoutIncreasePoints(0);
    setAddedVoterHarrisShare(55);
    setPreferenceShiftPoints(0);
    setThirdPartyCandidate("stein");
    setThirdPartyShiftPoints(0);
    setThirdPartyHarrisExchangeShare(50);
    setViewMode("scenario");
  }

  function focusContribution(row: ContributionRow) {
    setSelectedStateCode("PA");
    setSelectedCountyFips(row.countyFips);
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

        <div className="build-status"><span />Pennsylvania behavior lab · v0.6</div>
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
              <p>Pennsylvania reconciles to the certified result, with 98.6% of precinct-file votes linked to audited Census voting-district geometry.</p>
            </div>
          </div>

          <div className="foundation-progress" aria-label="Foundation progress">
            <div className="progress-title"><span>Foundation status</span><strong>6 / 6</strong></div>
            <ol>
              <li className="complete"><span />Independent product</li>
              <li className="complete"><span />State baseline</li>
              <li className="complete"><span />Deterministic mutation</li>
              <li className="complete"><span />Pennsylvania reporting units</li>
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
                {selectedStateCode && <><span>/</span>{selectedCountyFips ? <button onClick={() => setSelectedCountyFips(null)} type="button">{selectedActual.name}</button> : <strong>{selectedActual.name}</strong>}</>}
                {selectedActualCounty && <><span>/</span><strong>{selectedActualCounty.name}</strong></>}
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
                activeStateCode={selectedStateCode}
                actualPennsylvaniaCounties={pennsylvaniaCounties2024}
                actualStates={states2024}
                onActiveCountyChange={setSelectedCountyFips}
                onActiveStateChange={selectState}
                scenarioPennsylvaniaCounties={scenarioPennsylvaniaCounties}
                scenarioPennsylvaniaVtds={scenarioPennsylvaniaVtds}
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
                <span>Actual</span><strong>{formatMargin(readoutActualMargin)}</strong>
              </div>
              <div className="readout-arrow" aria-hidden="true">→</div>
              <div className="readout-margin">
                <span>Scenario</span><strong>{formatMargin(readoutScenarioMargin)}</strong>
              </div>
              <div className={`shift-chip ${readoutShift > 0.05 ? "toward-dem" : ""}`}>
                {Math.abs(readoutShift) < 0.05 ? "No change" : `${readoutShift > 0 ? "+" : ""}${readoutShift.toFixed(1)} pts D`}
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
              <span className="year-chip">2024</span>
            </div>
            <div className="scenario-score">
              <div><span>Harris</span><strong className="dem-text">{scenarioNational.harrisElectoralVotes}</strong></div>
              <div className="score-divider"><span>270</span></div>
              <div><strong className="rep-text">{scenarioNational.trumpElectoralVotes}</strong><span>Trump</span></div>
            </div>
            <div className="scenario-message" data-flipped={paFlipped}>
              <span className="message-dot" />
              {paFlipped
                ? "Pennsylvania flips to Harris"
                : scenarioChanged
                  ? "Synthetic Pennsylvania behavior scenario active"
                  : "Scenario matches the certified EV baseline"}
            </div>
            <div className="popular-row">
              <span>National popular vote</span>
              <strong>{formatMargin(((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100)}</strong>
            </div>
          </section>

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
                <strong>Pennsylvania</strong>
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
                    ? `${formatNumber(demographicFoundation.totals.denominatorStatus.availableVtdCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapVtdCount)} capped`
                    : behaviorEditorMode === "preference"
                      ? `${formatNumber(demographicFoundation.join.mappedElectionGeometryCount)} / ${formatNumber(demographicFoundation.join.geometryFeatureCount)} VTDs`
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
                    <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
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
                    <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
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
                    <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
                  </div>
                </>
              )}

              <button className="reset-button" disabled={!scenarioChanged} onClick={resetScenario} type="button">
                Reset to exact baseline
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
                <button aria-pressed={contributionScope === "vtd"} onClick={() => setContributionScope("vtd")} type="button">VTDs</button>
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
                  : "Top mapped VTDs shown"}</span>
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
          <a href={pennsylvaniaCountySource.sourceUrl} rel="noreferrer" target="_blank">PA election returns · FEC baseline</a>
          <a href="https://www.census.gov/programs-surveys/decennial-census/about/rdo/summary-files.html" rel="noreferrer" target="_blank">Census 2020 P.L. 94-171 P4</a>
        </div>
        <div><span className="overline">Actual national vote</span><strong>{formatNumber(actualNational.totalVotes)} ballots</strong></div>
        <div><span className="overline">Product status</span><strong>Pennsylvania multi-candidate lab · not a forecast</strong></div>
      </footer>
    </main>
  );
}
