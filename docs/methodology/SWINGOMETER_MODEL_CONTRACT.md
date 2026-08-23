# Swingometer model contract

Version: v0.24

## Purpose

The Swingometer is a deterministic counterfactual calculator. Its controls are explicit assumptions, not polling estimates, forecasts, persuasion models, or claims about individual voters.

Every operation works on whole ballots and preserves the candidate and geographic reconciliation rules of the detailed state foundation.

## Turnout

The turnout control adds Harris and Trump ballots only.

```text
requested added ballots
= round(turnout denominator × selected VAP points / 100)

realized added ballots
= minimum(requested ballots, documented local capacity)
```

The user-selected Harris share determines the statewide Harris allocation; Trump receives the remainder. Capped proportional allocation distributes both totals across eligible reporting units while preserving exact integers.

Existing ballots and every third-party total remain fixed.

The interface exposes a bounded product window from 0 to +1.5 VAP points. This is an editor limit, not a statement that every unit has 1.5 points of available capacity. Local units with no defensible denominator or no remaining capacity receive no added ballots.

## Two-party preference

The preference control transfers existing ballots directly between Harris and Trump.

```text
requested direct transfer
= round(current statewide ballots × selected margin points / 200)
```

One direct Harris-to-Trump or Trump-to-Harris transfer moves the Harris-minus-Trump margin by two votes. Total ballots and all third-party candidate totals remain fixed.

The displayed bounds are calculated from the actual feasible source ballots after turnout. There is no arbitrary symmetric margin cap. Each direction can extend until its source candidate has no transferable ballot remaining.

## Third-party exchange

The third-party control exchanges Stein, Oliver, or residual Other/write-in ballots with Harris and Trump.

```text
requested selected-candidate change
= round(current statewide ballots × selected share points / 100)
```

For a candidate gain, Harris and Trump supply ballots according to the selected Harris-source share. For a candidate loss, the same share determines how returned ballots are divided between Harris and Trump.

The statewide ballot total remains fixed. The negative bound is zero remaining ballots for the selected third-party bucket. The positive bound is the available Harris and Trump source supply under the selected exchange share.

## State evidence contracts

| State | Turnout denominator | Local result geography | Important limitation |
| --- | --- | --- | --- |
| Pennsylvania | 2020 population age 18 and over | 2020 Census VTD terrain linked to 2024 reporting units | Not CVAP or a 2024 eligibility estimate; unmatched returns remain off terrain |
| Michigan | 2020 population age 18 and over bridged to 2024 precincts | Official 2024 precinct reporting-unit geometry | Weighted demographic splits are documented allocations, not official precinct demographics |
| Wisconsin | LTSB estimate of 2020 population age 18 and over | January 2025 wards with population-disaggregated 2024 results | Not raw certified ward returns, CVAP, or a 2024 eligibility estimate |

These contracts remain distinct in code and presentation. A shared control never turns one state's evidence method into another state's.

## Composition order

Operations are applied in a fixed order:

```text
certified local baseline
        ↓
turnout additions
        ↓
two-party preference transfers
        ↓
third-party exchange
        ↓
county, state, national, and Electoral College aggregation
```

Changing the operation order would change the scenario and requires a new engine version. The current interface does not permit reordering.
