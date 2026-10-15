# Private live preview — setup (owner steps)

Decided 15 Oct 2026: a private, password-protected live version on free services, so the full app can be tried
(sign-in, «Για Εμένα», search, filters). Nothing here is paid. The scheduled updater stays **off**: EU calls are
imported once, with the date shown, and are not refreshed automatically.

| Piece | Service | Cost | Where |
| --- | --- | --- | --- |
| Database | Neon (PostgreSQL), free plan | €0, no card | AWS Europe Central (Frankfurt) |
| App | Vercel, Hobby plan | €0, no card | Functions in Frankfurt (`vercel.json` → `fra1`) |
| Password | The app's own gate (`SITE_PASSWORD`, `src/proxy.ts`) | — | Every page; hidden from search engines |

Vercel's Hobby plan is for personal, non-commercial use. A private prototype that earns nothing fits; once Jackal
Accountant is offered to the public or earns money, it needs a paid plan or a different host. The password gate works
on any host, so moving later only means repeating step 3 elsewhere (for example Render's free web service in Frankfurt).

## 1. Database (about 5 minutes)

1. Sign up at neon.tech (GitHub sign-in works). Create a project named `jackal-accountant`, region **AWS Europe Central 1 (Frankfurt)**.
2. On the project dashboard, choose **Connect** and copy the connection string (the "pooled" one is fine). It starts with `postgresql://`.
   Treat it like a password: don't paste it into chat, documents or the repository.

## 2. Fill the database (about 5 minutes, done by GitHub)

1. In GitHub, open `lydiantats-11/TheJackalAcc` → **Settings → Secrets and variables → Actions → New repository secret**.
   Name: `LIVE_DATABASE_URL`. Value: the connection string from step 1. Secrets are never shown in logs, even in a public repository.
2. **Actions → "Set up live database (manual)" → Run workflow** (branch `consolidation`, leave "import EU calls" ticked).
   It creates the tables, adds the sources, imports the 8 hand-checked records and records your approval of 15 Oct 2026
   (`db/seed/approvals-2026-10-15.sql`), hides the demo records, and imports the EU Funding & Tenders calls once.
   It is safe to run again.

## 3. App (about 10 minutes)

1. Sign up at vercel.com with GitHub and **Add New → Project → import `TheJackalAcc`**. Framework: Next.js (detected).
2. Before the first deploy, add these **Environment Variables**:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string |
   | `SITE_PASSWORD` | a password you choose (share it only with people you invite) |
   | `APP_BASE_URL` | `https://<your-project>.vercel.app` (fill in after the first deploy, then redeploy) |
   | `COOKIE_SECURE` | `true` |
   | `TRUST_PROXY` | `true` |
   | `AI_EXTRACTION_ENABLED` | `false` |
   | `MONITOR_CONTACT_EMAIL` | an address you read |

3. **Settings → Git → Production Branch**: `consolidation`. Deploy.
4. Open the `.vercel.app` address. The browser asks for a user name (anything) and the password.

## Before inviting anyone

- **Made-up profiles only.** Accounts work, but the privacy, GDPR and database-permission review has not been done yet.
  Nobody should enter a real ΑΦΜ, income, tax-residency details or documents. A short note to testers is enough for now.
- **Data is dated, not live.** EU calls are as imported in step 2; the updater is off until you approve it.
- **To take it offline:** Vercel → project → Settings → delete (or pause) the project; Neon → delete the project.
