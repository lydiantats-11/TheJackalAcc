/**
 * Quality report (core capability 5: independently validated improvements in accuracy, coverage and efficiency).
 * Reproducible baseline, measured on a database — never asserted:
 *   1. Accuracy: the engine against the gold-standard cases (data/gold/*.json), written from the official conditions.
 *   2. Coverage: share of approved, real records with an official deadline, amount information, structured
 *      requirements, complete requirement sets, official conditions.
 *   3. Freshness and integrity: stale, unverified, conflicting records; detected changes.
 *   4. Efficiency: ingestion runs — items per second, and processing time per item.
 * Read-only. Usage: npx tsx scripts/quality-report.ts > quality-report.json   (DATABASE_URL must be set)
 */
import "./load-env";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { listOpportunities, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { availabilityOf, assess, RULE_VERSION } from "@/lib/domain/eligibility";
import { OUTCOME_CERTAINTY, OUTCOME_CLASS } from "@/lib/domain/decision-record";
import type { MatchProfile } from "@/lib/domain/profile";
import { verifiedFor } from "@/lib/site/verified";

interface GoldCase { id: string; record: string; profile: MatchProfile; expected: { class: string; certainty?: string }; basis: string }

const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const now = new Date();
  try {
    // ── 1. accuracy on the gold set ──
    const gold = JSON.parse(readFileSync(new URL("../data/gold/eligibility-gold-2026-10-15.json", import.meta.url), "utf8")) as { version: string; cases: GoldCase[] };
    const rows = await listOpportunities(sql, { limit: 5000 });
    const byKey = new Map(rows.filter((r) => r.external_key).map((r) => [r.external_key!, r]));
    const reqs = await loadRequirements(sql, rows.map((r) => r.id));
    const results = gold.cases.map((c) => {
      const row = byKey.get(c.record);
      if (!row) return { id: c.id, record: c.record, status: "record_missing" as const };
      const a = assess(toMatchable(row, reqs.get(row.id) ?? []), c.profile, { now });
      const got = { class: OUTCOME_CLASS[a.eligibility], certainty: OUTCOME_CERTAINTY[a.eligibility], status: a.eligibility };
      const ok = got.class === c.expected.class && (!c.expected.certainty || got.certainty === c.expected.certainty);
      return { id: c.id, record: c.record, status: ok ? ("pass" as const) : ("fail" as const), expected: c.expected, got, basis: c.basis };
    });
    const scored = results.filter((r) => r.status !== "record_missing");
    const passed = scored.filter((r) => r.status === "pass").length;
    const byClass: Record<string, { cases: number; correct: number }> = {};
    for (const r of scored) {
      if (!("expected" in r) || !r.expected) continue;
      const k = r.expected.class;
      byClass[k] = byClass[k] ?? { cases: 0, correct: 0 };
      byClass[k].cases++;
      if (r.status === "pass") byClass[k].correct++;
    }

    // ── 2. coverage ──
    const real = rows.filter((r) => !r.is_synthetic);
    const all = real.map((r) => ({ r, n: (reqs.get(r.id) ?? []).length }));
    const has = (f: (x: (typeof all)[number]) => boolean) => all.filter(f).length;
    const amountInfo = (x: (typeof all)[number]) => !!verifiedFor(x.r.external_key)?.benefit || x.r.funding_amount_state === "known" || (x.r.official_details?.budget?.total_eur ?? 0) > 0;
    const coverage = {
      records: real.length,
      official_deadline_or_rolling_pct: pct(has((x) => (x.r.deadline_kind === "official" && !!x.r.closes_at) || x.r.deadline_kind === "rolling"), real.length),
      amount_information_pct: pct(has(amountInfo), real.length),
      per_project_amount_pct: pct(has((x) => !!verifiedFor(x.r.external_key)?.benefit || x.r.funding_amount_state === "known" || !!x.r.official_details?.budget?.max_grant_eur), real.length),
      structured_requirements_pct: pct(has((x) => x.n > 0), real.length),
      complete_requirement_set_pct: pct(has((x) => x.r.requirement_set_completeness === "complete"), real.length),
      official_conditions_pct: pct(has((x) => (x.r.official_details?.conditions?.length ?? 0) > 0 || (verifiedFor(x.r.external_key)?.rules.length ?? 0) > 0), real.length),
      bilingual_pct: pct(has((x) => !!verifiedFor(x.r.external_key)), real.length),
    };

    // ── 3. freshness and integrity ──
    const avail = real.map((r) => availabilityOf(toMatchable(r, []), now));
    const count = (v: string) => avail.filter((a) => a === v).length;
    const [ev] = await sql<{ details_changes: number; conflicts: number; status_unverified: number }[]>`
      SELECT count(*) FILTER (WHERE event_type = 'official_details_changed')::int AS details_changes,
             count(*) FILTER (WHERE event_type = 'conflict_detected')::int AS conflicts,
             count(*) FILTER (WHERE event_type = 'status_unverified')::int AS status_unverified
      FROM opportunity_events`;
    const freshness = {
      stale_pct: pct(count("stale"), real.length),
      unverified_pct: pct(count("unverified") + count("deadline_passed_unconfirmed"), real.length),
      conflicting_pct: pct(count("conflicting_information"), real.length),
      events: ev,
    };

    // ── 4. efficiency ──
    const runs = await sql<{ source: string; seconds: number; items_seen: number; items_new: number; items_changed: number; status: string }[]>`
      SELECT s.slug AS source, EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::float AS seconds, r.items_seen, r.items_new, r.items_changed, r.status
      FROM ingestion_runs r JOIN sources s ON s.id = r.source_id
      WHERE r.finished_at IS NOT NULL ORDER BY r.started_at DESC LIMIT 10`;
    const efficiency = runs.map((r) => ({ ...r, seconds: Math.round(r.seconds * 10) / 10, items_per_second: r.seconds > 0 ? Math.round((r.items_seen / r.seconds) * 10) / 10 : null, ms_per_item: r.items_seen > 0 ? Math.round((r.seconds * 1000) / r.items_seen) : null }));

    console.log(JSON.stringify({
      generated_at: now.toISOString(),
      engine_version: RULE_VERSION,
      gold_set: gold.version,
      accuracy: { cases: gold.cases.length, scored: scored.length, passed, accuracy_pct: pct(passed, scored.length), by_expected_class: byClass, missing_records: results.filter((r) => r.status === "record_missing").map((r) => r.record) },
      coverage,
      freshness,
      efficiency,
      failures: results.filter((r) => r.status === "fail"),
      caveat: "Baseline from a small gold set written by the platform team; not independently validated. Do not publish as an accuracy claim.",
    }, null, 2));
  } finally {
    await sql.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
