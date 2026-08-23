# v0.26A verification: Reported margin timeline

Date: 2026-08-23

## Verdict

**PASS for supervisor review.** The first regular ECharts analytical lens is linked to the existing replay and map, remains current-prefix-only, and owns a bounded visible-tab lifecycle.

## Contract coverage

- Zero returns produce an empty timeline and expose no scheduled future event.
- Every unsampled prefix point reconstructs the exact reported national and state margin.
- The sampled display is deterministic, bounded to 320 points, and retains the latest return.
- Divergent hidden future candidate vectors produce byte-identical visible timelines.
- The worker sends the timeline only while the lens is open.
- Clicking the chart seeks the existing replay input and changes the shared map state.
- Leaving Timeline disposes the canvas; reopening creates one canvas.
- A chronology restart preserves the result and rebuilds the subscribed timeline.
- Desktop and mobile layouts have no horizontal overflow.
- Mobile Timeline selection expands the dock for the analytical view.

## Verification record

```text
dedicated visible-timeline tests             4 / 4 passed
focused chronology and prefix tests        14 / 14 passed
aggregate model/replay/analytics tests    201 / 201 passed
aggregate duration                           467.518 s
focused integrated browser journey           1 / 1 passed
TypeScript production build                      passed
ESLint                                            passed
production dependency audit               0 vulnerabilities
git diff integrity                                passed
```

The production build isolates regular ECharts 6.1 in `ElectionNightMarginTimeline`, a 536.18 kB minified and 181.02 kB compressed lazy chunk. The main application chunk is 460.44 kB minified. The existing deck.gl map chunk remains approximately 1.6 MB minified and lazy.

Visual references:

- `screenshots/margin-timeline-desktop.png`
- `screenshots/margin-timeline-mobile.png`
- `screenshots/integrated-election-night-desktop.png`
- `screenshots/integrated-election-night-mobile.png`

## Non-scope

No ECharts GL, second map renderer, future return, probability, expected candidate share, projection, Decision Desk call, demographic model, backend, membership, or deployment changed.
