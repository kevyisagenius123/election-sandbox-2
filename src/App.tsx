import { lazy, Suspense, useMemo, useState } from "react";
import {
  aggregateNational,
  applyCountyTwoPartyMarginShift,
  applyTwoPartyMarginShift,
  type StatewidePresidentialResult,
} from "../packages/election-model/src/scenario.ts";
import { states2024 } from "./data/states.ts";
import {
  pennsylvaniaCounties2024,
  pennsylvaniaCountySource,
} from "./data/pennsylvania.ts";

type ViewMode = "actual" | "scenario" | "difference";

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
  const [pennsylvaniaShift, setPennsylvaniaShift] = useState(0);
  const [assumptionsOpen, setAssumptionsOpen] = useState(true);

  const scenarioStates = useMemo(
    () => states2024.map((state) => (
      state.code === "PA"
        ? applyTwoPartyMarginShift(state, pennsylvaniaShift)
        : state
    )),
    [pennsylvaniaShift],
  );

  const actualNational = useMemo(() => aggregateNational(states2024), []);
  const scenarioNational = useMemo(
    () => aggregateNational(scenarioStates),
    [scenarioStates],
  );
  const scenarioPennsylvaniaCounties = useMemo(
    () => applyCountyTwoPartyMarginShift(
      pennsylvaniaCounties2024,
      states2024.find((state) => state.code === "PA")!,
      pennsylvaniaShift,
    ),
    [pennsylvaniaShift],
  );

  const selectedActual = states2024.find((state) => state.code === selectedStateCode) ?? states2024[38];
  const selectedScenario = scenarioStates.find((state) => state.code === selectedStateCode) ?? scenarioStates[38];
  const selectedActualCounty = pennsylvaniaCounties2024.find(
    (county) => county.fips === selectedCountyFips,
  );
  const selectedScenarioCounty = scenarioPennsylvaniaCounties.find(
    (county) => county.fips === selectedCountyFips,
  );
  const paActual = states2024.find((state) => state.code === "PA")!;
  const paScenario = scenarioStates.find((state) => state.code === "PA")!;
  const paTransfer = paScenario.harrisVotes - paActual.harrisVotes;
  const paFlipped = paScenario.harrisVotes > paScenario.trumpVotes;
  const threshold = Math.ceil((paActual.trumpVotes - paActual.harrisVotes + 1) / 2);
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
    setPennsylvaniaShift(0);
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

        <div className="build-status"><span />Pennsylvania pilot · v0.3</div>
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
            <div className="progress-title"><span>Foundation status</span><strong>5 / 6</strong></div>
            <ol>
              <li className="complete"><span />Independent product</li>
              <li className="complete"><span />State baseline</li>
              <li className="complete"><span />Deterministic mutation</li>
              <li className="complete"><span />Pennsylvania reporting units</li>
              <li className="complete"><span />Precinct geometry crosswalk</li>
              <li><span />Demographic model</li>
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
              {paFlipped ? "Pennsylvania flips to Harris" : "Scenario matches the certified EV baseline"}
            </div>
            <div className="popular-row">
              <span>National popular vote</span>
              <strong>{formatMargin(((scenarioNational.harrisVotes - scenarioNational.trumpVotes) / scenarioNational.totalVotes) * 100)}</strong>
            </div>
          </section>

          <section className="assumption-card">
            <div className="card-heading">
              <div><span className="overline">Foundation control</span><strong>Two-party margin shift</strong></div>
              <button className="collapse-button" onClick={() => setAssumptionsOpen((value) => !value)} type="button" aria-expanded={assumptionsOpen}>
                {assumptionsOpen ? "−" : "+"}
              </button>
            </div>

            <div className="control-body">
              <div className="field-label">
                <span>Geography</span>
                <strong>Pennsylvania</strong>
              </div>
              <div className="field-label">
                <span>Operation</span>
                <strong>Shift two-party margin toward Harris</strong>
              </div>

              <div className="slider-header">
                <label htmlFor="pa-shift">Margin movement</label>
                <strong>+{pennsylvaniaShift.toFixed(1)} pts D</strong>
              </div>
              <input
                id="pa-shift"
                max="4"
                min="0"
                onChange={(event) => setPennsylvaniaShift(Number(event.currentTarget.value))}
                onInput={(event) => setPennsylvaniaShift(Number(event.currentTarget.value))}
                onKeyDown={(event) => {
                  const movement = event.key === "ArrowRight" || event.key === "ArrowUp"
                    ? 0.1
                    : event.key === "ArrowLeft" || event.key === "ArrowDown"
                      ? -0.1
                      : null;
                  if (movement == null && event.key !== "Home" && event.key !== "End") return;
                  event.preventDefault();
                  setPennsylvaniaShift((current) => {
                    if (event.key === "Home") return 0;
                    if (event.key === "End") return 4;
                    return Math.min(4, Math.max(0, Number((current + movement!).toFixed(1))));
                  });
                }}
                step="0.1"
                type="range"
                value={pennsylvaniaShift}
              />
              <div className="range-labels"><span>Actual</span><span>Flip line: +1.7</span><span>+4.0</span></div>

              <div className="effect-grid">
                <div><span>Votes transferred</span><strong>{formatCompact(paTransfer)}</strong></div>
                <div><span>Votes needed to flip</span><strong>{formatCompact(threshold)}</strong></div>
                <div><span>PA result</span><strong>{formatMargin(margin(paScenario))}</strong></div>
              </div>

              <button className="reset-button" disabled={pennsylvaniaShift === 0} onClick={resetScenario} type="button">
                Reset to exact baseline
              </button>
            </div>
          </section>

          <section className="ledger-card">
            <div className="card-heading compact">
              <div><span className="overline">Assumption ledger</span><strong>1 audit-safe operation</strong></div>
            </div>
            <div className="ledger-line locked">
              <span className="ledger-index">00</span>
              <div><strong>Certified state baseline</strong><span>Locked · FEC 2024</span></div>
              <b>✓</b>
            </div>
            <div className={`ledger-line ${pennsylvaniaShift === 0 ? "inactive" : ""}`}>
              <span className="ledger-index">01</span>
              <div><strong>Pennsylvania margin shift</strong><span>Two-party · total votes preserved</span></div>
              <b>{pennsylvaniaShift === 0 ? "Off" : `+${pennsylvaniaShift.toFixed(1)}`}</b>
            </div>
          </section>

          <div className="model-warning">
            <strong>Why this control is limited</strong>
            <p>The statewide shift is deterministically distributed across Pennsylvania counties and preserves every county total. Demographic turnout controls remain locked until Census crosswalks are validated.</p>
          </div>
        </aside>
      </div>

      <footer className="methodology-footer" id="methodology">
        <div><span className="overline">Baseline sources</span><a href={pennsylvaniaCountySource.sourceUrl} rel="noreferrer" target="_blank">PA Department of State county returns · FEC statewide baseline</a></div>
        <div><span className="overline">Actual national vote</span><strong>{formatNumber(actualNational.totalVotes)} ballots</strong></div>
        <div><span className="overline">Product status</span><strong>Pennsylvania precinct pilot · not a forecast</strong></div>
      </footer>
    </main>
  );
}
