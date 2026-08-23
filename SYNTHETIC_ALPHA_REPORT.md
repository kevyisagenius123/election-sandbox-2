# Sandbox 2.0 v0.19A Synthetic Private Alpha

**Date:** 2026-08-12  
**Build evaluated:** v0.18.2, commit `2a5e44a`  
**Evaluation type:** Synthetic usability and comprehension evaluation  
**Human participants:** None

## Executive verdict

Sandbox 2.0 already supports a complete expert workflow from an explicit state assumption to geographic contribution, national consequence, route construction, and reproducible URL. The analytical foundation is real. The main v0.19A problem is not capability; it is that the interface expects users to discover its operating grammar before it teaches them that grammar.

The strongest product moment is the causal chain:

```text
+2.5 points Democratic preference
  -> 88.2K ballots transferred
  -> +176.5K Harris-minus-Trump margin
  -> Pennsylvania D+0.8
  -> Harris +19 EV
```

The weakest moment is entry into that chain. A new user reaches Pennsylvania and sees a collapsed drawer with `collapsed`, `working`, and `expanded`, but no direct action named “Change Pennsylvania.” The user must infer that `working` reveals the actual model.

No P0 model-integrity defect was found. Six repeated P1 findings block a responsible human alpha:

1. The public GitHub Pages URL returned GitHub's “Site not found” page during evaluation.
2. The exact stop-short requirement is unavailable in an ordinary state scenario and appears only after first selecting a construction route.
3. The public Data surface does not expose enough provenance, coverage, residual-ballot, and geography evidence for a journalist or auditor to cite the result.
4. `Required`, `Modeled`, `Satisfied`, ballot transfer, and margin movement are locally accurate but not taught at the moments where a novice first encounters them.
5. The first model action is hidden behind workspace-state language such as `working`.
6. A generic `Precincts` label obscures the different Pennsylvania and Michigan geography contracts.

These findings justify a bounded correction release. They do not justify new states, new model operations, or a redesign.

## Method and limitations

Each persona received the same five tasks and only the visible application. The campaign strategist and adversarial auditor received the authorized additional tasks. Walkthrough decisions were based on visible labels, hierarchy, state changes, and feedback from the rendered application. Source code and project documentation were not used to rescue a task.

The deployed URL was checked first:

```text
https://electaris.github.io/election-sandbox-2/app/
```

It returned GitHub Pages' “Site not found” page. The cognitive walkthroughs therefore used the identical v0.18.2 application through the local build at `http://127.0.0.1:4173/app/`. Public availability is reported as a separate infrastructure finding and was not misclassified as persona confusion.

This is not evidence from eight humans. Synthetic personas do not reproduce real hesitation, attention loss, motor errors, emotional response, or trust formation. Counts below describe eight structured cognitive walkthroughs, not statistical user research.

## Common tasks

1. Make Harris win Pennsylvania and identify the geographic areas contributing most.
2. Improve Harris in Pennsylvania without winning and determine the exact additional movement required.
3. Find the Path to 270 requiring the fewest net margin votes and begin constructing it with a supported detailed state.
4. Copy, leave, reopen, and verify a scenario.
5. Explain why the Electoral College differs from the certified result, including responsible states and assumptions.

## Outcome summary

| Persona | Task 1 | Task 2 | Task 3 | Task 4 | Task 5 |
|---|---|---|---|---|---|
| A. Casual Skimmer | Completed | Failed | Completed with minor help | Completed with minor help | Partially correct |
| B. Election Nerd | Completed | Completed | Completed | Completed | Completed |
| C. Skeptical Journalist | Completed | Completed | Completed | Completed | Completed, citation trust withheld |
| D. GIS/Data Analyst | Completed | Completed | Completed | Completed | Completed, geography caveats |
| E. Campaign Strategist | Completed | Completed | Completed | Completed | Completed |
| F. Software Power User | Completed | Completed | Completed | Completed | Completed |
| G. Cautious Novice | Completed incorrectly | Failed | Failed | Completed with major help | Partially correct |
| H. Adversarial Auditor | Completed | Completed | Completed | Completed | Completed, trust withheld |

Observed patterns:

- 7/8 could produce some form of Pennsylvania scenario.
- 6/8 could independently explain why transferred ballots create twice as much two-candidate margin movement.
- 6/8 could obtain the exact stop-short gap after finding route construction; the two low-domain personas could not.
- 6/8 could distinguish a mathematical route state from a geographically supported state without outside explanation.
- 6/8 independently found Contributors.
- 7/8 understood Actual versus Scenario; the cautious novice treated Scenario as a projection at first.
- 6/8 could explain `Modeled` versus `Satisfied` precisely on first exposure.
- 0/8 could complete the workflow through the intended public URL while the Pages site was unavailable.

