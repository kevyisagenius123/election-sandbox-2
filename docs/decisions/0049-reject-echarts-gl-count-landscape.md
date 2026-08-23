# Decision 0049: Reject ECharts GL count landscape

Date: 2026-08-23

## Decision

ECharts GL is rejected for the production Sandbox. deck.gl remains the only geographic and WebGL renderer. The v0.26C prototype remains an isolated research harness and is not imported by either production entry point.

The useful analytical form is the two-dimensional return pulse matrix:

```text
x position = fixed replay-time bin
y position = PA, MI, or WI
bubble area = ballots published in the bin
color = Harris minus Trump two-party movement in the bin
empty bin = reporting stall
```

The GL candidate encoded the same 144 marks with height instead of bubble area. It did not expose another legitimate variable. Perspective and occlusion made exact state and time comparison harder, especially at narrow widths.

## Evidence

- Both forms use one deterministic fixture compiled from all 20,499 detailed PA, MI, and WI returns and 16,145,836 ballots.
- The fixture fingerprint is `sha256:468ce7ca3cfb4bb3665b3c4cb5468ef9f7bc20223309ee0c3188dc3e9150b5a6`.
- One 2D chart owns one canvas. One GL chart owns two canvases, including a WebGL surface.
- In a representative local 10-cycle lifecycle run, 2D averaged 43.8 ms per mount/dispose cycle and GL averaged 175.1 ms. Both retained zero benchmark canvases.
- The isolated research build adds a 603.46 kB minified ECharts GL chunk, plus its ECharts support chunks. The production build contains no ECharts GL chunk and retains its prior renderer sizes.
- Desktop and mobile inspection found the 2D form readable without camera manipulation. The GL form compressed the state rows and hid bars behind one another.

The lifecycle timings are local engineering evidence, not a universal device benchmark. The rejection does not depend on one timing ratio: GL also fails the comprehension and rendering-surface tests.

## Consequences

- `echarts-gl` remains a development-only research dependency.
- Production source is tested to contain no `echarts-gl` import.
- The research harness may be rerun, but it is not linked from the product or built by the production Vite configuration.
- The 2D return pulse matrix is admitted as a future design candidate, not automatically added to the already compact Election Night dock.
- A future 3D analytical proposal requires a genuinely new readable variable and must again beat a 2D control.
