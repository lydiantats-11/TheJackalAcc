#!/usr/bin/env node
/**
 * Daily development report — run by hand; never scheduled from the repository (Workstream F).
 *
 *   node scripts/daily-report.mjs [--results <dir>] [--since <commit>] [--date YYYY-MM-DD] [--dry-run]
 *
 * --results  a folder with the latest CI output (tests.log, typecheck.log, build.log, quality-report.json), e.g. a
 *            checkout of the live-test-results branch: git clone --depth 1 -b live-test-results <repo> ltr
 *            → --results ltr/previews/latest. Without it every check is "not measured".
 * --since    commit to report changes from; default: the commit recorded in the newest report in reports/daily/.
 * Writes reports/daily/<date>.md (the archive keeps every report) and prints it. Decisions, blockers and next actions
 * come from docs/OPEN_DECISIONS.md, the single source of truth for project status.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { overallStatus, parseBuild, parseTypecheck, parseVitest, readSections, renderReport, resultsCommit } from "./report-lib.mjs";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");

const ARCHIVE = "reports/daily";
const date = typeof args.date === "string" ? args.date : new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
const head = git("rev-parse", "--short", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");

// Changes since the previous report (or the last 24 hours when there is none).
let since = typeof args.since === "string" ? args.since : null;
if (!since && existsSync(ARCHIVE)) {
  const last = readdirSync(ARCHIVE).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f !== `${date}.md`).sort().pop();
  since = last ? (read(join(ARCHIVE, last)).match(/<!-- commit: ([0-9a-f]+) -->/) ?? [])[1] ?? null : null;
}
const range = since ? [`${since}..HEAD`] : ["--since=24 hours ago"];
const completed = git("log", ...range, "--no-merges", "--format=%s").split("\n").filter(Boolean);
const files = git("diff", "--name-only", since ? since : "HEAD@{24 hours ago}", "HEAD").split("\n").filter(Boolean);
const areas = [...new Set(files.map((f) => f.split("/").slice(0, f.startsWith("src/") ? 3 : 1).join("/")))].sort();

// CI results — only counted as measured when they belong to HEAD.
const dir = typeof args.results === "string" ? args.results : null;
let ciCommit = null;
if (dir) {
  try { ciCommit = resultsCommit(execFileSync("git", ["-C", dir, "log", "-1", "--format=%s"], { encoding: "utf8" })); } catch { ciCommit = null; }
}
const measuredOnHead = !!ciCommit && head.startsWith(ciCommit.slice(0, 7));
const tests = dir ? parseVitest(read(join(dir, "tests.log"))) : null;
const typecheck = dir ? parseTypecheck(read(join(dir, "typecheck.log"))) : null;
const build = dir ? parseBuild(read(join(dir, "build.log"))) : null;
let quality = null;
try {
  const q = JSON.parse(read(join(dir ?? "", "quality-report.json")));
  quality = { records: q.coverage.records, amount: q.coverage.amount_information_pct, conditions: q.coverage.official_conditions_pct,
    bilingual: q.coverage.bilingual_pct, gold: `${q.accuracy.passed}/${q.accuracy.cases}` };
} catch { quality = null; }

const s = readSections(read("docs/OPEN_DECISIONS.md"));
const decisions = s["decisions needed"] ?? [];
const report = renderReport({
  date, branch, head, since, completed, areas, measuredOnHead, resultsCommit: ciCommit,
  tests: measuredOnHead ? tests : null, typecheck: measuredOnHead ? typecheck : null, build: measuredOnHead ? build : null,
  quality: measuredOnHead ? quality : null,
  blockers: s["blockers"] ?? [], decisions, next: s["next"] ?? [],
  overall: overallStatus({ tests: measuredOnHead ? tests : null, typecheck: measuredOnHead ? typecheck : null, build: measuredOnHead ? build : null, measuredOnHead, decisions: decisions.length }),
}) + `\n<!-- commit: ${head} -->\n`;

if (!args["dry-run"]) {
  mkdirSync(ARCHIVE, { recursive: true });
  writeFileSync(join(ARCHIVE, `${date}.md`), report);
}
process.stdout.write(report);
