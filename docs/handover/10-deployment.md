# 10 — Deployment requirements

Nothing is deployed. The owner decides hosting, and nothing may be deployed to production without approval. This page
lists what a production setup needs; costs and the choice of providers are open.

## Components

| Component | Requirement | Prepared so far |
| --- | --- | --- |
| Web app | Node.js 22 host for Next.js 16 (serverless or container), EU region | `vercel.json` with region `fra1`; no project created |
| Database | PostgreSQL 15+, EU region, automated backups, point-in-time restore preferred | `docs/AUTOMATIC_UPDATES.md` suggests Neon (free tier) or Supabase |
| Worker | A scheduler for `npm run worker -- --once` (every 6 hours suggested) | `scheduled-updater.yml` (GitHub Actions, schedule commented out); must be on `main` to run |
| Secrets | `DATABASE_URL` and, later, email and AI keys | In GitHub Actions secrets or the host's secret store; never in the repository |
| Email (later) | Transactional email in the EU | Resend variables prepared; no flows built |
| Monitoring | Error reporting, uptime, worker heartbeats | `worker_heartbeats` table and `/api/health` exist; no alerting |

## Steps (suggested order)

1. Decide hosting and data location with the owner. Confirm the costs.
2. Create the production database and set up a least-privilege runtime role ([09](09-security-privacy.md) #1).
3. Run `npm run db:migrate` as owner, then `npm run db:seed` (categories and sources only; reject or delete the six
   synthetic examples in production).
4. Load the hand-checked records again **with production approvals**. The preview approvals do not carry over. This
   is where the admin content workflow ([11](11-backlog.md)) should replace dated SQL files.
5. Deploy the app, with `COOKIE_SECURE=true`, `TRUST_PROXY` set to match the host, and **no**
   `JACKAL_KNOWLEDGE_DRAFTS` or `JACKAL_KNOWLEDGE_FIXTURES`.
6. Test a backup restore. Set up error reporting.
7. Before inviting users: legal review, privacy notice and terms.
8. Turn on the EU updater only after the applicant classification exists. Until then imported calls stay hidden.

## Smoke test after deploy

- `/api/health` returns OK.
- The home page asks for a path; each path shows only its own programmes.
- 5Α shows «Υπό επιβεβαίωση», and 5Β shows its deadline only while confirmed.
- `/gnosi` says there is no published content yet, and `/gnosi/oros/LEX-0001` returns «not found».
