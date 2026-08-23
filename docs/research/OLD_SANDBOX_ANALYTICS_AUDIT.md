# Old Sandbox Analytics Audit

Date: 2026-08-23

## Executive verdict

The old Sandbox contained a strong analytical product idea but an unsafe analytical hierarchy. Exact descriptive arithmetic, heuristic forecasts, visual scores, and decision claims were presented beside one another with similar authority. Several values had duplicate implementations with incompatible formulas.

The correct response is not to discard the rich analytics. It is to preserve the descriptive workstation, rebuild event-derived diagnostics, and quarantine unsupported predictive claims.

This audit examined the legacy workspace's React analytics surfaces, results-summary derivations, analytics workstation, Java simulation summaries, scenario-intelligence service, and Python prediction modules. The legacy sources are not copied into this repository.

## Principal findings

### 1. Final inputs could masquerade as live analytics

The legacy `AnalyticsPanel` sums `countyResults` directly for national vote share, labels the resulting difference `Projected Margin`, and separately counts live completed counties. This combines endpoint inputs and replay progress in one panel. It also hard-codes 3,143 counties and labels average reported ballots per loaded county as `Avg Turnout`.

Evidence in the legacy workspace:

- `frontend/src/components/sandbox/AnalyticsPanel.tsx:64`
- `frontend/src/components/sandbox/AnalyticsPanel.tsx:79`
- `frontend/src/components/sandbox/AnalyticsPanel.tsx:212`
- `frontend/src/components/sandbox/AnalyticsPanel.tsx:244`

### 2. “Win probability” had at least three incompatible meanings

The frontend scenario panel, Java scenario-intelligence service, Java aggregate service, and Python analytics service do not share one probability contract. The Python service explicitly describes its implementation as a heuristic that mimics ML, yet emits `method: ml_ensemble`.

Evidence:

- `frontend/src/components/sandbox/ScenarioIntelligencePanel.tsx:89`
- `backend/sandbox-backend/src/main/java/com/sandbox/election/service/ScenarioIntelligenceService.java:187`
- `backend/sandbox-backend/src/main/java/com/sandbox/election/service/SimulationAggregateService.java:92`
- `backend/python-analytics/app/models/win_probability.py:38`
- `backend/python-analytics/app/models/win_probability.py:80`

These are scores, not calibrated probabilities. They must not migrate.

### 3. Some trajectories and uncertainty were invented for presentation

The fallback turnout trajectory creates quarter, halfway, and projected points from the current reported percentage and a win-probability value rather than historical observations. Outstanding partisan lean allocates an arbitrary “uncertain” fraction according to the current margin bucket.

Evidence:

- `frontend/src/components/sandbox/results-summary/useResultsSummaryData.ts:351`
- `frontend/src/components/sandbox/results-summary/useResultsSummaryData.ts:353`
- `frontend/src/components/sandbox/results-summary/useResultsSummaryData.ts:598`

These displays looked analytical but did not represent a measured trajectory or fitted uncertainty distribution.

### 4. Decision-desk language exceeded the model

The Python race caller claims similarity to major decision desks but includes fixed rules such as a 50 percent reporting floor, 95 percent reporting plus a two-point margin, fixed mail/early/Election Day biases, and decisive `key counties`. Those rules are not jurisdiction-specific, backtested decision policies.

Evidence:

- `backend/python-analytics/app/models/race_caller.py:22`
- `backend/python-analytics/app/models/race_caller.py:31`
- `backend/python-analytics/app/models/race_caller.py:115`
- `backend/python-analytics/app/models/race_caller.py:278`
- `backend/python-analytics/app/models/race_caller.py:290`

The mathematical-exhaustion check is valid arithmetic. The statistical and key-county calls are not approved.

### 5. County importance was a composite heuristic

The county-importance service combines hand-selected weights for size, competitiveness, estimated bellwether accuracy, and estimated reporting speed. Historical accuracy is empty by default, while bellwether accuracy is inferred from similarity to the current state margin.

Evidence:

- `backend/python-analytics/app/models/county_importance.py:33`
- `backend/python-analytics/app/models/county_importance.py:195`
- `backend/python-analytics/app/models/county_importance.py:230`
- `backend/python-analytics/app/models/county_importance.py:246`

This may inspire a later watch-list model, but it cannot be called predictive importance.

### 6. The workstation contained the best foundation

The analytics workstation correctly attempted to centralize county and state rows with vote totals, current margins, outstanding ballots, return deltas, velocity, scope contributions, and data-quality flags. Its architecture is worth preserving.

It still needs correction:

