# v0.19.1 Synthetic Alpha Rerun

Date: 2026-08-12

## Research status

This is a repeated synthetic cognitive walkthrough, not a human usability study. Human participants: **none**. The same eight personas and the same five tasks from v0.19A were used. The purpose is to test whether the specific predicted failure modes remain after the bounded corrections, not to produce statistically meaningful percentages.

The public-deployment task remains provisional until the post-deployment remote smoke job passes on GitHub Pages.

## Unchanged tasks

1. Enter Pennsylvania and make a plausible change without prior coaching.
2. Explain ballots transferred versus Harris-minus-Trump margin movement.
3. Stop short of flipping Pennsylvania and identify the exact remaining requirement without first selecting a national route.
4. Build and interpret a Path to 270, including Required, Modeled, Satisfied, and unsupported mathematical geography.
5. Reopen a shared scenario and identify the leading geographic contributors.

The journalist and auditor again inspected the evidence chain. The campaign strategist again identified a decision-useful insight unavailable from a conventional result map.

## Before and after comprehension matrix

| Concept | v0.19A | v0.19.1 | Result |
|---|---:|---:|---|
| Actual vs Scenario | 7/8 | 8/8 | Predicted novice ambiguity removed |
| Required meaning | 6/8 | 8/8 | Adjacent “not a forecast” definition worked |
| Modeled vs Satisfied | 6/8 | 8/8 | Separate recipe and winner-change definitions worked |
| Transfer vs margin | 6/8 | 8/8 | Two-vote explanation at the values worked |
| Mathematical vs geographic route | 6/8 | 8/8 | Unsupported-route disclosure and coverage matrix worked |

## Persona results

### A. Casual Skimmer

- **Task 1:** Complete. First action was `Open controls` under `Change Pennsylvania`; no snap vocabulary was needed.
- **Task 2:** Complete. Read 35,294 ballots transferred and 70,588 votes of Harris-minus-Trump margin movement as separate quantities.
- **Task 3:** Complete. Found the live 49,679-vote remaining gap in the state card before opening Path to 270.
- **Task 4:** Complete. Interpreted Required as needed movement rather than a prediction.
- **Task 5:** Complete. Understood `Copy scenario link` as the save/reconstruction mechanism and found Contributors.
- **Wrong turns:** None material.
- **Trust:** Moderate. Provenance was available but not sought spontaneously.
- **Severity remaining:** None.

### B. Election Nerd

- **Tasks 1–5:** Complete without help.
- Correctly reconstructed the causal chain: +1.0 D preference, 35,294 transfers, +70,588 margin movement, R+0.7 effective result, 49,679 still needed.
- Correctly distinguished statewide mathematical requirements from detailed PA/MI recipes.
- **Trust:** High for arithmetic and state-source trace.
- **Severity remaining:** None.

### C. Skeptical Journalist

- **Tasks 1–5:** Complete without help.
- The Pennsylvania evidence ledger exposed publisher, election artifact, retrieval date, VTD contract, 9,038 / 9,178 mapped units, 125,172 off-map ballots, denominator limits, official source, and methodology.
- Did not mistake polished precision for fully mapped precision.
- **Trust:** Conditional rather than withheld. Arithmetic and evidence chain are inspectable; redistribution review remains an external release-governance question.
- **Severity remaining:** P2 governance note, not a product-comprehension defect.

### D. GIS / Data Analyst

- **Tasks 1–5:** Complete without help.
- Correctly described Pennsylvania as 2020 Census VTD terrain linked to 2024 reporting units and Michigan as exact-cycle 2024 precinct reporting units.
- Correctly understood unmatched and residual ballots as retained in totals but absent from invented polygons.
- **Trust:** High within the disclosed contracts.
- **Severity remaining:** None.

### E. Campaign Strategist

- **Tasks 1–5:** Complete without help.
- Decision-useful answer: Pennsylvania remains 49,679 net Harris-minus-Trump margin votes short, while Contributors shows where the modeled 70,588-vote improvement came from.
- Correctly treated the route as a construction target, not a forecast.
- **Trust:** High for scenario briefing; still requested export as a future convenience, not a blocker.
- **Severity remaining:** None in authorized scope.

### F. Software Power User

