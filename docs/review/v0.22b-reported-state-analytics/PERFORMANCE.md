# v0.22B analytics performance baseline

Date: 2026-08-21

Command: `npm run benchmark:analytics`

```text
Derivation                 Median       p95      Worst
National headline          0.005 ms    0.013 ms   3.718 ms
Pennsylvania               0.641 ms    1.836 ms   3.236 ms
Michigan                   0.607 ms    1.331 ms   1.955 ms
One county                 0.009 ms    0.019 ms   0.365 ms
Full available snapshot  181.641 ms  216.480 ms 216.480 ms
```

The final full canonical analytics snapshot is 25,080,001 serialized bytes. Headline APIs intentionally avoid constructing it. These are baseline observations, not formal limits.
