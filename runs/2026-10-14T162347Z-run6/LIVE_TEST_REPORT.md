# Live connector test — EU Funding & Tenders

- Started: 2026-10-14T16:22:48Z on GitHub Actions (`Linux 6.17.0-1022-azure`), commit `83f062b4a482619ad3efedb07a0e034f1f089f32`
- Endpoint: `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA` (undocumented, public)
- Database: throwaway PostgreSQL 16, deleted when the job ends. No real users or personal data.

| Check | Result | Evidence |
|---|---|---|
| 1. Retrieval from the official source | ✅ pass | exit 0, status `succeeded`, 999 new records |
| 2. Parsing and classification | ✅ pass | 999 records: 409 current (next deadline ahead), 590 listed by the portal after their last deadline → unverified; 0 synthetic / non-official / wrong-status; 999 with a deadline, all with original wording. e.g. CEF-DIG-2026-CABLE-REPAIR-CAPACITIES-WORKS, CEF-E-2023-PCI-STUDIES, CEF-E-2023-PCI-WORKS |
| 3. Evidence-based storage in PostgreSQL | ✅ pass | 999 source documents; every record has field evidence with an official URL; run row has start, finish, counts, connector version |
| 4. Duplicate detection / safe repeat import | ✅ pass | before 999, after 999; run 2: new 0, changed 0, unchanged 999, wrongly unverified 0; 0 duplicate keys; listing run1 {"rows":1000,"total":1000} run2 {"rows":1000,"total":1000} |
| 5. Amendment / deadline change (SIMULATED) | ✅ pass | deadline falsified +30 days locally; run 3 restored the official `2027-02-23 23:00:00+00`, version 1 → 2, 2 version rows kept; run 3 changed 1 in total, wrongly unverified 0 |
| 6. Display in Ευκαιρίες | ✅ pass | list page 200, record `CEF-DIG-2026-CABLE-REPAIR-CAPACITIES-WORKS` page 200 with its official europa.eu link; screenshots attached |
| 7a. Source freshness recorded | ✅ pass | last_success_at set; lifecycle `tested` |
| 7b. Failure reporting | ✅ pass | exit 1, status `failed`, error `Error: host resolves to a non-public address: api.tech.ec.europa.eu`, failures 0 → 1; no record closed or changed |

Step 5 is a simulated amendment: one stored deadline was falsified locally and the live source corrected it.
Step 7b made the official host unreachable on the test machine only (hosts file); the portal itself was not affected.

**Result: all checks passed on live data**
