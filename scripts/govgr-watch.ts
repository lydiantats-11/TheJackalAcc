/**
 * One manual run of the gov.gr new-service watcher (no schedule). Usage:
 *   tsx scripts/govgr-watch.ts <out-dir> [previous-snapshot.json]
 * Writes snapshot.json (baseline for the next run), review.json and report.md. Creates no opportunities.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { safeFetch, withRetry } from "../src/lib/sources/fetcher";
import { diffSnapshots, parseSitemap, reviewList, robotsAllows, snapshotOf, type Snapshot } from "../src/lib/sources/watchers/govgr-sitemap";

const [out = "govgr-watch-output", prevPath] = process.argv.slice(2);
const policy = {
  allowedHosts: ["gov.gr"], timeoutMs: 30_000, maxBytes: 20 * 1024 * 1024,
  userAgent: `JackalAccountantWatcher/0.1 (+mailto:${process.env.MONITOR_CONTACT_EMAIL ?? "jackal-accountant-test@users.noreply.github.com"})`,
};

async function main() {
  mkdirSync(out, { recursive: true });
  const robots = (await withRetry(() => safeFetch("https://www.gov.gr/robots.txt", policy))).value.body.toString("utf8");
  for (const p of ["/sitemap.xml", "/el/services/"]) if (!robotsAllows(robots, p)) throw new Error(`robots.txt disallows ${p} — stopping`);
  const res = (await withRetry(() => safeFetch("https://www.gov.gr/sitemap.xml", policy))).value;
  const entries = parseSitemap(res.body.toString("utf8"));
  const snap = snapshotOf(entries, res.fetchedAt);
  const prev: Snapshot | null = prevPath && existsSync(prevPath) ? JSON.parse(readFileSync(prevPath, "utf8")) : null;
  const diff = diffSnapshots(prev, snap);
  const review = reviewList(snap, diff);
  writeFileSync(`${out}/snapshot.json`, JSON.stringify(snap));
  writeFileSync(`${out}/review.json`, JSON.stringify({ taken_at: snap.taken_at, first_run: diff.first_run, added: diff.added.length, removed: diff.removed.length, review }, null, 2));
  const lines = [
    `# gov.gr watcher — manual run ${snap.taken_at}`, "",
    `- robots.txt: sitemap and /el/services/ allowed`,
    `- Sitemap entries: ${entries.length}; Greek service pages: ${snap.services.length}; with <lastmod>: ${entries.filter((e) => e.lastmod).length}`,
    diff.first_run ? `- First run: no previous snapshot, so nothing is "new" yet. Below: the newest ${review.length} service pages for review.` : `- Since ${prev!.taken_at}: ${diff.added.length} new, ${diff.removed.length} removed service pages.`,
    "", "| id | page | hints (for sorting only) |", "| --- | --- | --- |",
    ...review.map((r) => `| ${r.id} | [${r.slug}](${r.url}) | ${r.hints.join(", ") || "—"} |`),
    "", "Nothing here is published. Each page is a candidate for a person to read and check.",
  ];
  writeFileSync(`${out}/report.md`, lines.join("\n"));
  console.log(lines.slice(0, 6).join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
