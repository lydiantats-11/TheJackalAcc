/**
 * Pure helpers for the daily development report (scripts/daily-report.mjs). No network, no dependencies.
 * Rule: a check is reported as passed only when its log shows it ran on the commit being reported; anything else is
 * "not measured".
 */

const ANSI = /\u001b\[[0-9;]*m/g;
export const clean = (s) => String(s ?? "").replace(ANSI, "");

/** "Tests  248 passed (248)" / "Tests  3 failed | 232 passed (235)" → { passed, failed, total } or null. */
export function parseVitest(log) {
  const line = clean(log).split("\n").find((l) => /^\s*Tests\s/.test(l));
  if (!line) return null;
  const n = (re) => Number((line.match(re) ?? [])[1] ?? 0);
  const total = n(/\((\d+)\)/);
  if (!total) return null;
  return { passed: n(/(\d+) passed/), failed: n(/(\d+) failed/), total };
}

/** Number of TypeScript errors, or null when the log is empty (type check did not run). */
export function parseTypecheck(log) {
  const text = clean(log);
  if (!text.includes("tsc")) return null;
  return (text.match(/error TS\d+/g) ?? []).length;
}

/** "ok" | "failed" | null (not run). */
export function parseBuild(log) {
  const text = clean(log);
  if (!text.trim()) return null;
  if (/Compiled successfully/.test(text) && !/Failed to compile|Build error/i.test(text)) return "ok";
  return "failed";
}

/** The commit a CI results snapshot belongs to, from its commit subject "Design preview, run 30 (a724be8)". */
export function resultsCommit(subject) {
  return (String(subject).match(/\(([0-9a-f]{7,40})\)\s*$/) ?? [])[1] ?? null;
}

/** Overall status from what was measured and what is waiting. */
export function overallStatus({ tests, typecheck, build, measuredOnHead, decisions }) {
  if ((tests && tests.failed > 0) || (typecheck ?? 0) > 0 || build === "failed") return { status: "Blocked", why: "a check failed on the reported commit" };
  if (!measuredOnHead || !tests) return { status: "Attention needed", why: "checks were not measured on the latest commit" };
  if (decisions > 0) return { status: "Attention needed", why: `${decisions} decision(s) waiting for the owner` };
  return { status: "On track", why: "all checks passed on the latest commit and nothing is waiting" };
}

/** Sections "## Decisions needed" / "## Blockers" / "## Next" of docs/OPEN_DECISIONS.md as bullet lists. */
export function readSections(md) {
  const out = {};
  let cur = null;
  for (const line of String(md).split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) { cur = h[1].toLowerCase(); out[cur] = []; continue; }
    const b = line.match(/^\s*(?:-|\d+\.)\s+(.+)$/);
    if (cur && b) out[cur].push(b[1]);
  }
  return out;
}

export function renderReport(r) {
  const t = r.tests ? `${r.tests.passed}/${r.tests.total} passed${r.tests.failed ? `, ${r.tests.failed} failed` : ""}` : "not measured";
  const tc = r.typecheck === null ? "not measured" : `${r.typecheck} error${r.typecheck === 1 ? "" : "s"}`;
  const b = r.build ?? "not measured";
  const where = r.measuredOnHead ? `on ${r.head}` : r.resultsCommit ? `on ${r.resultsCommit} — **not the latest commit (${r.head})**` : "no CI results found";
  const q = r.quality
    ? `${r.quality.records} records; amount information ${r.quality.amount}%; official condition text ${r.quality.conditions}%; bilingual ${r.quality.bilingual}% (gold set ${r.quality.gold} — team-written, not independent)`
    : "not measured";
  const list = (xs, empty) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : `- ${empty}`);
  return `**JACKAL ACCOUNTANT — DAILY UPDATE**

**Date:** ${r.date}
**Branch / commit:** ${r.branch} / ${r.head}${r.since ? ` (changes since ${r.since})` : ""}

**Completed today**

${list(r.completed.slice(0, 5), "No commits since the previous report.")}${r.completed.length > 5 ? `\n- …and ${r.completed.length - 5} more commit(s)` : ""}

Areas changed: ${r.areas.length ? r.areas.join(", ") : "none"}

**Quality checks** (${where})

- Tests: ${t}
- Typecheck: ${tc}
- Build: ${b}
- Data-quality: ${q}

**Problems or blockers**

${list(r.blockers, "None recorded.")}

**Decisions needed**

${list(r.decisions, "None.")}

**Next recommended actions**

${list(r.next.slice(0, 3), "Not set — update docs/OPEN_DECISIONS.md.")}

**Overall status**

- ${r.overall.status} — ${r.overall.why}.
`;
}
