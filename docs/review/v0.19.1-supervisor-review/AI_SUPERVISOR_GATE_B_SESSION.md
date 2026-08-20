# AI supervisor Gate B session

## Session identity

**Candidate tag:** `v0.19.1-supervisor-review`
**Candidate commit:** `748d3ce0d73f91f0341853b5e1eb7ed6bc6c69fb`
**Review date:** 2026-08-20
**Reviewer role:** AI technical supervisor, explicitly designated by the owner
**Reviewer familiarity:** High. This was not a blind or genuinely unfamiliar-user session.
**Browser:** Playwright Chromium through the repository's locked browser dependencies
**Operating system:** Windows
**Viewport:** 1440 x 900 desktop
**Candidate URL:** `http://127.0.0.1:4175/` from a detached exact-tag worktree

## Scope and evidentiary status

This record is a formal technical-supervisor walkthrough of the exact frozen candidate. It is AI evidence, not human evidence, and it does not establish real-user patience, trust, discoverability, or comprehension. The owner authorized the AI reviewer to make the Gate B technical ruling with that limitation disclosed.

The installed in-app browser integration failed before navigation because its trusted RPC dependency could not resolve inside its configured path. The reviewer therefore used the candidate's locked Playwright and Chromium stack. That evaluator-infrastructure failure is not a Sandbox product finding.

## Preflight

- [x] Detached worktree commit equaled `748d3ce0d73f91f0341853b5e1eb7ed6bc6c69fb`.
- [x] The full private candidate was used, not the sanitized public demo.
- [x] The tagged candidate was not changed during the session.
- [x] Assertions were based on visible interface text and behavior.
- [x] Answers and screenshots were captured before this verdict was written.
- [ ] The reviewer was unfamiliar with the project. This condition was not met and is not claimed.

## Task 1: Create a Pennsylvania scenario

**Prompt:** Create a Pennsylvania scenario that improves Harris.
**First action:** Opened Pennsylvania, opened the controls, and selected Preference.
**Wrong turns:** None in the product.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** A Democratic preference transfer improves Harris's statewide margin while preserving the two-party ballot total. At `+1.0 pts D`, the scenario moved from certified `R+1.7` to `R+0.7`, so Harris improved without yet winning.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Finding:** None

## Task 2: Stop short and find the exact gap

**Prompt:** Keep Pennsylvania on the certified winner's side and identify the exact additional Harris-minus-Trump movement required to flip it.
**First action:** Read the live state-flip requirement beside the active controls.
**Wrong turns:** None. A Path to 270 route was not needed.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** Pennsylvania remained Republican at `R+0.7`. Harris needed another `49,679` net margin votes. The interface reconciled the `120,267` certified requirement against `+70,588 D` of modeled movement.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Finding:** None
**Evidence:** `ai-supervisor/01-pa-stop-short.png`

## Task 3: Flip Pennsylvania and find contributors

**Prompt:** Flip Pennsylvania and identify the largest counties and VTDs responsible for the change.
**First action:** Increased the Democratic preference transfer to `+2.5 pts D`, then opened Contributors.
**Wrong turns:** None.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** The scenario changed Pennsylvania to `D+0.8`, with `+176,468 D` modeled net-margin movement and no remaining statewide gap.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Largest counties:** Allegheny `+14.1K D`, Bucks `+9.9K D`, Montgomery `+9.9K D`, Lancaster `+8.3K D`, York `+7.7K D`.
**Largest VTDs:** POLK Voting District, Monroe `+146 D`; CARROLL Voting District, York `+142 D`; EAST MANCHESTER Voting District, York `+142 D`; NEWBERRY DISTRICT 01, York `+142 D`; ADAMS PRECINCT 03, Butler `+136 D`.
**Finding:** None
**Evidence:** `ai-supervisor/02-pa-flipped-contributors.png`

## Task 4: Construct a Path to 270

**Prompt:** Choose a route metric, select a route, and explain Required, Modeled, and Satisfied.
**First action:** Returned to the United States, opened alternative routes, and selected Net margin votes.
**Wrong turns:** None.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** Selected Michigan plus Wisconsin, a partially modeled route from `245` to `270` EV. Michigan required `80,104` net margin votes for `15 EV`; Wisconsin required `29,398` for `10 EV`; total requirement was `109,502` votes or `2.3` aggregate margin points.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Required means:** Statewide movement still needed to change allocation. It is arithmetic, not a forecast.
**Modeled means:** A detailed Pennsylvania or Michigan scenario recipe exists, but it may not yet change the winner.
**Satisfied means:** A verified detailed scenario changes the state's winner and supplies its electoral votes.
**Finding:** None
**Evidence:** `ai-supervisor/03-path-to-270.png`

## Task 5: Copy and restore the scenario