## Persona A: Casual Skimmer

**Profile:** Follows presidential elections casually, has low patience, and rarely reads methodology.

### Task 1: Flip Pennsylvania

**TASK:** Completed  
**FIRST ACTION:** Selected Pennsylvania from the national context rail.  
**WRONG TURNS:** Looked at `Scenario` and `Shift` as if one of them might initiate a change; clicked a county before finding an editor.  
**CONFUSION:** `working` looked like a display state, not the way to expose controls. `Preference` was less immediately legible than “move voters.”  
**FINAL INTERPRETATION:** A +2.5 point Democratic preference change flipped Pennsylvania to D+0.8. Allegheny, Bucks, Montgomery, Lancaster, and York were the largest displayed county contributions.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** The immediate map and Electoral College update increased trust. “9,038 / 9,178 mapped precincts” raised an unanswered coverage question.  
**SEVERITY:** P1 discoverability

### Task 2: Stop short

**TASK:** Failed  
**FIRST ACTION:** Reduced the preference slider until Pennsylvania remained Republican.  
**WRONG TURNS:** Treated the displayed R+0.7 as the requested exact additional movement.  
**CONFUSION:** The state editor showed modeled movement but not the exact remaining net-margin-vote requirement.  
**FINAL INTERPRETATION:** “Harris is 0.7 points short,” without identifying the exact 49,679-vote route gap.  
**FACTUALLY CORRECT:** Partially  
**HELP NEEDED:** Major  
**TRUST:** Reduced because the task felt answerable from the state screen but required an unrelated route workflow.  
**SEVERITY:** P1

### Task 3: Path to 270

**TASK:** Completed with minor help  
**FIRST ACTION:** Opened `Compare alternative routes`.  
**WRONG TURNS:** Initially read “Fewest states” as the requested cheapest route rather than changing the metric to `Net margin votes`.  
**CONFUSION:** “Fewest net margin votes” and “fewest states” competed visually.  
**FINAL INTERPRETATION:** PA + MI + WI required the fewest displayed net margin votes; Pennsylvania or Michigan could be opened because those states have detailed laboratories.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** The exact per-state arithmetic increased trust.  
**SEVERITY:** P2

### Task 4: Save and restore

**TASK:** Completed with minor help  
**FIRST ACTION:** Clicked `Copy link`.  
**WRONG TURNS:** Expected a save confirmation dialog rather than the small `Copied` label.  
**CONFUSION:** “Leave the application” was not represented by an in-product action; restoration depended on understanding that the URL is the save object.  
**FINAL INTERPRETATION:** The URL restored Pennsylvania R+0.7 and the +1.0 point Democratic preference recipe.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** The visible compatible-recipe restoration notice increased confidence.  
**SEVERITY:** P2

### Task 5: Explain the election

**TASK:** Partially correct  
**FIRST ACTION:** Read the Electoral College card.  
**WRONG TURNS:** Described Pennsylvania as “predicted for Harris” rather than explicitly counterfactual.  
**CONFUSION:** `Modeled` sounded predictive.  
**FINAL INTERPRETATION:** Harris gained 19 EV because Pennsylvania changed after a Democratic shift.  
**FACTUALLY CORRECT:** Partially  
**HELP NEEDED:** Minor  
**TRUST:** Causal wording helped; predictive connotations reduced precision.  
**SEVERITY:** P1 terminology

**Overall:** Would use again for exploration; might share a dramatic flip; would not cite it. Biggest obstacle: discovering how to begin editing.

## Persona B: Election Nerd

