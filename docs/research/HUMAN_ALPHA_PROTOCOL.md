# v0.19B Human Alpha Protocol

**Release under test:** v0.19.1 Alpha Comprehension and Trust Corrections  
**Research phase:** v0.19B  
**Status:** Ready to schedule after the delivery and redistribution gate is cleared  
**Canonical public entry:** `https://kevyisagenius123.github.io/election-sandbox-2/app/`

## Purpose

This study tests whether genuinely new users can understand and operate Sandbox 2.0 without a feature tour. It is the human follow-up to the v0.19A synthetic alpha and the unchanged v0.19.1 synthetic rerun.

The study is not a demonstration, a sales interview, or a model validation exercise. The moderator observes what participants infer from the interface itself.

The primary questions are:

1. Can a new user begin changing a supported state without coaching?
2. Can they distinguish the certified Actual result from their Scenario result?
3. Can they improve a state, stop short of flipping it, and find the exact remaining requirement?
4. Can they distinguish Required, Modeled, and Satisfied states in a Path to 270?
5. Can they understand ballots transferred versus Harris-minus-Trump margin movement?
6. Can they identify where a modeled change came from geographically?
7. Can they save and restore a deterministic portfolio using its scenario URL?
8. Do the evidence ledger and geography labels support an appropriate level of trust?

## Research integrity

- Recruit genuinely new participants. Do not use the product owner, supervisor, contributors, or anyone already taught the product vocabulary.
- Do not describe the expected solution before or during a task.
- Do not call a session successful merely because the final screen is correct. Record wrong mental models and help required.
- Do not convert browser automation or another persona exercise into human evidence.
- Do not report percentages from this small sample. Report counts and recurring patterns.
- Do not describe v0.19B as complete until at least three new humans have completed the same core tasks. Five to ten mixed participants remains the preferred sample.

## Research freeze

The v0.19.1 participant build is frozen from readiness approval through Session 1.

Allowed changes are limited to:

- an external-alpha delivery blocker;
- a security issue;
- broken deterministic scenario restoration;
- an obvious P0 correctness defect;
- the minimum change required by an approved artifact-delivery method.

Copy refinements, drawer changes, new routes, new model controls, State #3 runtime work, and Run My Election implementation are outside the freeze. If an allowed change alters the participant build, record it, rerun every release gate, and restart the human comparison from the changed build where necessary.

## Delivery gate

Before sending the application to external participants:

1. Resolve the Pennsylvania and Michigan official-result artifacts currently excluded from external alpha delivery in `docs/data/REDISTRIBUTION_INVENTORY.md`, or use an approved delivery method that does not redistribute them without a documented basis.
2. Re-run the remote smoke journey against the exact URL participants will receive.
3. Confirm `/`, `/app/`, and a copied `/app/?scenario...` URL load without authentication.
4. Confirm the release label remains v0.19.1 and no unverified product changes entered the build after the correction gates.

The repository being public and the Pages site being reachable do not, by themselves, clear the redistribution gate.

## Participant matrix

Recruit participants by mental model, not only political interest. One person may cover more than one characteristic, but the final sample should not consist entirely of election experts.

| Participant type | Minimum target | Primary risk exposed |
| --- | ---: | --- |
| Casual politics follower | 1 | Discoverability and plain-language comprehension |
| Cautious novice | 1 | Confidence, terminology, and hierarchy |
| Election specialist or campaign user | 1 | Strategic usefulness and analytical depth |
| Journalist, researcher, or evidence-focused user | 1 | Provenance and misleading precision |
| GIS, mapping, or data practitioner | 1 preferred | Geographic contracts and residual treatment |
| Software power user | 1 preferred | State persistence, sharing, and interaction consistency |

Do not collect names in the checked-in research record. Assign IDs such as `H01`, `H02`, and `H03`. Keep recruitment contact information outside the repository.

## Session format

- **Length:** 35 to 50 minutes
- **Device:** participant's ordinary laptop or desktop for the core study
- **Optional follow-up:** one phone-width comprehension pass after the core tasks
- **Starting state:** fresh `/app/` session with no scenario query
- **Moderator:** one person who has read this protocol
- **Recording:** only with the participant's explicit permission
- **Think aloud:** encouraged, but silence is not failure

### Opening script

> Thank you for trying an early election-analysis product. We are testing the product, not you. Some controls or language may be confusing, and identifying that confusion is useful. I will give you several tasks but will not teach you the interface first. Please say what you expect controls and numbers to mean as you work. You may stop at any time. Do not enter personal information. Any scenario you create is encoded in the page URL, so do not share a scenario URL you want to keep private.

Then ask:

1. How closely do you follow United States presidential elections?
2. Have you used election simulators or detailed election maps before?
3. Are terms such as electoral margin, precinct, and Electoral College route familiar to you?

These answers describe the participant. They do not change the tasks.

## Core tasks

Give each task separately. Do not expose later tasks early.

After every task, and before explaining or correcting anything, ask:

> How confident are you that your explanation is correct? 1–5.

Record both correctness and confidence. An incorrect answer at 5 of 5 is a more serious epistemic-status signal than an incorrect answer at 2 of 5.

### Task 1: Flip Pennsylvania

> Using Sandbox 2.0, make Harris win Pennsylvania. Then explain which geographic areas contributed most to the change.

### Task 2: Stop short

