# External Alpha Data Permission Requests

**Status:** Drafts ready for owner review and submission

**Purpose:** Clear the v0.19B participant-delivery gate without changing the frozen product

These messages ask the source agencies to confirm whether Sandbox 2.0 may publicly host normalized derivatives of their 2024 presidential election-result data. They do not request personal voter information, voter-file data, or agency endorsement.

Replace every bracketed field before sending. Save the complete agency response, including headers and attachments, outside the public repository. Record only the resulting decision and non-sensitive evidence in `ALPHA_DELIVERY_DECISION_TRACKER.md`.

## Pennsylvania request

**To:** `RA-Elections@pa.gov`

**Official contact basis:** The Pennsylvania Department of State lists this address for Elections and Precinct Data questions.

**Subject:** Permission clarification for public reuse of 2024 Pennsylvania election returns

```text
Hello Pennsylvania Bureau of Elections,

My name is [YOUR FULL NAME]. I am developing Sandbox 2.0, an independent election-analysis and educational web application. I am writing to ask for written clarification about reuse of two Pennsylvania Department of State 2024 presidential election-result sources.

The source materials are:

1. 2024 General Election Precinct Election Returns
https://www.pa.gov/content/dam/copapwp-pagov/en/dos/resources/voting-and-elections/bulk-data/2024-general-election/er/erstat_2024_g_268768_20250129.txt

2. 2024 Presidential Election Official County Breakdown
https://www.electionreturns.pa.gov/api/ElectionReturn/GetCountyBreak?officeId=1&districtId=1&methodName=GetCountyBreak&electionid=105&electiontype=G&isactive=0

The application normalizes the published candidate totals into two machine-readable JSON artifacts:

- a 67-county presidential summary, approximately 31 KB;
- 9,189 election reporting-unit records, approximately 5.47 MB.

The normalization preserves candidate vote totals and reporting-unit labels. It adds stable internal identifiers and explicit residual buckets where source totals do not support a geographic allocation. It does not contain voter names, voter-file information, ballot images, or other personal information.

The planned use is to:

- host the normalized artifacts as part of a publicly accessible web application;
- display aggregate historical results and user-created counterfactual scenarios;
- allow a small external usability alpha to access the application;
- publish the application source code and derived data artifacts in a public GitHub repository;
- retain Pennsylvania Department of State attribution, source links, retrieval dates, checksums, and methodology notes;
- state clearly that the application is independent and is not endorsed by the Commonwealth.

The initial alpha is free and non-commercial. The public repository and demonstration may remain available after the study. To avoid relying on an assumption about the website terms, could you please confirm one of the following in writing?

1. The Department permits the described downloading, transformation, public display, and redistribution of these normalized election-result derivatives with attribution; or
2. A published policy, license, or legal basis already governs this use, and you can identify it; or
3. Additional permission, conditions, or a different delivery method is required.

If the Department permits only non-commercial research and educational use, please state that limitation. If separate permission would be required for future commercial use, please clarify that as well.

I can provide the exact schemas, checksums, repository link, or a private preview if that would help your review. I will not invite external testers using these artifacts until the delivery basis is documented.

Thank you,

[YOUR FULL NAME]
[ROLE OR ORGANIZATION, IF ANY; "Independent developer" is acceptable]
[REPLY EMAIL]
https://github.com/kevyisagenius123/election-sandbox-2
https://kevyisagenius123.github.io/election-sandbox-2/
```

## Michigan request

**To:** `ElectionData@Michigan.gov`

**CC:** `Elections@Michigan.gov`

**Official contact basis:** The Michigan Bureau of Elections contact card identifies `ElectionData@Michigan.gov` for QVF data requests and corrections, and the Bureau lists `Elections@Michigan.gov` for general public questions. The request concerns election-result files, not access to QVF personal data.

**Subject:** Written permission clarification for normalized 2024 Michigan election results