**Prompt:** Copy the scenario link, leave the current state, reopen the URL, and verify that assumptions and consequences return.
**First action:** Used Copy scenario link and opened the copied URL in a fresh page.
**Wrong turns:** None.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** One Pennsylvania recipe returned, the Michigan plus Wisconsin route returned with the same requirements, and the consequence returned as Harris gaining `19 EV` because Pennsylvania changed winner.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Restored assumptions:** Pennsylvania modeled recipe and selected route metric/blueprint.
**Restored consequence:** Pennsylvania `+19 Harris EV`; national scenario `245-293`.
**Finding:** None
**Evidence:** `ai-supervisor/04-restored-scenario.png`

## Task 6: Audit Pennsylvania and Michigan evidence

**Prompt:** Identify each state's result source, geometry contract, mapped coverage, off-map treatment, and denominator status.
**First action:** Opened each detailed state's Data tab.
**Wrong turns:** None.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** The interface exposes materially different and state-specific evidence contracts rather than calling both geographies generic precincts.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Pennsylvania:** Commonwealth of Pennsylvania Department of State, 2024 General Election Precinct Election Returns; 2020 Census VTD geometry linked to 2024 reporting units; `9,038 / 9,178` mapped; `6,933,560 / 7,058,732` ballots on terrain; `140` unmatched units and `125,172` off-map ballots retained in totals but not invented on terrain; 2020 VAP denominator, not CVAP or a 2024 eligibility estimate.
**Michigan:** Michigan Department of State, Bureau of Elections, 2024 precinct-level results; exact-cycle official 2024 precinct polygons/reporting units; `4,339 / 4,340` mapped; `5,521,612 / 5,664,186` ballots on terrain; one unmatched unit and `142,574` off-map ballots retained in aggregates; central-count/statistical adjustments are not painted onto terrain; 2020 VAP bridged to 2024 precincts with documented weighted splits, not official precinct demographics.
**Finding:** None
**Evidence:** `ai-supervisor/05-pa-evidence.png`, `ai-supervisor/06-mi-evidence.png`, `ai-supervisor/07-national-data-boundary.png`

## Task 7: Explain the Electoral College consequence

**Prompt:** Identify which scenario states changed allocation, by how many electoral votes, and which assumptions caused the change.
**First action:** Read the Electoral College consequence ledger after restoring the shared scenario.
**Wrong turns:** None.
**Completed:** Yes
**Help required, 0-5:** 0
**Explanation before correction:** Pennsylvania changed from certified Trump `R+1.7` to scenario Harris `D+0.8`, producing `+19 Harris EV`. No other active scenario changed allocation. The national scenario score was Harris `245`, Trump `293`.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Changed states and EV:** Pennsylvania, `+19 Harris EV`.
**Causal assumption:** Pennsylvania's `+2.5 pts D` two-party preference-transfer recipe.
**Finding:** None
**Evidence:** `ai-supervisor/04-restored-scenario.png`

## Adversarial questions

### Is this a forecast?

**Answer before correction:** No. It is a deterministic historical counterfactual. Path to 270 displays certified arithmetic requirements and explicitly says those requirements are not forecasts.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Interface evidence:** Route disclosure and national Data boundary.
**Finding:** None

### Does Wisconsin appearing in Path to 270 mean Wisconsin precincts were modeled?

**Answer before correction:** No. Wisconsin participates through certified statewide arithmetic only. The national Data ledger labels its detailed geography as None and geometry contract as Unsupported.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Interface evidence:** `ai-supervisor/07-national-data-boundary.png`
**Finding:** None

### How does Pennsylvania geography evidence differ from Michigan?

**Answer before correction:** Pennsylvania links 2024 reporting units to 2020 Census VTDs through exact identifiers and reviewed canonical names. Michigan uses exact-cycle official 2024 precinct polygons, then bridges the older 2020 VAP denominator to those precincts with disclosed weighted splits where necessary.
**Confidence, 1-5:** 5
**Factual correctness:** Correct
**Interface evidence:** `ai-supervisor/05-pa-evidence.png`, `ai-supervisor/06-mi-evidence.png`
**Finding:** None

## Findings ledger

No P0, P1, P2, or P3 product finding was observed in the prescribed walkthrough.

Two selector assumptions in the external review harness were corrected during harness development. They did not reflect product failure, did not change the tagged candidate, and are not product findings.

## Gate B conclusion

**All seven tasks attempted:** Yes
**All seven tasks completed correctly:** Yes
**All three adversarial questions answered:** Yes
**Unresolved P0 findings:** 0
**Unresolved P1 findings:** 0
**Gate B recommendation:** **PASS, AI technical-supervisor review**

The exact frozen candidate completed the required causal workflow and exposed the correct arithmetic, provenance, geography boundaries, URL restoration, and Electoral College consequence. The owner-designated AI supervisor therefore closes Gate B as a technical review.

This ruling does not convert AI evidence into human evidence. The v0.19B human study remains unperformed, and Gate A remains independently blocked.
