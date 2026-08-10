# Decision 0011: Versioned scenario URLs

## Status

Accepted for Sandbox 2.0 v0.8.

## Decision

Deterministic scenarios are serialized as readable URL query parameters. A scenario URL carries three independent compatibility identifiers:

- URL schema `1` defines the parameter contract;
- dataset `us2024-pa-vtd2020-v2` identifies the election, Pennsylvania result and crosswalk foundation, and demographic artifact generation; and
- engine `pa-behavior-v1` identifies the ordered turnout, preference, and third-party behavior semantics.

The payload stores every active behavior value, map comparison mode, behavior-editor tab, contribution-ranking scope, and selected state, county, and VTD. Numbers use canonical decimal strings. County and VTD selections must form a valid Pennsylvania geographic hierarchy.

The application uses `history.replaceState` for live synchronization so dragging a control does not create a history entry for every intermediate value. The Copy link action always produces a complete, versioned payload, including for the baseline. An untouched baseline keeps the ordinary page URL clean.

Decoding is fail-closed. Duplicate parameters, invalid ranges, unknown choices, malformed geography, missing compatibility identifiers, and unknown future versions do not apply partially. They restore the certified baseline and expose a visible reason. Unrelated query parameters are preserved.

The URL contains assumptions and immutable version references only. It does not contain computed totals. The compatible client rebuilds those totals through the deterministic engine, which keeps the shared link compact and prevents serialized output from becoming a second source of truth.

## Consequences

- A shared scenario can be replayed without a backend, account, or stored record.
- The data and engine versions must be bumped whenever a change can alter replayed results.
- Future clients may support migrations, but the current client must never guess how to interpret a future payload.
- Query strings are longer than opaque encoded blobs, but they remain inspectable, testable, and recoverable.
- Server-side persistence can later wrap this same contract without changing deterministic scenario semantics.