**Profile:** Understands margins, precincts, Electoral College arithmetic, and battleground-state analysis.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Opened Pennsylvania, expanded the working drawer, and chose Preference.  
**WRONG TURNS:** None material.  
**CONFUSION:** Wanted a direct threshold marker on the preference slider.  
**FINAL INTERPRETATION:** +2.5 D transferred 88.2K ballots, created +176.5K D margin, flipped PA to D+0.8, and added 19 Harris EV.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Exact reconciliation between slider, state margin, contributors, and EV increased trust.  
**SEVERITY:** P2 enhancement

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Selected the net-margin route, opened Pennsylvania, and set preference to +1.0 D.  
**WRONG TURNS:** First tried to derive the remaining gap manually from the state margin.  
**CONFUSION:** Route construction was required to reveal an otherwise useful state-level number.  
**FINAL INTERPRETATION:** Pennsylvania was Modeled but still Required, with 70,588 net margin votes modeled and 49,679 remaining.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Exact integer gap and winner-change condition increased trust.  
**SEVERITY:** P1 information placement

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Changed ranking to `Net margin votes`.  
**WRONG TURNS:** None.  
**CONFUSION:** The route list re-ranked after an active PA recipe, which was correct but could surprise someone comparing to the certified baseline.  
**FINAL INTERPRETATION:** At baseline PA + MI + WI required 229,769 net margin votes; the route is mathematical, with PA and MI detailed and WI unsupported.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Dynamic recalculation from the current portfolio was a strong feature.  
**SEVERITY:** P3

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied the scenario URL.  
**WRONG TURNS:** None.  
**CONFUSION:** None material.  
**FINAL INTERPRETATION:** The deterministic recipe, state selection, target, route metric, and selected route reconstructed correctly.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Strongly increased.  
**SEVERITY:** P3

### Task 5

**TASK:** Completed  
**FIRST ACTION:** Used the changed-state consequence ledger.  
**WRONG TURNS:** None.  
**CONFUSION:** Wanted a one-click “explain this scenario” summary containing the ordered assumptions.  
**FINAL INTERPRETATION:** PA changed because of the active preference recipe; the ledger correctly separated its margin change and +19 EV consequence.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High for deterministic arithmetic, conditional on source documentation.  
**SEVERITY:** P2

**Overall:** Would use and share it; would cite model outputs only alongside methodology. Biggest obstacle: threshold and requirement information is distributed across surfaces.

## Persona C: Skeptical Journalist

**Profile:** Wants to know what every number means and where it came from.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Looked for sources before changing the model, then opened PA.  
**WRONG TURNS:** Expected the Data tab to contain source links and detailed coverage.  
**CONFUSION:** The interface says “Verified county returns,” but the visible Data tab only states what the model does not claim.  
**FINAL INTERPRETATION:** The displayed counterfactual is internally coherent, and contributors describe where a statewide transfer operation had the greatest vote effect.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Arithmetic helped; absent in-product citations prevented publication-level confidence.  
**SEVERITY:** P1 trust

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Created a non-flipping PA recipe.  
**WRONG TURNS:** Searched the ordinary state card for an exact remaining-vote statement before discovering it was route-specific.  
**CONFUSION:** Why should a state threshold depend on selecting a national route if the arithmetic is already available?  
**FINAL INTERPRETATION:** +70,588 margin was modeled; 49,679 additional net Harris margin votes remained.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Exact arithmetic increased trust; hidden placement reduced usability.  
**SEVERITY:** P1

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Opened routes and selected net margin votes.  
**WRONG TURNS:** None material.  
**CONFUSION:** Needed stronger visible distinction between a route row backed by statewide arithmetic and a state backed by reporting-unit modeling.  
**FINAL INTERPRETATION:** Route membership is mathematical; only PA and MI currently offer local construction evidence.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** The explicit disclosure about Required states helped.  
**SEVERITY:** P2

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied and reopened the URL.  
**WRONG TURNS:** None.  
**CONFUSION:** Wanted a printable scenario ID or timestamp in addition to a URL.  
**FINAL INTERPRETATION:** The deterministic scenario restored exactly.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Compatibility notice and visible recipe restoration increased trust.  
**SEVERITY:** P3

### Task 5

**TASK:** Completed, citation trust withheld  
**FIRST ACTION:** Read the consequence ledger and Assumptions.  
**WRONG TURNS:** None material.  
**CONFUSION:** Source provenance, residual ballots, update dates, and geography match rates were not assembled into a citable view.  
**FINAL INTERPRETATION:** Correctly attributed the EV change to PA and its explicit preference operation, while treating the result as a counterfactual rather than a forecast.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Enough to demonstrate, not enough to cite without leaving the app.  
**SEVERITY:** P1

**Overall:** Would use it as an explanatory tool and share scenarios internally; would not cite it publicly yet. Biggest obstacle: provenance is documented in the repository but not surfaced as an evidence product.

## Persona D: GIS/Data Analyst

