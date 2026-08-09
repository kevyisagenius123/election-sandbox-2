"use client";

import { useMemo, useState } from "react";

type ViewMode = "actual" | "scenario" | "difference";

interface StateTile {
  abbreviation: string;
  name: string;
  actualDemMargin: number;
  electoralVotes: number;
  column: number;
  row: number;
}

const stateTiles: StateTile[] = [
  { abbreviation: "WA", name: "Washington", actualDemMargin: 18.2, electoralVotes: 12, column: 1, row: 1 },
  { abbreviation: "OR", name: "Oregon", actualDemMargin: 14.3, electoralVotes: 8, column: 1, row: 2 },
  { abbreviation: "CA", name: "California", actualDemMargin: 20.6, electoralVotes: 54, column: 1, row: 3 },
  { abbreviation: "NV", name: "Nevada", actualDemMargin: -3.1, electoralVotes: 6, column: 2, row: 3 },
  { abbreviation: "AZ", name: "Arizona", actualDemMargin: -5.5, electoralVotes: 11, column: 3, row: 4 },
  { abbreviation: "CO", name: "Colorado", actualDemMargin: 11.0, electoralVotes: 10, column: 3, row: 3 },
  { abbreviation: "TX", name: "Texas", actualDemMargin: -13.7, electoralVotes: 40, column: 4, row: 5 },
  { abbreviation: "MN", name: "Minnesota", actualDemMargin: 4.2, electoralVotes: 10, column: 5, row: 1 },
  { abbreviation: "WI", name: "Wisconsin", actualDemMargin: -0.9, electoralVotes: 10, column: 5, row: 2 },
  { abbreviation: "MI", name: "Michigan", actualDemMargin: -1.4, electoralVotes: 15, column: 6, row: 2 },
  { abbreviation: "IL", name: "Illinois", actualDemMargin: 10.9, electoralVotes: 19, column: 5, row: 3 },
  { abbreviation: "GA", name: "Georgia", actualDemMargin: -2.2, electoralVotes: 16, column: 6, row: 5 },
  { abbreviation: "FL", name: "Florida", actualDemMargin: -13.1, electoralVotes: 30, column: 7, row: 5 },
  { abbreviation: "NC", name: "North Carolina", actualDemMargin: -3.2, electoralVotes: 16, column: 7, row: 4 },
  { abbreviation: "OH", name: "Ohio", actualDemMargin: -11.2, electoralVotes: 17, column: 7, row: 3 },
  { abbreviation: "PA", name: "Pennsylvania", actualDemMargin: -1.7, electoralVotes: 19, column: 8, row: 2 },
  { abbreviation: "VA", name: "Virginia", actualDemMargin: 5.8, electoralVotes: 13, column: 8, row: 4 },
  { abbreviation: "NY", name: "New York", actualDemMargin: 12.6, electoralVotes: 28, column: 9, row: 1 },
];

function formatMargin(value: number) {
  if (Math.abs(value) < 0.05) return "Even";
  return `${value > 0 ? "D" : "R"} +${Math.abs(value).toFixed(1)}`;
}

function tileColor(margin: number) {
  if (margin >= 15) return "#3d7896";
  if (margin >= 7) return "#70a9ba";
  if (margin > 0) return "#acd0cf";
  if (margin > -4) return "#ead9a8";
  if (margin > -10) return "#e69a63";
  return "#c95740";
}

