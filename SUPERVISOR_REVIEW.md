# Sandbox 2.0 Supervisor Review Candidate

**Candidate:** `v0.19.1-supervisor-review`  
**Review status:** Frozen pre-human-alpha candidate  
**Human evidence:** None  
**Detailed-state admission:** Frozen after Pennsylvania and Michigan

## Decision requested

Review the exact candidate named above and issue one of the three verdicts at the end of this document. This review asks whether Sandbox is disciplined enough to expose to unfamiliar users. It is not a substitute for human usability evidence.

## 1. Product state

Sandbox 2.0 is an independent, deterministic laboratory for historical United States election counterfactuals. It currently provides:

- the reconciled certified 2024 presidential baseline, including the 312 to 226 Electoral College allocation;
- one continuous national, state, county, and reporting-unit laboratory;
- detailed Pennsylvania and Michigan laboratories;
- separate turnout, two-party preference, and named third-party operations;
- exact geographic contribution rankings for counties and supported local units;
- live state-flip requirements that separate ballots moved from Harris-minus-Trump margin movement;
- national popular-vote and Electoral College consequences from simultaneous state recipes;
- deterministic Path to 270 calculations using fewest states, aggregate margin movement, or aggregate net-margin votes;
- explicit Required, Modeled, and Satisfied route-state classifications;
- reproducible schema-2 scenario URLs that restore state recipes, target candidate, route metric, selected geography, and interface state;
- state-specific evidence ledgers that distinguish Pennsylvania VTD geography from Michigan 2024 precinct reporting units.

The full research application remains private. A separate fresh-history public demo exposes only FEC statewide totals and national state geometry. It is not the candidate under review.

## 2. Evidence

The candidate is supported by the following checked-in evidence:

| Evidence | Current record | What it establishes |
| --- | --- | --- |
| Deterministic model and URL tests | 48 passing at v0.19.1 readiness | Reconciliation, scenario arithmetic, Electoral College invariants, route construction, and replay contracts |
| Browser journeys | 33 passing in bounded local groups | Navigation, scenario restoration, runtime ownership, responsive layouts, and corrected comprehension surfaces |
| Canonical visual regressions | Eight desktop/responsive references plus reduced-motion check | Editorial Home, national modes, route state, PA, county drilldown, medium width, and mobile bottom sheet |
| Runtime profile | 35 PA/MI cycles; all accepted budgets passed | Bounded workers, geometry lifecycle, heap growth, and cycle time |
| Hostile stale-resource test | Passing | Obsolete asynchronous state resources cannot replace the active state |
| Historical remote smoke | Passed before containment | Home to Laboratory to PA scenario to copied URL restoration |
| v0.19A synthetic alpha | `SYNTHETIC_ALPHA_REPORT.md` | Predicted discoverability, terminology, evidence, and trust failures in v0.18.2 |
| Same-eight correction rerun | `SYNTHETIC_ALPHA_RERUN_REPORT.md` | Predicted failures rechecked against v0.19.1; not human evidence |
| Fresh-agent cognitive evaluation | `docs/review/v0.19.1-supervisor-review/FRESH_AGENT_COGNITIVE_EVALUATION.md` | BLOCKED before navigation by the installed browser integration; no product finding inferred |

The final release-gate commands, dates, environment, and results are recorded in `docs/review/v0.19.1-supervisor-review/FROZEN_VERIFICATION.md`.

## 3. Data and trust status

This status is a release boundary, not a footnote:

```text
PA result redistribution       REVIEW / BLOCKED
MI result redistribution       REVIEW / BLOCKED
External human delivery        BLOCKED pending resolution
Permission outreach            POSTPONED by owner decision
Full research repository       PRIVATE
Former full-product Pages      UNPUBLISHED / HTTP 404
Sanitized national demo        PUBLIC
```

The repository contains official-result derivatives whose public redistribution basis remains unresolved. The full application and source were therefore moved behind a private boundary, the previous Pages deployment was removed, and its deployment workflow was deleted from the current branch. No research data or Git history was purged.

The public demo is a distinct clean-history repository. It contains no county, precinct, VTD, reporting-unit, local demographic, crosswalk, or detailed-state scenario artifacts. It must not be treated as the v0.19B participant build.

## 4. Exact supervisor review tasks

Perform these tasks against the frozen private candidate without reading project documentation during Tasks 1–7. After each task, explain what you believe happened and why before continuing.

1. **Create a Pennsylvania scenario.** Enter Pennsylvania and apply a plausible change that improves Harris's result.
2. **Stop short.** Keep Pennsylvania on the certified winner's side and locate the exact additional Harris-minus-Trump movement required to flip it.
3. **Flip Pennsylvania.** Cross the threshold and identify the largest counties and VTDs responsible for the scenario change.
4. **Construct a Path to 270.** Choose a route metric, select a route, and explain Required, Modeled, and Satisfied using only interface language.
5. **Restore the scenario.** Copy the scenario link, leave the current state, reopen the URL, and verify that the assumptions and consequence return.
6. **Audit the evidence.** Open Pennsylvania and Michigan's Data surfaces and identify the result source, geometry contract, mapped coverage, off-map treatment, and denominator status.
7. **Explain the Electoral College consequence.** Without documentation, identify which scenario states changed allocation, by how many electoral votes, and which assumptions caused the change.

Then answer these adversarial questions using only the application:

1. Is this a forecast? Explain.
2. If Wisconsin appears in a Path to 270, does that mean Sandbox modeled Wisconsin precincts?
3. What geographic evidence underlies Pennsylvania compared with Michigan?

## 5. Known limitations

- Only Pennsylvania and Michigan have detailed laboratories.
- Unsupported route states are statewide mathematical requirements only.
- Pennsylvania local terrain uses 2020 Census VTD polygons linked to 2024 reporting units, not exact-cycle precinct geometry.
- Michigan uses 2024 precinct reporting-unit geometry with explicitly retained off-map units and adjustments.
- Sandbox provides no forecast probabilities.
- The current deterministic counterfactual model has no statistical uncertainty layer.
- There is no demographics behavior editor.
- Run My Election has not been implemented.
- The PA and MI redistribution review remains unresolved.
- The candidate has synthetic evaluation evidence but no human-alpha evidence.
- Human hesitation, attention, motor interaction, fatigue, emotional response, and genuine trust remain unvalidated.

## 6. Required verdict

Select exactly one and provide reasons tied to observed evidence.

### APPROVE HUMAN ALPHA

The candidate is disciplined enough for unfamiliar-user testing once an approved participant-delivery method is recorded.

### REQUEST CORRECTIONS

List each required correction, its severity, the evidence that revealed it, and the regression check required before resubmission.

### HOLD

Identify the unresolved condition that prevents unfamiliar-user exposure and the evidence required to remove the hold.

**Selected verdict:**  
**Reasons:**  
**Required follow-up:**  

## Phase boundary

A favorable synthetic or supervisor review does not waive the human gate. State #3 may be researched at the source-comparison level, but it may not be registered, shipped as detailed, added to production geometry, wired to a worker, or used to expand the production interface until the human-alpha admission gate is satisfied.