**Profile:** Understands geographic joins, reporting units, residual buckets, and coverage.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Opened PA and inspected mapping coverage before mutating.  
**WRONG TURNS:** Interpreted `Precincts` as exact-cycle election precinct polygons until reading the 9,038 / 9,178 mapping language.  
**CONFUSION:** PA uses 2020 Census VTD terrain linked to 2024 result units, while MI uses exact-cycle precinct terrain; the common UI label obscures that distinction.  
**FINAL INTERPRETATION:** Contributors are exact modeled-unit aggregations subject to disclosed unmatched and residual geography.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Coverage counts increased trust; insufficient Data-tab detail reduced it.  
**SEVERITY:** P1 geography terminology

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Used route construction to obtain an exact state threshold.  
**WRONG TURNS:** None.  
**CONFUSION:** The requirement is a statewide arithmetic fact and should not be gated by route selection.  
**FINAL INTERPRETATION:** PA was modeled short by 49,679 net Harris margin votes.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Exact integer reconciliation increased trust.  
**SEVERITY:** P1

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Selected net margin votes and inspected which rows were buttons.  
**WRONG TURNS:** Used interactivity itself as a proxy for detailed support.  
**CONFUSION:** Support status should be an explicit text field, not inferred from whether a row is clickable.  
**FINAL INTERPRETATION:** PA/MI have detailed foundations; WI in the cheapest route is statewide arithmetic only.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Fail-closed unsupported geography was positive.  
**SEVERITY:** P2

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied and reopened the versioned recipe.  
**WRONG TURNS:** None.  
**CONFUSION:** None material.  
**FINAL INTERPRETATION:** The application reconstructed derived geography instead of serializing result totals.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Strongly increased.  
**SEVERITY:** P3

### Task 5

**TASK:** Completed with geography caveats  
**FIRST ACTION:** Used the consequence ledger and local contribution trace.  
**WRONG TURNS:** None.  
**CONFUSION:** National Data did not enumerate detailed versus statewide-only coverage, off-map residuals, and geometry years.  
**FINAL INTERPRETATION:** Correct causal explanation with explicit limits on spatial interpretation.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Internally high; external review requires a coverage ledger.  
**SEVERITY:** P1

**Overall:** Would use it and share reproducible URLs; would cite only after a national coverage/provenance ledger is visible. Biggest obstacle: one generic “precinct” vocabulary spans materially different geography contracts.

## Persona E: Campaign Strategist

**Profile:** Thinks in paths, vote margins, counties, and operational scenarios.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Opened PA Preference and moved directly past the winner threshold.  
**WRONG TURNS:** None.  
**CONFUSION:** Wanted a “minimum to flip” action instead of trial movement.  
**FINAL INTERPRETATION:** +2.5 D flipped PA and showed the counties contributing most to statewide net margin.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Strong because statewide and local contribution totals reconciled.  
**SEVERITY:** P2

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Selected a route, then reduced PA to +1.0 D.  
**WRONG TURNS:** First expected the state editor to show votes to flip.  
**CONFUSION:** The key strategic number was hidden until a route was selected.  
**FINAL INTERPRETATION:** PA had moved +70,588 but still required 49,679 net margin votes.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High.  
**SEVERITY:** P1

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Chose `Net margin votes`.  
**WRONG TURNS:** None.  
**CONFUSION:** “Cheapest” can mean raw votes, points, states, money, or plausibility; the UI correctly offers three arithmetic metrics but no political plausibility claim.  
**FINAL INTERPRETATION:** Baseline cheapest displayed route was PA + MI + WI at 229,769 net margin votes. PA and MI could be geographically constructed; WI could not.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High for arithmetic, not interpreted as campaign cost.  
**SEVERITY:** P2 language

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied the URL after constructing the route.  
**WRONG TURNS:** None.  
**CONFUSION:** Wanted a scenario name and notes for briefing workflows.  
**FINAL INTERPRETATION:** State assumptions and route strategy restored.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High.  
**SEVERITY:** P2 future workflow

### Task 5

**TASK:** Completed  
**FIRST ACTION:** Read the active-state EV ledger, then the assumption ledger and Contributors.  
**WRONG TURNS:** None.  
**CONFUSION:** No single export combined the briefing.  
**FINAL INTERPRETATION:** Correctly named the active state recipe, statewide movement, local drivers, and EV change.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High enough to show internally with methodology caveats.  
**SEVERITY:** P2

### Campaign-specific tasks