- fallback outstanding vote is inferred circularly from reported percent;
- `flipFlag` means only mathematical openness;
- deltas depend on sampled UI ticks rather than canonical events;
- contribution shares can become misleading when signed movements cancel;
- stall thresholds are arbitrary;
- margin percentage units are inconsistent in the local fallback;
- the backend and frontend can both derive the same row.

Evidence:

- `frontend/src/components/sandbox/analytics-workstation/useAnalyticsRows.ts:95`
- `frontend/src/components/sandbox/analytics-workstation/useAnalyticsRows.ts:109`
- `frontend/src/components/sandbox/analytics-workstation/useAnalyticsRows.ts:122`
- `frontend/src/components/sandbox/analytics-workstation/useAnalyticsRows.ts:129`
- `frontend/src/components/sandbox/analytics-workstation/useAnalyticsRows.ts:182`

## Feature disposition

| Old analytic | Verdict | Correct Sandbox 2.0 treatment |
| --- | --- | --- |
| Candidate vote totals | Retain | Candidate-complete certified, scenario, or reported ledgers |
| Candidate vote shares | Retain | Name all-ballot or two-party denominator |
| Vote margin in votes and points | Retain | Name endpoint or current-prefix scope |
| Reporting-unit count | Retain | Published units divided by admitted units |
| Expected vote represented | Retain with condition | Modeled denominator must be locked and disclosed |
| Ballots outstanding | Retain with condition | Endpoint bookkeeping or explicit modeled estimate, never silent inference |
| Margin timeline | Retain | Rebuild directly from canonical return prefixes |
| CSV/JSON export | Retain | Include evidence identity and semantic classes |
| State and county leaderboard | Rebuild | Rank by a selected, named measure rather than generic importance |
| County focus card | Rebuild | Explain why selected: newest return, largest exact movement, or largest outstanding pool |
| Return delta and movers | Rebuild | Use atomic returns or selected canonical time windows |
| Reporting velocity | Rebuild | Use ballots or returns per logical-time window; never render cadence |
| Reporting stall | Rebuild | Versioned threshold, logical time, and modeled-chronology label |
| Margin contributors | Rebuild | Signed operation-aware contribution ledger with residuals |
| Margin shift from baseline | Rebuild | Explicit certified baseline and current reported or scenario comparison |
| Outstanding-to-margin | Relabel | `Outstanding / current margin`; interpretation is `mathematically open` |
| Flip Risk preset | Relabel | `Mathematical paths`, with no probability implication |
| Projected Margin | Relabel | `Current reported margin` or `scenario endpoint margin` |
| Reporting Progress | Split | `Returns published` and `modeled ballots represented` |
| Avg Turnout | Remove or relabel | It was average reported ballots per loaded county, not turnout |
| Completion ETA | Remove pending rebuild | Requires a validated event-arrival model and interval |
| Momentum | Remove or relabel | Use exact recent margin movement over a named window |
| Turnout trajectory fallback | Remove | Invented intermediate and projected points |
| Partisan lean of outstanding vote | Remove pending model | Current-share extrapolation plus arbitrary uncertainty buckets |
| Win probability | Quarantine | Requires one calibrated, backtested probability model |
| Confidence interval | Quarantine | Requires a defined stochastic model and coverage validation |
| Automatic race call | Quarantine | Requires a separate Decision Desk constitution and backtests |
| Key county decisive call | Remove | County winners alone cannot justify a state call |
| Bellwether accuracy | Remove pending history | Requires a versioned multi-election dataset and validation |
| County importance score | Remove | Composite weights had no empirical calibration |
| Demographic validation score | Rebuild | Separate data coverage, allocation quality, and model fit |
| 3D analytic charts | Selectively rebuild | Only when height and color encode approved metrics more clearly than 2D |

## What Sandbox 2.0 already gets right

The current product provides a much safer foundation:

- scenario arithmetic is deterministic and candidate-complete;
- requested and realized operations are separate;
- county and reporting-unit contribution is exact;
- certified, modeled, and required Electoral College states are distinct;
- Path to 270 is explicitly mathematical, not a forecast;
- Election Night reported analytics are derived from the observable replay prefix;
- the replay kernel structurally excludes future fields;
- off-map and residual votes remain visible in reconciliation.

The next analytics work should extend these contracts rather than port legacy panels.

## Product conclusion

The old Sandbox was not too analytical. It was insufficiently explicit about which analytics were facts, arithmetic, diagnostics, estimates, or decisions. Its richness should return through a governed ledger, not through a gallery of attractive but semantically mixed cards.