```text
Hello Michigan Bureau of Elections,

My name is [YOUR FULL NAME]. I am developing Sandbox 2.0, an independent election-analysis and educational web application. I am writing to ask for written permission or clarification regarding reuse of the Bureau's 2024 precinct-level general election results.

The source is the 2024 Michigan precinct-level general election result package obtained through:

https://mvic.sos.state.mi.us/votehistory/

The downloaded package contains the published 2024 city, candidate-name, office, vote, county, and readme files. The application extracts presidential returns and normalizes them into two machine-readable JSON artifacts:

- an 83-county presidential summary, approximately 38 KB;
- 4,413 normalized reporting-unit records, approximately 2.26 MB.

The normalization preserves all 5,664,186 presidential votes across 12 candidates. Geographic precincts, central-count units, and statistical adjustments remain explicitly distinguished. No non-geographic result is assigned to an invented precinct. The artifacts do not contain voter names, Qualified Voter File records, ballot images, or other personal information.

The planned use is to:

- host the normalized artifacts as part of a publicly accessible web application;
- display aggregate historical results and user-created counterfactual scenarios;
- allow a small external usability alpha to access the application;
- publish the application source code and derived data artifacts in a public GitHub repository;
- retain Michigan Bureau of Elections attribution, source links, retrieval dates, source checksums, and methodology notes;
- state clearly that the application is independent and is not endorsed by the State of Michigan.

The initial alpha is free and non-commercial. The public repository and demonstration may remain available after the study. I reviewed the statewide Michigan.gov Terms of Use and do not want to assume that the public availability of the election files authorizes redistribution. Could you please confirm one of the following in writing?

1. The Bureau grants permission for the described downloading, transformation, public display, and redistribution of these normalized election-result derivatives with attribution; or
2. A department-specific policy, license, or legal basis already governs this use, and you can identify it; or
3. Additional permission, conditions, or a different delivery method is required.

If permission is limited to non-commercial research and educational use, please state that limitation. If separate written permission would be required for future commercial use, please clarify that as well. Please also identify any required attribution or disclaimer language.

I can provide the exact schemas, checksums, repository link, or a private preview if that would help your review. I will not invite external testers using these artifacts until the delivery basis is documented.

Thank you,

[YOUR FULL NAME]
[ROLE OR ORGANIZATION, IF ANY; "Independent developer" is acceptable]
[REPLY EMAIL]
https://github.com/kevyisagenius123/election-sandbox-2
https://kevyisagenius123.github.io/election-sandbox-2/
```

## Submission procedure

1. Replace every bracketed field.
2. Attach no data unless the agency requests it.
3. Send from an address the project owner will continue monitoring.
4. Save the sent message and full response outside the public repository.
5. Record the send date, recipient, response date, scope, conditions, and decision in the tracker.
6. Do not infer approval from silence, an automated receipt, or a general statement that the results are public.
7. If a reply is ambiguous, respond with the exact public-hosting and redistribution question and request an explicit yes, no, or applicable policy.
8. If permission is denied or materially restricted, evaluate an approved replacement source or a participant build that excludes the affected detailed state.

## Follow-up cadence

- First follow-up: ten business days after submission.
- Second follow-up: ten business days after the first follow-up.
- After two unanswered follow-ups: retain the artifact exclusion and move to the replacement-delivery decision. Do not treat non-response as permission.

## Official references

- [Pennsylvania Department of State contact page](https://www.pa.gov/agencies/dos/contact-us)
- [Pennsylvania historical election data](https://www.pa.gov/agencies/dos/resources/voting-and-elections-resources/voting-and-election-statistics/election-data)
- [Michigan Bureau of Elections contact page](https://www.michigan.gov/sos/elections)
- [Michigan Bureau of Elections contact card](https://www.michigan.gov/-/media/Project/Websites/sos/01vanderroest/contact_us_new_card.pdf)
- [Michigan election results and data](https://www.michigan.gov/sos/elections/election-results-and-data)

This is an operational request package, not legal advice.
