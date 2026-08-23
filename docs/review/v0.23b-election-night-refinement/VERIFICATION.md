# v0.23B verification: Election Night refinement

Date: 2026-08-22

## Verdict

**PASS for supervisor review.** Election Night now reuses its active three-state worker for chronology restarts and explains the exact margin effect of newly published local returns.

## Verified behavior

### Worker lifecycle and cache

- The first Election Night start creates one dedicated worker.
- Chronology-only restarts send a new initialization request to that same worker.
- PA, MI, and WI decoded foundations are reused inside the active session.
- Scenario-unit caching is bounded to three entries.
- Default recipes take the exact zero-change projection; modified recipes still use `applyBehaviorScenario`.
- Returning to the Swingometer terminates the worker and clears React-side county and unit state.

### Current-only return explanation

- Every applied event records its own Harris and Trump votes and net margin movement.
- State and county margins are captured immediately before and after the event.
- The dock retains only the twelve most recent published return summaries.
- Backward seeking rebuilds both the map state and recent tape from the requested prefix.
- No future event, remaining vote, endpoint inference, projection, or call enters the response.

### Interface

- The shared bottom dock remains the only Election Night command surface.
- State cards show explicit published-unit progress.
- The newest publishing state receives a restrained gold outline.
- The local return tape names the state and county, reports ballots and time, and explains the exact margin movement.
- Unsupported states continue to show no returns anywhere in the experience.

## Automated verification

```text
headless model/replay suite       161 / 161 passed
focused browser journeys           2 / 2 passed
focused browser duration             60 seconds
chronology restart gate             < 30 seconds
TypeScript production build                passed
ESLint                                     passed
```

The production build retains the existing deck.gl chunk-size warning. No new application dependency was added.

## Visual evidence

- [Local return tape](screenshots/election-night-local-return-tape.png)
- [Integrated Election Night desktop](screenshots/integrated-election-night-desktop.png)
- [Election Night director](screenshots/election-night-director-desktop.png)
- [Integrated Election Night mobile](screenshots/integrated-election-night-mobile.png)
- [Editorial home](screenshots/editorial-home-desktop.png)

## Non-scope

No Decision Desk, projection, race call, expected-vote estimate, hidden outcome, backend, membership, export, video, new state, unsupported-state return, or partial local batch is included.

## Recommended next milestone

Return to the Swingometer roadmap with a bounded v0.24 model-refinement release. Audit the existing demographic inputs and slider semantics before adding population editing, uncertainty, or more states.
