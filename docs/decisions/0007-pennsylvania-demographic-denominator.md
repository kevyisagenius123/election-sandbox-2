# 0007: Pennsylvania demographic denominator foundation

## Status

Accepted for the v0.4 foundation.

## Decision

The first demographic artifact uses Table P4 from the official 2020 Census P.L. 94-171 Redistricting Data Summary File. P4 provides mutually reconcilable race and Hispanic-origin counts for the population age 18 and over at the 2020 Census voting-district level.

The demographic record joins to the existing map by the exact 11-character state, county, and VTD identifier. No spatial interpolation, fuzzy name matching, or demographic inference is required for this layer.

The runtime may use the 2020 voting-age population as an explicitly labeled experimental turnout denominator. It must not describe that count as citizen voting-age population, registered voters, or the 2024 voting-eligible population. Added ballots are capped by the difference between the 2020 adult-population count and the mapped 2024 baseline ballots in each VTD. VTDs without mapped election results remain unavailable for behavior modeling.

Candidate preference is a separate operation. Census demographic counts do not reveal candidate choice, so the product must not infer group preferences from this artifact.

## Consequences

- The demographic geography coverage is exact for the 2020 VTD vintage used by the map.
- The four-year vintage mismatch and the non-citizen component of VAP remain visible limitations.
- The initial turnout control is a transparent synthetic operation, not a calibrated estimate of real eligible-voter behavior.
- A later ACS/CVAP and block-informed crosswalk can replace or supplement this denominator without changing the certified election baseline.
