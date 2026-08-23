# Swingometer analytics inventory

Date: 2026-08-23

## Audit question

The v0.27 review asked whether the Swingometer clearly answers four questions:

1. What changed statewide?
2. Which operation caused most of that movement?
3. Where did the movement happen?
4. Did it change the Electoral College?

## Existing accepted evidence

The application already had exact, deterministic answers for all four questions:

| Question | Existing evidence | Previous location |
| --- | --- | --- |
| What changed? | Certified result, scenario result, and signed Harris minus Trump margin delta | Contributors drawer |
| Why? | Turnout, preference, and third-party operation ledger | Contributors drawer |
| Where? | Ranked county and mapped reporting-unit contributions | Contributors drawer |
| National consequence? | Actual and scenario winner plus exact EV transfer | Persistent right rail |

The arithmetic was not missing. The hierarchy was. A user had to connect the operation waterfall, county list, and separate Electoral College rail mentally.

## Accepted hierarchy

v0.27A keeps the detailed ledger behind the Contributors tab and adds one compact causal chain above it:

```text
dominant operation
  -> strongest county and local unit
  -> state winner and electoral consequence
```

The chain is derived from the same certified-to-scenario ledger as the detailed rows. It does not introduce a second calculation, causal inference, or chart.

## Persistent versus selected information

Persistent Swingometer space continues to contain:

- certified and scenario margins;
- national Electoral College totals;
- active modeled-state consequences;
- the current map and selection.

The Contributors drawer contains:

- the causal explanation chain;
- operation-level movement;
- county and reporting-unit rankings;
- residual and off-map disclosures;
- calculation methodology.

This avoids duplicating the same explanation in the map, rail, and drawer.

## Deferred analytics

The audit does not authorize:

- demographic causality;
- win probability;
- projections or race calls;
- decorative 3D analytics;
- a second persistent dashboard;
- third-party plurality geography before the allocation model is redesigned.

Demographic controls require a separate evidence contract and remain planned for v0.28.
