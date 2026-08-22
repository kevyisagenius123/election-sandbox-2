# 0039: Integrate Election Night into the Swingometer

Date: 2026-08-22

## Status

Accepted as the corrected v0.23A visible slice.

## Decision

Election Night is a mode of the existing Laboratory. It is not a route, page, or second map. Switching modes preserves the mounted deck.gl canvas, camera, selection, and geographic drilldown.

The Swingometer owns the final PA, MI, and WI vote endpoints. A dedicated worker schedules one immutable return for every available Pennsylvania VTD, Michigan precinct, and Wisconsin ward. Those returns aggregate upward into counties and the three state totals.

The audited v0.22 national replay kernel remains unchanged, but its 49 coarse statewide fixtures are not used by the visible experience. No unsupported jurisdiction publishes a return, margin, call, reporting percentage, or electoral consequence.

## User-directed counting law

The endpoint and reporting behavior remain separate. Changing reporting behavior cannot change a candidate vote total. The visible editor controls:

- total count duration;
- mixed, smaller-area-first, or larger-area-first reporting order;
- deterministic timing volatility;
- burst and stall intensity;
- PA, MI, and WI first-return delays after poll close;
- deterministic seed.

The scheduler derives independent county activation windows and irregular reporting-unit gaps. Stable namespace hashing makes the same inputs byte-for-byte repeatable. No `Math.random()` is used.

## Map law

Unreported states, counties, and reporting units remain neutral and low. Published reporting units adopt their current reported margin and rise using counted ballots. County and state colors are derived only from published child returns. The newest state, county, and mapped reporting unit receive the Atlas gold highlight.

## Geographic honesty

- Pennsylvania: 2020 Census VTD terrain linked to the available modeled reporting-unit endpoint.
- Michigan: 2024 precinct reporting units and exact-cycle local terrain.
- Wisconsin: detailed ward reporting units and ward terrain.
- Every other jurisdiction: excluded from the visible election-night count.

## Preserved infrastructure

The v0.21 and v0.22 endpoint, compiler, reducer, analytics, seek, playback, observation, and worker verification records remain historical, tested infrastructure. This decision changes visible product composition rather than rewriting those accepted contracts.
