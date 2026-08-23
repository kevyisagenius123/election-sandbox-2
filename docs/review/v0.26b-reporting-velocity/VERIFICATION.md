# v0.26B verification: Reporting velocity and state comparison

Date: 2026-08-23

## Scope

This release adds visible-prefix reporting pace and separate PA, MI, and WI comparison inside the existing Election Night Timeline workspace. It does not add ECharts GL, projections, probabilities, calls, or a second map.

## Contract checks

- Empty replay prefixes expose no scheduled return identity.
- Visible pace totals reconcile exactly to the observed return prefix.
- A different chronology seed changes timing but never votes.
- Hidden future candidate shares cannot change the visible pace payload.
- Display points are deterministic, bounded, and preserve current activity.
- State ballot progress and reporting-unit progress remain separate.
- Hidden Timeline workspaces receive null margin and pace payloads.

## Automated verification

- Aggregate model, replay, data, and analytics suite: 206 of 206 passed in 532.238 seconds.
- Dedicated reporting-pace suite: 5 of 5 passed.
- Accepted reported-margin suite: 4 of 4 passed.
- Focused integrated browser journey: 1 of 1 passed in 1.4 minutes.
- TypeScript production build: passed.
- ESLint: passed.

The focused integrated browser journey verifies:

- Margin, Velocity, and Compare-state switching;
- one analytical chart canvas at a time;
- chart disposal and remount;
- ballots/returns metric switching;
- velocity-chart seeking of the existing replay and map;
- semantic comparison cards;
- desktop and 390 by 844 mobile layouts;
- no horizontal viewport overflow.

## Visual references

Screenshots are stored under `screenshots/`, including desktop and mobile velocity, desktop state comparison, the retained margin timeline, the local return tape, the count director, and the integrated Election Night layouts.

## Known warning

The existing production chunk-size warning remains. deck.gl is still isolated in its 1,604.89 kB minified lazy map chunk. The shared regular-ECharts renderer is 532.57 kB minified, while the margin and velocity component chunks are 3.70 kB and 3.77 kB respectively. ECharts GL is not installed.
