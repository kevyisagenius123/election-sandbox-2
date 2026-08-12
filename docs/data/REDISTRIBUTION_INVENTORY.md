# Public artifact redistribution inventory

**Purpose:** Know what a public build ships. This is an engineering release record, not legal advice.

| Dataset or artifact | Publisher / source | Included publicly | Redistribution basis | Attribution | Derived | Decision |
|---|---|---:|---|---|---:|---|
| FEC 2024 statewide baseline | Federal Election Commission | Yes | U.S. federal public record | FEC source linked in README | Yes, normalized | Approved for current public repository |
| PA 2024 precinct returns | Pennsylvania Department of State | Yes | Publicly downloadable official returns; explicit reuse terms not recorded | PA DOS attribution and source URL | Yes, normalized | **Review before external alpha** |
| PA official county breakdown | Pennsylvania Department of State | Yes | Public API; explicit reuse terms not recorded | PA DOS attribution and source URL | Yes, normalized | **Review before external alpha** |
| PA 2020 VTD geometry | U.S. Census Bureau TIGER/Line | Yes | U.S. Census public data | Census source and technical documentation | Yes, simplified TopoJSON | Approved with attribution |
| PA 2020 P.L. 94-171 P4 | U.S. Census Bureau | Yes | U.S. Census public data | Census table, archive, and limitations | Yes, compact runtime rows | Approved with attribution |
| PA election-to-VTD crosswalk | Derived from PA results and Census geometry | Yes | Source-dependent derived artifact | Both upstream sources documented | Yes | **Review follows PA result decision** |
| MI 2024 precinct results | Michigan Department of State | Yes | Publicly downloadable official results; explicit reuse terms not recorded | Michigan Bureau of Elections attribution and source URL | Yes, normalized | **Review before external alpha** |
| MI 2024 precinct geometry | State of Michigan Bureau of Elections GIS | Yes | Source manifest records `licenseStatus: verified`; retain source metadata | Michigan GIS attribution and metadata URL | Yes, simplified TopoJSON | Approved with attribution |
| MI 2020 P.L. 94-171 P4 | U.S. Census Bureau | Yes | U.S. Census public data | Census table, archive, and limitations | Yes, direct and weighted bridges | Approved with attribution |
| MI election-to-geometry crosswalk | Derived from Michigan results and official geometry | Yes | Source-dependent derived artifact | Both upstream sources documented | Yes | **Review follows MI result decision** |

## Release decision

The repository may remain public for development. External alpha hosting is blocked until the Pennsylvania and Michigan official-result rows marked Review have a documented redistribution basis or the public deployment obtains those artifacts through an approved delivery method. Public availability alone is not treated as permission.

Checksums, provenance, and limitations remain mandatory regardless of redistribution status.