- **Cheapest displayed route:** PA + MI + WI at baseline, 229,769 net margin votes.
- **Greatest supported modeled movement:** Pennsylvania when its +1.0 D recipe produced +70,588 net margin movement; the active-state ledger made this visible nationally.
- **Value beyond a normal electoral map:** It distinguishes ballots transferred from two-candidate margin movement, attributes that movement to counties and reporting units, and shows the exact remaining verified gap between a modeled state and route satisfaction.

**Overall:** Would use and share it for scenario briefings; would not treat it as a persuasion-cost or voter-targeting model. Biggest obstacle: the product's most useful strategic number is conditional on discovering route construction.

## Persona F: Software Power User

**Profile:** Explores aggressively and expects persistence, undo, share, and consistent navigation.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Opened PA and tested drawer states and model tabs.  
**WRONG TURNS:** None material.  
**CONFUSION:** Drawer snap labels describe implementation states rather than user intent.  
**FINAL INTERPRETATION:** Correct flip and contribution explanation.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Fast deterministic updates increased confidence.  
**SEVERITY:** P2

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Selected a route and observed the live remaining gap while adjusting PA.  
**WRONG TURNS:** None.  
**CONFUSION:** The same threshold should be reusable outside route mode.  
**FINAL INTERPRETATION:** Correct 49,679 remaining at +1.0 D.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High.  
**SEVERITY:** P1

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Used the metric control and selected a detailed state.  
**WRONG TURNS:** None.  
**CONFUSION:** Closing alternatives hides route comparison but retains construction, which is correct yet not immediately obvious.  
**FINAL INTERPRETATION:** Correct route selection and state handoff.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High.  
**SEVERITY:** P3

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied, navigated Home, reopened, reloaded, and used browser history.  
**WRONG TURNS:** Expected an Undo command for individual model changes.  
**CONFUSION:** Reset is clear, but undo/redo and named snapshots do not exist.  
**FINAL INTERPRETATION:** URL persistence is reliable; presentation state correctly does not alter the recipe.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Very high.  
**SEVERITY:** P2 future capability

### Task 5

**TASK:** Completed  
**FIRST ACTION:** Cross-checked URL recipe, ledger, map, and state controls.  
**WRONG TURNS:** None.  
**CONFUSION:** The app lacks a consolidated machine-readable or printable scenario summary.  
**FINAL INTERPRETATION:** Correct and reproducible causal explanation.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High.  
**SEVERITY:** P2

**Overall:** Would use and share it. Biggest obstacle: limited scenario-management ergonomics rather than model comprehension.

## Persona G: Cautious Novice

**Profile:** Interested in politics but uncomfortable with election-model terminology.

### Task 1

**TASK:** Completed incorrectly  
**FIRST ACTION:** Opened PA and used Turnout because “participation” sounded like adding Harris voters.  
**WRONG TURNS:** Assumed the default 55% Harris share described real new voters; did not initially understand it was an explicit counterfactual composition.  
**CONFUSION:** VAP, capped units, preference transfer, and third-party source share.  
**FINAL INTERPRETATION:** Harris won because “turnout increased,” without explaining the assumed partisan composition or whether the required increase was plausible.  
**FACTUALLY CORRECT:** No  
**HELP NEEDED:** Major  
**TRUST:** Polished precision created more confidence than comprehension justified.  
**SEVERITY:** P1

### Task 2

**TASK:** Failed  
**FIRST ACTION:** Moved a slider until PA remained red.  
**WRONG TURNS:** Reported the displayed margin as votes remaining.  
**CONFUSION:** Points, ballots, net margin votes, Required, and Modeled were treated as interchangeable.  
**FINAL INTERPRETATION:** “Harris still needs 0.7,” with no unit or exact route gap.  
**FACTUALLY CORRECT:** No  
**HELP NEEDED:** Major  
**TRUST:** Reduced after encountering multiple numbers that looked like different answers.  
**SEVERITY:** P1

### Task 3

**TASK:** Failed  
**FIRST ACTION:** Read “44 EV needed” and expected the app to choose the route automatically.  
**WRONG TURNS:** Treated the first Fewest States route as also the fewest-vote route.  
**CONFUSION:** Net margin votes and mathematical path.  
**FINAL INTERPRETATION:** A route is a prediction of which states Harris is most likely to win.  
**FACTUALLY CORRECT:** No  
**HELP NEEDED:** Major  
**TRUST:** Dangerously overconfident interpretation unless corrected.  
**SEVERITY:** P1

### Task 4