export function SandboxWorkbench() {
  const [draftTurnout, setDraftTurnout] = useState(0);
  const [appliedTurnout, setAppliedTurnout] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("scenario");
  const [selectedState, setSelectedState] = useState("PA");

  const pennsylvaniaScenarioMargin = -1.7 + appliedTurnout * 0.42;
  const pennsylvaniaFlipped = pennsylvaniaScenarioMargin > 0;
  const scenarioEv = pennsylvaniaFlipped
    ? { democratic: 245, republican: 293 }
    : { democratic: 226, republican: 312 };

  const selected = stateTiles.find((state) => state.abbreviation === selectedState) ?? stateTiles[15];
  const selectedScenarioMargin = selected.abbreviation === "PA"
    ? pennsylvaniaScenarioMargin
    : selected.actualDemMargin;

  const tiles = useMemo(
    () => stateTiles.map((state) => {
      const scenarioMargin = state.abbreviation === "PA"
        ? pennsylvaniaScenarioMargin
        : state.actualDemMargin;
      const visibleMargin = viewMode === "actual" ? state.actualDemMargin : scenarioMargin;
      const difference = scenarioMargin - state.actualDemMargin;
      return { ...state, scenarioMargin, visibleMargin, difference };
    }),
    [pennsylvaniaScenarioMargin, viewMode],
  );

  function resetScenario() {
    setDraftTurnout(0);
    setAppliedTurnout(0);
  }

  return (
    <main className="sandbox-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span /><span /></div>
          <div>
            <div className="eyebrow">American electorate laboratory</div>
            <div className="brand-name">Sandbox 2.0</div>
          </div>
        </div>
        <div className="phase-pill"><span className="status-dot" />Foundation build · 2024 baseline</div>
      </header>

      <div className="workspace">
        <section className="intro-column" aria-labelledby="page-title">
          <div className="eyebrow">Historical counterfactual simulator</div>
          <h1 id="page-title">Change the electorate. Trace every consequence.</h1>
          <p className="lede">
            Test one assumption, follow it through local reporting units, and see how it changes the country.
          </p>
          <div className="principle-card">
            <div className="micro-label">Hard engineering invariant</div>
            <strong>No changes means the exact actual result.</strong>
            <p>Every published reporting unit must reconcile upward through counties, states, and the Electoral College.</p>
          </div>
        </section>

        <section className="map-column" aria-label="Election map prototype">
          <div className="map-header">
            <div>
              <div className="micro-label">Geographic scope</div>
              <div className="breadcrumb">USA › {selected.name}</div>
            </div>
            <div className="view-switcher" aria-label="Map view">
              {(["actual", "scenario", "difference"] as ViewMode[]).map((mode) => (
                <button
                  aria-pressed={viewMode === mode}
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  type="button"
                >
                  {mode === "difference" ? "Delta" : mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="map-stage">
            <div className="cartogram" role="group" aria-label="Selected 2024 state results">
              {tiles.map((state) => {
                const tileMargin = viewMode === "difference" ? state.difference : state.visibleMargin;
                const background = viewMode === "difference" && Math.abs(state.difference) < 0.05
                  ? "#e2e4dc"
                  : tileColor(tileMargin);
                return (
                  <button
                    aria-label={`${state.name}, ${formatMargin(state.visibleMargin)}`}
                    className="state-tile"
                    data-selected={selectedState === state.abbreviation}
                    key={state.abbreviation}
                    onClick={() => setSelectedState(state.abbreviation)}
                    style={{
                      "--tile": background,
                      background,
                      gridColumn: state.column,
                      gridRow: state.row,
                    } as React.CSSProperties}
                    type="button"
                  >
                    {state.abbreviation}
                    <small>{viewMode === "difference" ? `${state.difference >= 0 ? "+" : ""}${state.difference.toFixed(1)}` : formatMargin(state.visibleMargin)}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="map-legend" aria-label="Winning margin legend">
            <span>Democratic</span><div className="legend-ramp" /><span>Republican</span>
          </div>
        </section>

        <aside className="control-column" aria-label="Scenario controls">
          <section className="result-card">
            <div className="result-card-header">
              <span className="micro-label">Your scenario</span><span className="year">2024</span>
            </div>
            <div className="result-row">
              <div className="candidate"><span className="candidate-name">Harris</span><span className="ev blue">{scenarioEv.democratic}</span></div>
              <div className="candidate"><span className="candidate-name">Trump</span><span className="ev red">{scenarioEv.republican}</span></div>
            </div>
            <div className="delta-note">
              {pennsylvaniaFlipped ? "Pennsylvania flips · Harris +19 EV" : "Matches the actual Electoral College baseline"}
            </div>
          </section>

          <section className="control-card">
            <div className="control-heading">
              <div><div className="micro-label">Behavior editor</div><h2>Turnout</h2></div>
              <span className="prototype-tag">Prototype</span>
            </div>
            <div className="scope-field">
              <div className="micro-label">Applies to</div>
              <div className="scope-value">Age 18–29 · Pennsylvania</div>
            </div>
            <div className="slider-label"><span>Turnout change</span><strong>+{draftTurnout} pts</strong></div>
            <input
              aria-label="Pennsylvania age 18 to 29 turnout change"
              max="12"
              min="0"
              onChange={(event) => setDraftTurnout(Number(event.target.value))}
              step="1"
              type="range"
              value={draftTurnout}
            />
            <div className="range-ends"><span>Actual</span><span>+12 points</span></div>
            <div className="action-row">
              <button className="primary-action" onClick={() => setAppliedTurnout(draftTurnout)} type="button">Apply assumption</button>
              <button className="secondary-action" onClick={resetScenario} type="button">Reset</button>
            </div>
            <div className="ledger">
              <div className="micro-label">Assumption ledger</div>
              <div className="ledger-row"><span>Actual baseline</span><strong>Locked</strong></div>
              <div className="ledger-row"><span>Youth turnout · PA</span><strong>{appliedTurnout ? `+${appliedTurnout} pts` : "No change"}</strong></div>
            </div>
          </section>

          <section className="explain-card">
            <div className="micro-label">Selected state</div>
            <h3>{selected.name}: {formatMargin(selectedScenarioMargin)}</h3>
            <p>
              {selected.abbreviation === "PA" && appliedTurnout > 0
                ? `The illustrative turnout assumption moves Pennsylvania ${Math.abs(appliedTurnout * 0.42).toFixed(1)} points toward Harris.`
                : "No active assumption changes this state in the foundation prototype."}
            </p>
          </section>

          <p className="prototype-warning">
            Interface prototype only. The Pennsylvania response factor is illustrative until the verified reporting-unit and demographic models are connected. This is not a forecast.
          </p>
        </aside>
      </div>
    </main>
  );
}