- **Tasks 1–5:** Complete without help.
- Copied and reopened the deterministic scenario URL and observed identical assumptions and state threshold.
- Understood the URL as the saved object without looking for an account or Save button.
- **Trust:** High.
- **Severity remaining:** None.

### G. Cautious Novice

- **Task 1:** Complete. `Change Pennsylvania` and `Open controls` supplied the missing operating grammar.
- **Task 2:** Complete. The adjacent sentence made the two-vote margin effect explicit.
- **Task 3:** Complete. Read `Still needed 49,679` from the state fact without route construction.
- **Task 4:** Complete with no coaching. The novice no longer interpreted Required as likely-to-win or Modeled as already won.
- **Task 5:** Complete. `Copy scenario link` explained why no traditional Save account was required.
- **Wrong turns:** Opened Data once before Contributors; recovered immediately.
- **Trust:** Moderate and appropriately bounded by the disclaimers.
- **Severity remaining:** None.

### H. Adversarial Auditor

- **Tasks 1–5:** Complete without help.
- Verified one canonical threshold value in both state and route contexts.
- Verified PA/MI evidence ledgers resolve distinct contracts and national coverage does not claim unsupported local geography.
- Verified the transfer explanation appears only for direct two-party preference operations.
- **Trust:** Conditional approval. The visible evidence chain is now audit-ready enough for alpha; redistribution inventory still governs delivery.
- **Severity remaining:** P2 release-governance item only.

## Task outcome comparison

| Persona | v0.19A outcome | v0.19.1 outcome |
|---|---|---|
| Casual Skimmer | State change only; later tasks required help | All five complete |
| Election Nerd | All complete | All complete, faster interpretation |
| Skeptical Journalist | Complete; citation trust withheld | Complete; visible evidence trail |
| GIS / Data Analyst | Complete with geography caveats | Complete with explicit state contracts |
| Campaign Strategist | All complete | All complete; same decision-useful insight |
| Software Power User | All complete | All complete; URL save model explicit |
| Cautious Novice | Multiple failures and major help | All five complete without coaching |
| Adversarial Auditor | Complete; evidence trust withheld | Complete; conditional alpha approval |

## Correction verification

### First action

The collapsed drawer now exposes `Change Pennsylvania`, the three operation families, and `Open controls`. All eight personas entered the Behavior panel without interpreting Collapsed, Working, or Expanded first.

### Threshold independence

At +1.0 D preference, the state fact displays:

- Certified requirement: 120,267
- Current modeled movement: +70,588 D
- Still needed: 49,679

The same 49,679 value appears after selecting a route because both contexts consume `buildStateFlipRequirement`.

### Terminology

Required is described as needed statewide movement and explicitly not a forecast. Modeled means a detailed PA/MI recipe is active. Satisfied means that recipe changes the state's electoral winner. Unsupported states are identified as mathematical-only and non-geographic.

### Transfer arithmetic

Preference mode explicitly connects 35,294 transferred ballots to 70,588 votes of Harris-minus-Trump margin movement and states the two-vote reason. Turnout and third-party modes do not receive this explanation.

### Evidence and geography

Pennsylvania and Michigan have separate source, geometry, coverage, treatment, and denominator ledgers. National Data distinguishes certified arithmetic from supported detailed geography. PA uses VTD language; MI uses 2024 precinct reporting-unit language.

### Scenario sharing

`Copy scenario link` confirms that the URL reconstructs current assumptions. The browser regression reopens the copied URL and verifies the same 49,679-vote state requirement.

## Remaining gates

No P0 or P1 model or local workflow defect remains in this rerun. Two external gates remain before v0.19B:

1. GitHub Pages deployment and the remote Home → `/app/` → PA → scenario → copy → reopen smoke journey must pass.
2. The PA and MI official-result redistribution rows in `docs/data/REDISTRIBUTION_INVENTORY.md` require a documented delivery decision for the intended human-alpha method.

## Verdict

v0.19.1 resolves the specific comprehension failures predicted by v0.19A without adding features or changing the election model. The strongest improvement is not visual polish; it is that a novice can now begin a model, distinguish transfer from margin, identify the live state threshold, and explain why a route is or is not satisfied using the product's own language.

This synthetic rerun supports moving to the deployment and human-alpha gates. It does not replace v0.19B.
