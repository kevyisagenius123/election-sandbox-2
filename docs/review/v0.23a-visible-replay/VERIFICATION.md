# v0.23A verification: Integrated three-state Election Night

Date: 2026-08-22

## Candidate verdict

**PASS for supervisor review.** Election Night now runs inside the Swingometer on the persistent Atlas map and publishes detailed returns for Pennsylvania, Michigan, and Wisconsin only.

## Verified behavior

- `/app/` remains the only Laboratory entry. There is no replay page or replay HTML build entry.
- Switching modes preserves the exact mounted deck.gl canvas and URL path.
- Election Night reorganizes that canvas into the Atlas editorial layout: full-stage terrain, a left geographic headline, a read-only three-state desk, and one shared bottom command dock.
- The command dock uses the Laboratory's established collapsed, working, and expanded positions. Playback, speed, timeline, count direction, returns, methodology, and the Swingometer handoff are all housed there.
- The current Swingometer recipes define the final PA, MI, and WI reporting-unit vote totals.
- The worker publishes one atomic return per PA VTD, Michigan precinct, and Wisconsin ward.
- No coarse statewide return is generated or displayed for any other jurisdiction.
- State colors derive from currently reported local returns. Unreported geography stays neutral.
- Independent county windows, irregular gaps, bursts, stalls, and stable jitter prevent synchronized drops.
- User controls change duration, geographic order, volatility, stall intensity, state delays, and deterministic seed.
- Four built-in reporting profiles provide deterministic candidate-blind starting points. Custom profiles can be named, overwritten, reloaded, and removed from browser-local storage.
- County exceptions can move one county's start window earlier or later and shorten or lengthen its count. The compiler validates unique county keys and bounded timing fields; candidate data is not an input.
- A draft chronology preview displays PA, MI, and WI activation/finish windows and local-exception counts before the user applies and restarts the replay.
- Reconfiguring timing never changes any reporting-unit vote vector.
- Gold outlines identify the newest state, county, and mapped reporting unit.
- Play, pause, reset, next return, and normalized seek remain available.
- The three-state desk shows live PA, MI, and WI margins and return counts.

## Gates

```text
three-state scheduler tests       6 / 6 passed
headless model/replay suite       161 / 161 passed
focused browser journeys         2 / 2 passed
npm run build                     passed
npm run lint                      passed
```

An earlier aggregate headless invocation reported 157 / 158 because an
architectural source guard found the forbidden analytics term `projection` in
an older documentation comment. The comment described a compact state
snapshot, not predictive logic. Renaming it to `snapshot` restored the guard;
that historical issue remains resolved. The current post-director run passes
all 161 tests together.

The Election Night journey initializes the real worker, verifies that the same canvas survives the mode switch, confirms that the URL does not change, checks Wisconsin inclusion and coarse-state exclusion, resizes the dock, changes speed, seeks, plays, loads a built-in profile, adds an Allegheny County override, saves and reloads a custom profile, verifies the preview, applies the draft, and returns to the Swingometer without replacing the map. A second journey verifies the redesigned editorial home, persistent 3D map, product narrative, and entry into `/app/`.

## Visual reference

- [Integrated Election Night desktop](screenshots/integrated-election-night-desktop.png)
- [Election Night director desktop](screenshots/election-night-director-desktop.png)
- [Integrated Election Night mobile](screenshots/integrated-election-night-mobile.png)
- [Editorial Home desktop](screenshots/editorial-home-desktop.png)

## Methodological boundary

The chronology is deterministic and user-directed, not a historical 2024 reporting reconstruction. Pennsylvania uses VTD-linked model units, Michigan uses exact-cycle precinct units, and Wisconsin uses detailed wards. Reporting behavior changes only chronology, never the locked scenario result.
