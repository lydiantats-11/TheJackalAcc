# Switching on automatic updates (EU Funding & Tenders)

Prepared on 14 Oct 2026; **off until the owner approves hosting**. Recommended setup: GitHub Actions + a Neon free
Postgres in an EU region. The updater is `.github/workflows/scheduled-updater.yml`; it has three locks.

| Step | Who | What |
| --- | --- | --- |
| 1 | Owner | Create a Neon project (EU region, e.g. Frankfurt) and copy its connection string |
| 2 | Owner | GitHub → TheJackalAcc → Settings → Secrets and variables → Actions → New secret `DATABASE_URL` (never paste it in chat or code) |
| 3 | Owner / Claude | Actions → "Scheduled updater (off)" → Run workflow. First run creates the tables (migrations) and changes nothing else |
| 4 | Owner | Seed sources once: `DATABASE_URL=… npm run db:seed` (also adds 6 clearly labelled synthetic examples) |
| 5 | Owner | Enable the EU source: `UPDATE sources SET enabled = true, lifecycle = 'active' WHERE slug = 'eu-funding-tenders';` |
| 6 | Owner | Uncomment the `schedule:` lines in the workflow (every 6 hours) |

Before step 6, run the live test once more (Actions → "Live connector test" → Run workflow) and check its report on the
`live-test-results` branch.

To pause: Actions → "Scheduled updater" → ⋯ → Disable workflow. Nothing is deleted.

Known limits (free plan): GitHub may delay scheduled runs; in a public repository GitHub disables schedules after
60 days without repository activity; Neon's free compute sleeps after 5 minutes idle and wakes on the next run.
