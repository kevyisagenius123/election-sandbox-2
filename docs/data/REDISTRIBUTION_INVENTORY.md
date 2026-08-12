# Public artifact redistribution inventory

**Purpose:** Know what a public build ships. This is an engineering release record, not legal advice.

| Dataset or artifact | Publisher / source | Included publicly | Redistribution basis | Attribution | Derived | Decision |
|---|---|---:|---|---|---:|---|
| FEC 2024 statewide baseline | Federal Election Commission | Yes | U.S. federal public record | FEC source linked in README | Yes, normalized | Approved for current public repository |
| PA 2024 precinct returns | Pennsylvania Department of State | Yes | Publicly downloadable official returns; no explicit redistribution grant found for the specific pa.gov artifact | PA DOS attribution and source URL | Yes, normalized | **Excluded from external alpha pending permission, applicable legal basis, or approved replacement** |
| PA official county breakdown | Pennsylvania Department of State | Yes | Public API; no explicit redistribution grant found for the specific electionreturns.pa.gov artifact | PA DOS attribution and source URL | Yes, normalized | **Excluded from external alpha pending permission, applicable legal basis, or approved replacement** |
| PA 2020 VTD geometry | U.S. Census Bureau TIGER/Line | Yes | U.S. Census public data | Census source and technical documentation | Yes, simplified TopoJSON | Approved with attribution |
| PA 2020 P.L. 94-171 P4 | U.S. Census Bureau | Yes | U.S. Census public data | Census table, archive, and limitations | Yes, compact runtime rows | Approved with attribution |
| PA election-to-VTD crosswalk | Derived from PA results and Census geometry | Yes | Source-dependent derived artifact | Both upstream sources documented | Yes | **Excluded from external alpha while PA result artifact is excluded** |
| MI 2024 precinct results | Michigan Department of State | Yes | Michigan.gov terms restrict copying, distribution, modification, automated access, and commercial use absent permission, other terms, or applicable law | Michigan Bureau of Elections attribution and source URL | Yes, normalized | **Excluded from external alpha pending written permission, applicable legal basis, or approved replacement** |
| MI 2024 precinct geometry | State of Michigan Bureau of Elections GIS | Yes | Source manifest records `licenseStatus: verified`; retain source metadata | Michigan GIS attribution and metadata URL | Yes, simplified TopoJSON | Approved with attribution |
| MI 2020 P.L. 94-171 P4 | U.S. Census Bureau | Yes | U.S. Census public data | Census table, archive, and limitations | Yes, direct and weighted bridges | Approved with attribution |
| MI election-to-geometry crosswalk | Derived from Michigan results and official geometry | Yes | Source-dependent derived artifact | Both upstream sources documented | Yes | **Excluded from external alpha while MI result artifact is excluded** |

## Release decision

No invitation or participant distribution is authorized from this inventory. The Pennsylvania and Michigan official-result artifacts and their source-dependent crosswalks are excluded from external alpha delivery until written permission, an applicable documented legal basis, or an approved replacement source and delivery method is recorded. Public availability alone is not treated as permission. Because the public repository and currently reachable Pages build contain or serve the excluded artifacts, they are not a cleared participant delivery. The next operational decision must be permission/legal-basis approval, a replacement build, or authorization to suspend that public delivery.

The Pennsylvania review used the Department of State's historical election-data page and distinguished it from the separate `data.pa.gov` policy, which applies to datasets made available through that portal. The Michigan review used the statewide Michigan.gov Terms of Use Policy. See decision 0025. This inventory is an engineering release record, not legal advice.

Checksums, provenance, and limitations remain mandatory regardless of redistribution status.
