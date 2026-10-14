import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { getOpportunity, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { currentUser } from "@/lib/auth/session";
import { getProfile, listSavedIds } from "@/lib/data/user";
import { assess } from "@/lib/domain/eligibility";
import { runScenario, type Scenario } from "@/lib/domain/scenarios";
import { estimateAward } from "@/lib/domain/funding";
import { formatDate } from "@/lib/format";
import { AvailabilityBadge, EligibilityBadge, StateBadge, SyntheticLabel } from "@/components/badges";
import { OpportunityFacts } from "@/components/opportunity-facts";
import { RequirementsTable } from "@/components/requirements-table";
import { toggleSaveAction } from "@/app/actions";

const SCENARIO_KINDS = ["register_business", "establish_in_region", "increase_cofinancing", "change_project_start", "obtain_dypa_registration"] as const;

function buildScenario(kind: string, regions: string[], now: Date): Scenario | null {
  const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000).toISOString().slice(0, 10);
  switch (kind) {
    case "register_business": return { kind, legal_form: "sole_proprietor", registration_date: inDays(30) };
    case "establish_in_region": return regions[0] ? { kind, region: regions[0] } : null;
    case "increase_cofinancing": return { kind, range: "over_50k" };
    case "change_project_start": return { kind, start_date: inDays(90) };
    case "obtain_dypa_registration": return { kind };
    default: return null;
  }
}

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const { t, locale } = await getDict();
  if (!isDatabaseConfigured()) return <div className="notice bad">{t.noDb}</div>;
  const { id } = await params;
  const o = await getOpportunity(sql(), id);
  if (!o) notFound();
  const user = await currentUser();
  const [profile, savedIds, reqMap] = await Promise.all([
    user ? getProfile(sql(), user) : Promise.resolve(null),
    user ? listSavedIds(sql(), user) : Promise.resolve([] as string[]),
    loadRequirements(sql(), [o.id]),
  ]);
  const now = new Date();
  const matchable = toMatchable(o, reqMap.get(o.id) ?? []);
  const a = assess(matchable, profile ?? {}, { now });
  const regionReq = matchable.requirements.find((r) => r.category === "geography" || r.category === "business_location");
  const regions = ((regionReq?.value as { regions?: string[] } | undefined)?.regions ?? []).filter((r) => r.length > 2);
  const scenarioKind = (await searchParams).scenario;
  const scenario = user && profile && scenarioKind ? buildScenario(scenarioKind, regions, now) : null;
  const sr = scenario ? runScenario(matchable, profile!, scenario, now) : null;
  const budget = typeof profile?.project_budget_eur === "number" ? profile.project_budget_eur : null;
  const estimate = budget !== null && o.funding_intensity_pct !== null
    ? estimateAward({ eligible_expenditure: budget, intensity_pct: Number(o.funding_intensity_pct), min_award: o.funding_min ? Number(o.funding_min) : null, max_award: o.funding_max ? Number(o.funding_max) : null, currency: o.currency ?? "EUR" })
    : null;

  return (
    <article className="stack">
      <div className="row"><AvailabilityBadge value={a.availability} t={t} />{o.is_synthetic && <SyntheticLabel t={t} />}</div>
      <h1 lang={o.title_lang}>{o.official_title}</h1>
      {o.is_synthetic && <div className="notice">{t.synthetic}.</div>}
      {o.has_conflict && <div className="notice bad" role="alert">{t.ui.conflict}</div>}

      <section className="card">
        <div className="section-label sl-official">{t.opp.sectionFacts}</div>
        <p className="small muted" style={{ marginTop: 0 }}>{t.opp.sectionFactsNote}</p>
        <OpportunityFacts o={o} t={t} locale={locale} />
        <dl className="facts">
          <div><dt>{t.opp.authority}</dt><dd>{o.publishing_authority ?? <span className="unknown">{t.opp.deadlineUnknown}</span>}</dd></div>
          {o.programme && <div><dt>{t.ui.programme}</dt><dd>{o.programme}</dd></div>}
          {o.funding_intensity_pct && <div><dt>{t.opp.intensity}</dt><dd>{Number(o.funding_intensity_pct)}%</dd></div>}
          <div><dt>{t.ui.freshness}</dt><dd>{formatDate(o.last_verified_at, locale) ?? <span className="unknown">{t.opp.never}</span>}{o.source_name ? ` · ${o.source_name}` : ""}</dd></div>
        </dl>
        {o.deadline_original_text && (
          <p className="small muted">{t.ui.originalDeadline}: <code>{o.deadline_original_text}</code>{o.deadline_is_date_only ? ` — ${t.ui.dateOnly}` : ""}</p>
        )}
        <div className="row" style={{ marginTop: 14 }}>
          <a className="btn btn-primary btn-sm" href={o.canonical_url} target="_blank" rel="noopener noreferrer">{t.opp.official} ↗</a>
          {o.application_url && <a className="btn btn-ghost btn-sm" href={o.application_url} target="_blank" rel="noopener noreferrer">{t.opp.apply} ↗</a>}
          {user && (
            <form action={toggleSaveAction}>
              <input type="hidden" name="opportunity_id" value={o.id} />
              <button className="btn btn-ghost btn-sm">{savedIds.includes(o.id) ? t.opp.unsave : t.opp.save}</button>
            </form>
          )}
        </div>
      </section>

      {o.summary_plain && (
        <section className="card">
          <div className="section-label sl-ai">{t.opp.sectionSummary}</div>
          <p className="small muted" style={{ marginTop: 0 }}>{o.summary_origin === "ai" ? t.opp.summaryAi : t.opp.summaryAdmin}</p>
          <p>{o.summary_plain}</p>
        </section>
      )}

      <section className="card">
        <div className="section-label sl-score">{t.opp.sectionMatch}</div>
        <p className="small muted" style={{ marginTop: 0 }}>{t.opp.sectionMatchNote}</p>
        {!user ? <p><Link href="/login">{t.opp.loginForMatch}</Link></p> : (
          <>
            <div className="row" style={{ marginBottom: 10 }}>
              <EligibilityBadge status={a.eligibility} t={t} />
              <span className="badge b-plain">{t.opp.relevance}: {a.relevance_score ?? "—"}/100</span>
              <span className="badge b-plain">{t.opp.coverage}: {Math.round(a.evidence_coverage * 100)}%</span>
              <span className="badge b-plain">{t.opp.unresolved}: {a.unresolved_count}</span>
            </div>
            {a.questions.length > 0 && (
              <div className="notice info" style={{ marginBottom: 12 }}>
                {t.opp.questions} {a.questions.map((q) => t.question[q] ?? q).join(" · ")} <Link href={`/profile?ask=${a.questions.join(",")}`}>{t.opp.answerInProfile} →</Link>
              </div>
            )}
          </>
        )}
        {user && a.obligations.length > 0 && (
          <div className="notice info" style={{ marginBottom: 12 }}>
            <strong>{t.obligations.title}</strong>
            <ul className="small" style={{ margin: "6px 0 0" }}>{a.obligations.map((ob) => <li key={ob}>{t.obligations[ob] ?? ob}</li>)}</ul>
          </div>
        )}
        {o.requirement_set_completeness !== "complete" && <p className="small notice">{t.ui.requirementsIncomplete}</p>}
        <div className="section-label sl-unverified" style={{ marginTop: 10 }}>{t.opp.sectionRequirements}</div>
        <RequirementsTable results={a.results} t={t} />
        <p className="small muted">{t.opp.authorityDecides}</p>
      </section>

      {estimate && (
        <section className="card">
          <div className="section-label sl-score">{t.ui.estimate}</div>
          <p className="small muted" style={{ marginTop: 0 }}>{t.ui.estimateNote}</p>
          <p className="kpi">{estimate.estimated_award !== null ? new Intl.NumberFormat(locale === "el" ? "el-GR" : "en-GB", { style: "currency", currency: estimate.currency }).format(estimate.estimated_award) : "—"}</p>
          <details><summary>{t.ui.howCalculated}</summary>
            <p className="small">{t.ui.formula}: <code>{estimate.formula}</code></p>
            <ul className="small">{estimate.steps.map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="small muted">{estimate.rounding}</p>
          </details>
        </section>
      )}

      {user && (
        <section className="card">
          <div className="section-label sl-ai">{t.ui.scenarios}</div>
          <form className="row">
            <select name="scenario" defaultValue={scenarioKind ?? ""} aria-label={t.ui.scenarios} style={{ maxWidth: 420 }}>
              <option value="">—</option>
              {SCENARIO_KINDS.filter((k) => k !== "establish_in_region" || regions.length > 0).map((k) => <option key={k} value={k}>{t.scenario[k]}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm">{t.ui.run}</button>
          </form>
          {sr && (
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="notice info">{t.ui.scenarioNote}</div>
              <div className="row">
                <span className="small">{t.ui.permissible}</span>
                <span className={`badge ${sr.permissible === "no" ? "b-bad" : sr.permissible === "yes" ? "b-ok" : "b-warn"}`}>{t.ui[sr.permissible]}</span>
                <EligibilityBadge status={sr.outcome.eligibility} t={t} hypothetical />
              </div>
              {sr.permissibility_reasons.length > 0 && <ul className="small">{sr.permissibility_reasons.map((r) => <li key={r}>{t.scenario.reasons[r] ?? r}</li>)}</ul>}
              <div><strong className="small">{t.ui.changes}</strong>
                {sr.changes.length === 0 ? <p className="small muted">{t.ui.none}</p> : (
                  <ul className="small">{sr.changes.map((c) => <li key={c.requirement_key}>{t.criterion[c.category] ?? c.category}: <StateBadge state={c.from} t={t} /> → <StateBadge state={c.to} t={t} /></li>)}</ul>
                )}</div>
              {sr.evidence_needed.length > 0 && <div><strong className="small">{t.ui.evidenceNeeded}</strong><ul className="small">{sr.evidence_needed.map((e) => <li key={e}>{e.replaceAll("_", " ")}</li>)}</ul></div>}
              {sr.remaining_blockers.length > 0 && <div><strong className="small">{t.ui.blockers}</strong>
                <ul className="small">{sr.remaining_blockers.map((b) => <li key={b.requirement_key}><StateBadge state={b.state} t={t} /> {b.original_text}</li>)}</ul></div>}
            </div>
          )}
        </section>
      )}
    </article>
  );
}