**TASK:** Completed with major help  
**FIRST ACTION:** Looked for a `Save` button rather than `Copy link`.  
**WRONG TURNS:** Returned Home and expected an account-based saved scenario list.  
**CONFUSION:** The URL itself is the saved object.  
**FINAL INTERPRETATION:** Reopening the copied address restored the changes.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Major  
**TRUST:** Restoration increased trust after the concept was explained.  
**SEVERITY:** P2

### Task 5

**TASK:** Partially correct  
**FIRST ACTION:** Compared the two large EV numbers.  
**WRONG TURNS:** Called Scenario a forecast and Modeled a projected winner.  
**CONFUSION:** Actual versus Scenario and Modeled versus Satisfied.  
**FINAL INTERPRETATION:** Correctly noticed PA caused an EV change but misunderstood the epistemic status.  
**FACTUALLY CORRECT:** Partially  
**HELP NEEDED:** Major  
**TRUST:** Presentation authority exceeded actual comprehension.  
**SEVERITY:** P1

**Overall:** Would probably explore again but should not share or cite without stronger teaching. Biggest obstacle: the UI names expert concepts but does not supply a novice mental model.

## Persona H: Adversarial Auditor

**Profile:** Assumes the simulator may overstate what its data can prove and actively searches for contradictions.

### Task 1

**TASK:** Completed  
**FIRST ACTION:** Inspected Data, coverage language, and geography labels before applying a scenario.  
**WRONG TURNS:** None; deliberately challenged each claim.  
**CONFUSION:** `Verified county returns`, `mapped precincts`, and common PA/MI `Precincts` labels compress different evidence contracts.  
**FINAL INTERPRETATION:** The arithmetic is deterministic, but the terrain has state-specific coverage and residual limitations that require more prominent disclosure.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Internal consistency helped; sparse visible provenance reduced confidence.  
**SEVERITY:** P1

### Task 2

**TASK:** Completed  
**FIRST ACTION:** Selected a route specifically to reveal the certified requirement.  
**WRONG TURNS:** None.  
**CONFUSION:** A certified statewide threshold was presented as route context rather than a general state fact.  
**FINAL INTERPRETATION:** Modeled movement can be nonzero while the state remains Required; Satisfied requires a verified winner change.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Exact requirement language and reversible winner condition increased trust.  
**SEVERITY:** P1 placement

### Task 3

**TASK:** Completed  
**FIRST ACTION:** Compared all ranking metrics and inspected unsupported rows.  
**WRONG TURNS:** None.  
**CONFUSION:** “Closest” can sound probabilistic, while the engine is only ranking deterministic arithmetic.  
**FINAL INTERPRETATION:** Path rows are statewide mathematical requirements; appearing in a route does not imply precinct modeling or plausibility.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** Required disclosure was good but should be nearer every unsupported row.  
**SEVERITY:** P1 terminology

### Task 4

**TASK:** Completed  
**FIRST ACTION:** Copied the URL, inspected its readable recipe, and reloaded.  
**WRONG TURNS:** None.  
**CONFUSION:** Public hosted restoration could not be tested because Pages was unavailable.  
**FINAL INTERPRETATION:** Local deterministic reconstruction passed; external availability remained unverified.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** None  
**TRUST:** High in URL determinism; none in deployment readiness.  
**SEVERITY:** P1 infrastructure

### Task 5

**TASK:** Completed, trust withheld  
**FIRST ACTION:** Compared certified baseline, active recipes, EV ledger, assumptions, coverage, and residual claims.  
**WRONG TURNS:** None.  
**CONFUSION:** The public interface does not enumerate official sources, retrieval dates, checksums, geometry vintage, residual placement, and detailed-state support in one audit surface.  
**FINAL INTERPRETATION:** Correct causal explanation with appropriate counterfactual limits, but insufficient visible evidence to independently audit the data chain.  
**FACTUALLY CORRECT:** Yes  
**HELP NEEDED:** Minor  
**TRUST:** Would not cite or endorse until provenance and coverage are visible in-product.  
**SEVERITY:** P1

### Adversarial inspection findings

- PA and MI are visibly selectable as detailed states, but a national data-coverage table would make the distinction from unsupported states much harder to misunderstand.
- PA `Precincts` are Census VTD terrain linked to election reporting units; MI uses exact-cycle precinct terrain. A shared generic label is too broad.
- Non-geographic and residual ballots are correctly preserved in the engine, but their presence is not obvious from the national Data tab.
- `2020 voting-age population` is disclosed and correctly distinguished from CVAP or 2024 eligibility, but the limitation appears after entering the drawer.
- Route requirements are arithmetic, not forecasts. “Closest mathematical routes” helps, while “Closest” alone still carries plausibility connotations.
- Certified baseline language is strong, but the Data tab does not provide the supporting source trail.

