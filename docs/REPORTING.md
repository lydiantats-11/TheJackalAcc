# Daily development report

One command, run by hand (Workstream F). It is never scheduled from the repository and sends nothing.

```bash
# 1. Get the latest CI results (tests, type check, build, quality report) from GitHub
git clone -q --depth 1 -b live-test-results https://github.com/lydiantats-11/TheJackalAcc.git /tmp/ltr
# 2. Write today's report to reports/daily/<date>.md and print it
node scripts/daily-report.mjs --results /tmp/ltr/previews/latest
```

Options: `--since <commit>` (default: the commit stamped in the previous report, so unchanged work is not repeated),
`--date YYYY-MM-DD`, `--dry-run` (print only).

**How it stays honest**

- Tests, type check, build and data-quality figures are read from the CI logs and reported only when those logs belong to
  the commit being reported; otherwise the report says **not measured** and the status becomes "Attention needed".
- Run the CI first: push the commit to the `preview` branch (`git push -f gh consolidation:preview`) and wait for the
  "Design preview" workflow; the results then appear on `live-test-results`.
- Decisions, blockers and next actions come from `docs/OPEN_DECISIONS.md` — the single source of truth. Update it when
  something is decided.
- The gold-set figure is labelled as team-written, never as independent accuracy.
- No secrets or personal data are read; the report contains commit subjects, folder names and CI figures only.

Archive: every report stays in `reports/daily/`. Helpers and their tests: `scripts/report-lib.mjs`,
`tests/daily-report.test.ts`.

Note: separately, the owner asked on 16 Oct for a daily progress doc in Claude at about 22:00; that scheduled task runs
outside the repository, only reads, and can be switched off by the owner (listed under "Decisions needed").