> Improve Harris's Pennsylvania result but do not let Harris win the state. Determine exactly how much additional movement would still be required.

Reset to the certified baseline before this task if the participant cannot reasonably modify the Task 1 scenario back below the threshold. Record the reset as moderator help.

### Task 3: Path to 270

> Find the path to 270 requiring the fewest net margin votes and begin constructing that route using any detailed state that Sandbox supports.

### Task 4: Save and restore

> Save or copy your scenario, leave the application, reopen it, and determine whether the same election was restored.

The moderator may provide a blank tab after the participant has independently chosen a save or copy action. Do not tell them that the URL is the saved object unless they have failed the task and the session must continue.

### Task 5: Explain the election

> Explain why the Electoral College result differs from the certified 2024 result. Identify the states and assumptions responsible.

## Comprehension questions

Ask these after the tasks, without multiple-choice answers:

1. In your own words, what does `Required` mean?
2. Can a state be `Modeled` without being `Satisfied`? Explain.
3. If 50,000 ballots transfer from Trump to Harris, why might the displayed margin movement be 100,000 votes?
4. Does appearing in a Path to 270 mean Sandbox has geographically modeled that state?
5. What is the difference between the Actual and Scenario results?
6. What is the most detailed geography the product is claiming for Pennsylvania? For Michigan?
7. Which part of the interface would you use to decide whether to trust a number?

## Optional professional probes

Ask an election specialist, campaign user, journalist, or data practitioner:

1. What does Sandbox tell you that a normal electoral map does not?
2. Which claim would you be comfortable citing, and which would require more evidence?
3. Where does the product appear more precise than its data foundation justifies?
4. What would stop you from using this in a briefing, classroom, article, or analysis?

These are probes, not additional success requirements for every participant.

## Moderator behavior

### Allowed

- Repeat the task exactly.
- Ask `What do you expect that to do?`
- Ask `What does that number mean to you?`
- Ask `What would you try next?`
- Provide a new blank tab during the save-and-restore task after the participant initiates the workflow.
- Prevent accidental navigation to unrelated external sites.

### Not allowed before failure is recorded

- Naming the control to use.
- Explaining Required, Modeled, Satisfied, margin movement, or scenario URLs.
- Pointing at the drawer, Data tab, contribution panel, route metric, or state chips.
- Reframing the task using internal product terminology.
- Correcting a participant's explanation while they are still attempting the task.

### Help scale

- **None:** participant completes from the task text and interface.
- **Minor:** moderator repeats the task or gives a neutral prompt.
- **Major:** moderator identifies a region, control, definition, or intended workflow.
- **Takeover:** moderator performs an action or supplies the solution.

Record the first major-help moment before continuing the session.

## Task success rubric

### Task 1

- Harris is the effective Pennsylvania winner.
- Participant identifies meaningful county or VTD contribution evidence rather than naming areas from prior knowledge alone.
- Their explanation does not confuse map color with causal contribution.

### Task 2

- Harris improves relative to Actual but remains below the Pennsylvania winning threshold.
- Participant finds the current exact remaining Harris-minus-Trump margin requirement.
- Participant does not report the certified baseline requirement as the live remaining gap.

### Task 3

- Participant selects `Net margin votes` as the route metric.
- Participant identifies the top-ranked route under that metric.
- Participant opens or changes a supported detailed state on the route.
- Participant does not claim unsupported route states have county or precinct models.

### Task 4

- Participant independently finds `Copy scenario link` or copies the full versioned URL.
- A fresh load reconstructs the same assumptions, active state recipes, national score, and relevant selected route state.
- Participant recognizes that the URL, rather than an account save, is the saved deterministic object.

### Task 5

- Participant distinguishes Actual from Scenario.
- Participant identifies the active state assumptions that caused the national difference.
- Participant distinguishes changed-but-not-flipped states from states that changed electoral allocation.

## Severity rubric

- **P0:** wrong or irreconcilable votes, lost or duplicated state recipe, incorrect EV allocation, corrupted scenario restoration, or a trust claim contradicted by the data contract.
- **P1:** repeated inability to complete a core task, repeated wrong mental model that changes the meaning of the result, or evidence language that materially overstates support.
- **P2:** substantial friction, unclear hierarchy, or terminology problem that users can recover from without receiving the solution.
- **P3:** polish, preference, or isolated low-impact confusion.

A single participant can reveal a P0. A P1 usability correction normally requires recurrence across participants or an especially severe, unambiguous failure.

## Triage and release rule

After at least three completed sessions:

1. Separate product-comprehension findings, software defects, data questions, research-operation issues, and feature requests.
2. Compare human observations with the predicted v0.19A findings.
3. Correct every P0 before another session.
4. Triage repeated P1 findings before State #3.
5. Re-run model, browser, visual, responsive, remote, and runtime gates after any correction.
6. Do not let attractive feature requests expand v0.19B.

v0.19B closes only when:

- at least three genuinely new humans completed the unchanged core tasks;
- no unresolved P0 remains;
- no unresolved P1 remains;
- no repeated severe misunderstanding of the model's epistemic status remains;
- participants can find the evidence chain when asked;
- deterministic restoration remains functional and appropriately trusted;
- the comparison with v0.19A is written;
- the delivery and redistribution method is documented;
- all release gates pass.

Only then may State #3 admission begin as the next product phase.