**Overall:** Would continue auditing and might show the interface as a prototype; would not publicly cite it yet. Biggest obstacle: evidence exists in the repository but is not packaged for independent scrutiny inside the product.

## Comprehension matrix

| Question | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| What does Required mean? | Partial | Correct | Correct | Correct | Correct | Correct | Incorrect | Correct |
| Can a state be Modeled without being Satisfied? | Incorrect | Correct | Correct | Correct | Correct | Correct | Incorrect | Correct |
| Why does 50K transferred create 100K margin movement? | Incorrect | Correct | Correct | Correct | Correct | Correct | Incorrect | Correct |
| Does Path appearance imply geographic modeling? | Incorrect | Correct | Correct | Correct | Correct | Correct | Incorrect | Correct |
| Actual versus Scenario | Correct | Correct | Correct | Correct | Correct | Correct after help | Incorrect initially | Correct |

### In their own words

**Required**

- Correct interpretation: the smallest remaining statewide target-minus-opponent margin improvement needed for the target to move past a tie; it is arithmetic, not a forecast or a local vote allocation.
- Recurring incorrect interpretation: a state Sandbox predicts the candidate will need or win.

**Modeled without Satisfied**

- Correct interpretation: a verified PA/MI recipe has changed votes, but the changed statewide result has not crossed the winner threshold.
- Recurring incorrect interpretation: Modeled means the simulator has projected that candidate as the winner.

**Transferred ballots versus margin movement**

- Correct interpretation: moving one ballot from Trump to Harris subtracts one from Trump and adds one to Harris, changing `Harris - Trump` by two.
- Recurring incorrect interpretation: 50,000 transferred ballots should equal 50,000 displayed movement.

**Mathematical versus geographic routes**

- Correct interpretation: all listed route states have statewide arithmetic; only supported detailed states offer reporting-unit construction.
- Recurring incorrect interpretation: every listed state has a hidden county model or represents a likelihood forecast.

**Actual versus Scenario**

- Correct interpretation: Actual is the certified 2024 result; Scenario is the deterministic result produced by the user's explicit counterfactual assumptions.
- Recurring incorrect interpretation: Scenario is a prediction, probability, or estimate of what would have happened.

## Severity-ranked findings

### P0

None found. No observed path produced a contradiction in certified baseline, vote conservation, Electoral College allocation, recipe restoration, or route-satisfaction logic.

### P1: Must correct before human alpha

#### P1-1 Public alpha URL unavailable

The intended GitHub Pages URL returned “Site not found.” Human testing cannot begin until the public Home and `/app/` entry are reachable and shared URLs restore there.

**Recommended correction:** Complete Pages environment activation, verify the deployment workflow, and run a remote smoke journey against Home, `/app/`, and one copied scenario URL.

#### P1-2 The first model action is hidden behind workspace-state language

`collapsed`, `working`, and `expanded` are clear to the implementation but weak as a first-run invitation. The Casual Skimmer and Cautious Novice did not naturally treat `working` as “open the model.”

**Recommended correction:** Keep the three-state architecture, but add a prominent collapsed-drawer action such as `Change Pennsylvania` or rename the visible working action to `Open controls`. Preserve accessible snap-state language underneath.

#### P1-3 Exact state requirement is route-gated

Task 2 can only be answered exactly after selecting a national route. At +1.0 D, the ordinary PA view shows R+0.7 and +70.6K D movement, but the exact 49,679-vote remaining gap appears only in route construction.

**Recommended correction:** Add a compact state threshold line independent of selected route:

```text
49,679 additional net Harris margin votes to flip Pennsylvania
```

When a selected route contains the state, the same number can continue to feed Required/Modeled/Satisfied status.

#### P1-4 Terminology is accurate but not earned

The novice and skimmer confused:

- Modeled with predicted;
- Required with forecasted;
- points with votes;
- transferred ballots with margin movement;
- route membership with detailed geographic support.

**Recommended correction:** Add compact first-use definitions adjacent to the relevant number, not a generic tutorial. Use direct language:

```text
MODELED: a detailed state recipe is active
SATISFIED: that verified recipe changes the state winner
REQUIRED: statewide arithmetic still needed; no forecast implied
```

Show the transfer arithmetic inline once:

