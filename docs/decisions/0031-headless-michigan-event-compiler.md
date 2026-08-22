# 0031: Compile Michigan through the generic replay contract

Date: 2026-08-21

## Status

Accepted by the product owner after supervisor authorization of bounded v0.21D.

## Decision

Michigan is the second detailed replay compiler. It consumes the existing locked Michigan scenario endpoint and produces one deterministic `RETURN_PUBLISHED` event for each of its 4,413 model units. It emits no invented internal precinct batches, reducer state, projections, calls, playback UI, or national product behavior.

The compiler output implements the same `CompiledJurisdictionReplay` contract used by Pennsylvania. Generic admission and composition contain no Michigan branch.

## Geography and residual law

Michigan remains materially different from Pennsylvania:

```text
Pennsylvania 2024 reporting units
→ 2020 Census VTD terrain

Michigan 2024 geometry-linked precinct result units
→ 2024 Michigan precinct reporting-unit geometry
```

Michigan's endpoint contains:

- 4,339 mapped exact-cycle precinct result units;
- eight unmatched precinct units retained off-map;
- 65 central-count units retained off-map;
- one statewide statistical-adjustment unit retained off-map and outside county geography.

These 74 off-map units remain vote-bearing first-class source/model units. They are never assigned invented polygons, moved to nearby precincts, silently merged, or discarded.

The 2020 Census VTD bridge used for demographic denominators is not part of the replay map-geography claim.

## Scheduling law

Two synthetic, versioned profiles are accepted:

- `mi-synthetic-uniform-wave-v1`;
- `mi-synthetic-metropolitan-late-v1`.

Scheduling may use only normalized jurisdiction identity, county identity, unit identity, unit type, final ballot workload, the selected profile, and named deterministic random streams. Candidate identities, candidate shares, statewide winner, desired lead changes, and presentation drama are prohibited inputs.

Central-count units may receive a type-based administrative delay. Large metropolitan counties may receive a workload-based delay. Neither rule inspects how those units voted.

Michigan's canonical replay clock begins at the first statewide 8 PM local poll-close boundary, `2024-11-06T01:00:00.000Z`, presented in `America/Detroit`. Dickinson, Gogebic, Iron, and Menominee counties are candidate-blindly gated for one additional hour because they observe Central Time. This preserves the singular v0.21C replay clock while preventing those counties from reporting before their own local close.

## Identity and randomness

Michigan-owned named streams include jurisdiction identity:

```text
activation/county/MI/{countyId}
timing/unit/MI/{unitId}
timing/residual/MI/{unitId}
```

Canonical event identity already includes `jurisdictionId`. Equal PA and MI local IDs therefore cannot collide in event identity or deterministic randomness.

## Golden records

Certified Michigan:

```text
endpoint  sha256:4a9bb791497c487eea16c7fcab13af628afff27c6bf1f9c9ba91f8c82b7612c1
stream    sha256:61aa67ca75647c66da60b8bdfd296ff54b499cabd681184df95a017455deb484
```

Complex Michigan counterfactual, produced by the existing Sandbox scenario engine:

```text
endpoint  sha256:2a81ff04b0ad19c583ce805f0af09455d227ece17151ba196caa87307c2b5e24
stream    sha256:a5391fbda94477926d06f90885e22120d4e8801e8fdcd49e9063d55f1461dba6
```

The accepted Pennsylvania compiled fingerprints remain unchanged:

```text
certified sha256:db1aacfd512c448fb68c87f8c6bd9062486d4aca47a572034dfb342ca84ed38c
complex   sha256:8c1071719d5fe2efb9e0ae0896646227c65eafb9b23dc7fe6ef8ad36634516e8
```

## Detailed composition fixture

A combined PA+MI endpoint adapter exists only to prove that both detailed compilers can reference one locked election and enter the unchanged v0.21C compositor. The composition remains partial at 34 accepted EV while the locked election remains exactly 538 EV.

The compositor performs only admission, absolute-time merge, canonical ordering, and exact aggregation. It does not create batches, select interesting states, calculate leads, or call races.

## Prohibited scope

v0.21D does not authorize all-jurisdiction compilation, a reducer, cursor, reported-vote application state, expected vote, Decision Desk, projections, calls, React, deck.gl replay integration, animation, historical reporting chronology, queue editing, Studio, video, backend, rooms, accounts, memberships, public deployment, or State #3.
