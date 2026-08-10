import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  aggregateNational,
  applyBehaviorScenario,
  type BehaviorScenarioResult,
  type StatewidePresidentialResult,
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
} from "./data/pennsylvania.ts";

type ViewMode = "actual" | "scenario" | "difference";
type BehaviorEditorMode = "turnout" | "preference";

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

export function App() {
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("scenario");
  const [behaviorEditorMode, setBehaviorEditorMode] = useState<BehaviorEditorMode>("turnout");
  const [turnoutIncreasePoints, setTurnoutIncreasePoints] = useState(0);
  const [addedVoterHarrisShare, setAddedVoterHarrisShare] = useState(55);
  const [preferenceShiftPoints, setPreferenceShiftPoints] = useState(0);
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
    }) : null,
    [addedVoterHarrisShare, behaviorModelUnits, preferenceShiftPoints, turnoutIncreasePoints],
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
        otherVotes: number;
        totalVotes: number;
      }>();
      for (const unit of behaviorScenario.units) {
        if (!unit.countyFips) continue;
        const total = totalsByCounty.get(unit.countyFips) ?? {
          harrisVotes: 0,
          trumpVotes: 0,
          otherVotes: 0,
          totalVotes: 0,
        };
        total.harrisVotes += unit.harrisVotes;
        total.trumpVotes += unit.trumpVotes;
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

  const selectedActual = states2024.find((state) => state.code === selectedStateCode) ?? states2024[38];
  const selectedScenario = scenarioStates.find((state) => state.code === selectedStateCode) ?? scenarioStates[38];
  const selectedActualCounty = pennsylvaniaCounties2024.find(
    (county) => county.fips === selectedCountyFips,
  );
  const selectedScenarioCounty = scenarioPennsylvaniaCounties.find(
    (county) => county.fips === selectedCountyFips,
  );
  const paTransfer = paScenario.harrisVotes - paActual.harrisVotes;
  const paFlipped = paScenario.harrisVotes > paScenario.trumpVotes;
  const scenarioChanged = turnoutIncreasePoints !== 0 || preferenceShiftPoints !== 0;
  const preferenceBaseHarris = paActual.harrisVotes + (behaviorScenario?.turnout.harrisVotes ?? 0);
  const preferenceBaseTrump = paActual.trumpVotes + (behaviorScenario?.turnout.trumpVotes ?? 0);
  const threshold = Math.max(
    0,
    Math.ceil((preferenceBaseTrump - preferenceBaseHarris + 1) / 2),
  );
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
    setViewMode("scenario");
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

        <div className="build-status"><span />Pennsylvania behavior lab · v0.4</div>
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
                      : "Result-linked geometry"
                    : "Loading Census denominator"}</span>
                <strong>{demographicFoundation
                  ? behaviorEditorMode === "turnout"
                    ? `${formatNumber(demographicFoundation.totals.denominatorStatus.availableVtdCount)} ready · ${formatNumber(demographicFoundation.totals.denominatorStatus.ballotsExceed2020VapVtdCount)} capped`
                    : `${formatNumber(demographicFoundation.join.mappedElectionGeometryCount)} / ${formatNumber(demographicFoundation.join.geometryFeatureCount)} VTDs`
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
                    max="80"
                    min="20"
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
                        if (event.key === "Home") return 20;
                        if (event.key === "End") return 80;
                        return Math.min(80, Math.max(20, current + movement!));
                      });
                    }}
                    step="1"
                    type="range"
                    value={addedVoterHarrisShare}
                  />
                  <div className="range-labels"><span>20% Harris</span><span>Even</span><span>80% Harris</span></div>

                  <div className="effect-grid">
                    <div><span>Added ballots</span><strong>{formatCompact(behaviorScenario?.turnout.addedVotes ?? 0)}</strong></div>
                    <div><span>Available capacity</span><strong>{formatCompact(behaviorScenario?.turnout.capacity ?? 0)}</strong></div>
                    <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="slider-header">
                    <label htmlFor="pa-preference">Two-party margin movement</label>
                    <strong>+{preferenceShiftPoints.toFixed(1)} pts D</strong>
                  </div>
                  <input
                    disabled={!demographicFoundation}
                    id="pa-preference"
                    max="4"
                    min="0"
                    onChange={(event) => setPreferenceShiftPoints(Number(event.currentTarget.value))}
                    onInput={(event) => setPreferenceShiftPoints(Number(event.currentTarget.value))}
                    onKeyDown={(event) => {
                      const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                        ? 0.1
                        : event.key === "ArrowLeft" || event.key === "ArrowDown"
                          ? -0.1
                          : null;
                      if (movement == null && event.key !== "Home" && event.key !== "End") return;
                      event.preventDefault();
                      setPreferenceShiftPoints((current) => {
                        if (event.key === "Home") return 0;
                        if (event.key === "End") return 4;
                        return Math.min(4, Math.max(0, Number((current + movement!).toFixed(1))));
                      });
                    }}
                    step="0.1"
                    type="range"
                    value={preferenceShiftPoints}
                  />
                  <div className="range-labels"><span>Actual</span><span>Flip need: {formatCompact(threshold)}</span><span>+4.0</span></div>

                  <div className="effect-grid">
                    <div><span>Votes transferred</span><strong>{formatCompact(behaviorScenario?.preference.realizedTransfer ?? 0)}</strong></div>
                    <div><span>Total Harris gain</span><strong>{formatCompact(paTransfer)}</strong></div>
                    <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
                  </div>
                </>
              )}

              <button className="reset-button" disabled={!scenarioChanged} onClick={resetScenario} type="button">
                Reset to exact baseline
              </button>
            </div>
          </section>

          <section className="ledger-card">
            <div className="card-heading compact">
              <div><span className="overline">Assumption ledger</span><strong>2 ordered operations</strong></div>
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
            <div className={`ledger-line ${preferenceShiftPoints === 0 ? "inactive" : ""}`}>
              <span className="ledger-index">02</span>
              <div><strong>Two-party preference transfer</strong><span>Runs after turnout · ballots preserved</span></div>
              <b>{preferenceShiftPoints === 0 ? "Off" : `+${preferenceShiftPoints.toFixed(1)}`}</b>
            </div>
          </section>

          <div className="model-warning">
            <strong>What this model does not claim</strong>
            <p>Turnout uses 2020 population age 18 and over, not citizen or 2024 eligible population. Census data do not reveal candidate choice, so the preference operation remains an explicit synthetic assumption.</p>
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
        <div><span className="overline">Product status</span><strong>Pennsylvania behavior foundation · not a forecast</strong></div>
      </footer>
    </main>
  );
}