```text
35.3K ballots transferred -> 70.6K two-candidate margin movement
```

#### P1-5 Data and provenance surface is not citation-ready

The Data tab currently gives a valuable denominator disclaimer but not a public audit trail. Journalist, GIS, and auditor personas wanted official sources, dates, geometry vintage, match coverage, residual placement, and detailed-state limitations.

**Recommended correction:** Turn Data into a compact evidence ledger sourced from existing registries. Do not add new data. Include:

- official election-result source and retrieval date;
- Census source and vintage;
- PA VTD versus MI precinct geometry contract;
- mapped/unmatched unit and vote coverage;
- non-geographic/residual ballot treatment;
- checksum or artifact version;
- which states are detailed and which are statewide arithmetic only;
- methodology links.

#### P1-6 “Precinct” obscures different state geography contracts

PA and MI do not use identical local geometry. Calling both simply Precincts can overstate equivalence.

**Recommended correction:** Use the manifest-owned geography label in visible controls and coverage:

```text
Pennsylvania: Census voting districts (VTDs)
Michigan: 2024 precinct reporting units
```

The contribution rank can retain a short label if its state-specific meaning is shown nearby.

### P2: Valuable after alpha blockers

- Add a visible threshold marker or “minimum to flip” reference without automatically mutating the scenario.
- Make `Copy link` say `Copy scenario link`, with a slightly stronger confirmation.
- Provide a compact explain/export summary combining assumptions, changed states, contributors, and EV consequence.
- Explicitly label detailed support on route rows instead of relying on button interactivity.
- Replace or supplement `working` with intent-oriented wording while preserving the snap contract.
- Consider named local snapshots and undo/redo only after human evidence confirms demand.

### P3: Polish or future workflow

- Preserve current deterministic URL reconstruction and compatibility notice.
- Preserve bounded drawer, route metric switching, and reversible satisfaction behavior.
- Consider scenario names and briefing notes for professional workflows later.
- Explain that route ranking recalculates from the current portfolio, not always the certified baseline.

## What tested especially well

1. **Causal reconciliation:** The same operation is expressed as transferred ballots, margin movement, state result, geographic contribution, and EV consequence without contradiction.
2. **Reversible route construction:** A state can visibly move from Required to Modeled to Satisfied and back as the verified scenario crosses the winner threshold.
3. **Contributors:** County and reporting-unit rankings make the 3D map analytically necessary rather than decorative.
4. **Scenario URLs:** Recipes reconstruct deterministically and visibly announce compatibility.
5. **Honest unsupported states:** Route arithmetic does not fabricate local controls for Wisconsin, Georgia, Alaska, or other unsupported states.
6. **Actual versus Scenario presentation:** Most personas understood the paired result once they had made a change.
7. **One consistent Laboratory:** Returning from a state to the United States preserves analytical context rather than dumping the user onto the editorial Home.

## Recommended v0.19A correction scope

Implement only the following before human alpha:

1. Restore and verify public deployment.
2. Add an intent-oriented collapsed-drawer entry action.
3. Expose an exact state flip threshold without requiring route selection.
4. Add just-in-time definitions for Required, Modeled, Satisfied, and transfer-versus-margin arithmetic.
5. Expand Data into a registry-backed provenance and coverage ledger.
6. Use state-specific VTD/precinct geography labels.

Do not add:

- a third detailed state;
- forecast probabilities;
- random uncertainty;
- new demographic behavior;
- account storage;
- a guided-tour framework;
- a backend;
- a redesigned map or drawer.

After those corrections, rerun the same eight synthetic walkthroughs. Then begin v0.19B with three to five genuinely new humans and compare synthetic predictions with observed human behavior.

## Final assessment

Sandbox 2.0 has crossed the line from attractive visualization into a meaningful analytical product for expert and power users. The campaign strategist could answer a question a normal electoral map cannot: not merely which states form a path, but how much verified movement has already been constructed inside a supported state, which local geographies created it, and exactly what remains before the state contributes its EV.

The product is not yet novice-safe or citation-ready. Its precision can create misplaced confidence when the user has not understood what is an assumption, what is certified, what is only statewide arithmetic, and what is geographically modeled. v0.19A should therefore improve explanation and evidence, not expand simulation power.

The synthetic alpha predicts that experts will admire and use Sandbox, casual users will need a clearer first action, novices will overread model language, and evidence-focused users will withhold public trust until provenance becomes a first-class interface surface. Human alpha must now test whether those predictions are true.
