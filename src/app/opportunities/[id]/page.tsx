import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { getOpportunity, loadHistory, loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { ChangeHistory } from "@/components/change-history";
import { currentUser } from "@/lib/auth/session";
import { getProfile, listSavedIds } from "@/lib/data/user";
import { assess } from "@/lib/domain/eligibility";
import { runScenario, type Scenario } from "@/lib/domain/scenarios";
import { estimateAward } from "@/lib/domain/funding";
import { formatDay } from "@/lib/format";
import { SITE } from "@/lib/site/copy";
import { audiencesOf, categoriesOf, categoryBySlug, guideOf, scopeOf, supportTypeOf } from "@/lib/site/taxonomy";
import { AvailabilityBadge, EligibilityBadge, StateBadge, SyntheticLabel } from "@/components/badges";
import { deadlineText } from "@/components/opportunity-facts";
import { RequirementsTable } from "@/components/requirements-table";
import { DecisionRecordView } from "@/components/decision-record";
import { buildDecisionRecord } from "@/lib/domain/decision-record";
import { KeyFacts, OfficialConditions, OfficialScope, VerifiedSteps, keyAmount } from "@/components/opportunity-details";
import { displayTitle, verifiedFor } from "@/lib/site/verified";
import { Icon } from "@/components/icons";
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
  const s = SITE[locale];
  if (!isDatabaseConfigured()) return <div className="container"><div className="notice bad">{t.noDb}</div></div>;
  const { id } = await params;
  const o = await getOpportunity(sql(), id);
  if (!o) notFound();
  const user = await currentUser();
  const [profile, savedIds, reqMap, history] = await Promise.all([
    user ? getProfile(sql(), user) : Promise.resolve(null),
    user ? listSavedIds(sql(), user) : Promise.resolve([] as string[]),
    loadRequirements(sql(), [o.id]),
    loadHistory(sql(), o.id).catch(() => []),
  ]);
  const now = new Date();
  const matchable = toMatchable(o, reqMap.get(o.id) ?? []);
  const a = assess(matchable, profile ?? {}, { now });
  const record = user && profile ? buildDecisionRecord(matchable, profile, { now }) : null;
  const regionReq = matchable.requirements.find((r) => r.category === "geography" || r.category === "business_location");
  const regions = ((regionReq?.value as { regions?: string[] } | undefined)?.regions ?? []).filter((r) => r.length > 2);
  const scenarioKind = (await searchParams).scenario;
  const scenario = user && profile && scenarioKind ? buildScenario(scenarioKind, regions, now) : null;
  const sr = scenario ? runScenario(matchable, profile!, scenario, now) : null;
  const budget = typeof profile?.project_budget_eur === "number" ? profile.project_budget_eur : null;
  const estimate = budget !== null && o.funding_intensity_pct !== null
    ? estimateAward({ eligible_expenditure: budget, intensity_pct: Number(o.funding_intensity_pct), min_award: o.funding_min ? Number(o.funding_min) : null, max_award: o.funding_max ? Number(o.funding_max) : null, currency: o.currency ?? "EUR" })
    : null;

  const cats = categoriesOf(o).map((c) => categoryBySlug(c)).filter((c) => !!c);
  const audiences = audiencesOf(o);
  const scope = scopeOf(o);
  const guide = guideOf(o);
  const saved = savedIds.includes(o.id);
  const title = displayTitle(o, locale);
  const verified = verifiedFor(o.external_key);
  const amount = keyAmount(o, t, s, locale);

  return (
    <div className="container">
      <nav className="crumbs" aria-label="breadcrumb">
        <Link href="/opportunities">{s.detail.back}</Link>
        {cats[0] && <> / <Link href={`/opportunities?cat=${cats[0].slug}`}>{cats[0].name[locale]}</Link></>}
      </nav>
      <header className="detail-head">
        <div className="tags" style={{ marginBottom: 12 }}>
          <AvailabilityBadge value={a.availability} t={t} />
          {cats.map((c) => <span key={c.slug} className="tag cat">{c.name[locale]}</span>)}
          <span className="tag">{s.supportType[supportTypeOf(o.opportunity_type)]}</span>
          <span className="tag navy">{s.scope[scope]}</span>
          {o.is_synthetic && <SyntheticLabel t={t} />}
        </div>
        <h1 lang={title.lang}>{title.text}</h1>
        {title.text !== o.official_title && <p className="small muted" style={{ margin: "0 0 4px" }} lang={o.title_lang}>{o.official_title}</p>}
        <p className="muted" style={{ margin: 0 }}>{o.publishing_authority}{o.official_identifier ? ` · ${o.official_identifier}` : ""}</p>
      </header>
      {o.is_synthetic && <div className="notice" style={{ marginBottom: 16 }}>{t.synthetic}.</div>}
      {o.has_conflict && <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>{t.ui.conflict}</div>}

      <div className="with-aside-r">
        <div>
          <nav className="toc" aria-label={s.detail.overview}>
            <a href="#overview">{s.detail.overview}</a>
            <a href="#details">{s.facts.title}</a>
            <a href="#eligibility">{s.detail.eligibility}</a>
            <a href="#apply">{s.detail.howToApply}</a>
            <a href="#sources">{s.detail.sources}</a>
            <a href="#history">{s.history.title}</a>
          </nav>

          <div className="stack-lg">
            <section id="overview" className="card">
              <div className="section-label sl-official">{t.opp.sectionFacts}</div>
              {verified ? (
                <>
                  <p style={{ fontSize: "1.05rem" }}>{verified.summary[locale]}</p>
                  <p className="xs muted" style={{ margin: 0 }}>{t.opp.summaryAdmin}</p>
                </>
              ) : o.summary_plain ? (
                <>
                  <p style={{ fontSize: "1.05rem" }}>{o.summary_plain}</p>
                  <p className="xs muted" style={{ margin: 0 }}>{o.summary_origin === "ai" ? t.opp.summaryAi : t.opp.summaryAdmin}</p>
                </>
              ) : !o.official_details?.scope_excerpt ? <p className="muted" style={{ margin: 0 }}>{t.opp.sectionFactsNote}</p> : null}
              <OfficialScope o={o} s={s} />
            </section>

            <KeyFacts o={o} s={s} locale={locale} t={t} />

            <section id="eligibility" className="card">
              <div className="section-label sl-score">{t.opp.sectionMatch}</div>
              <p className="small muted" style={{ marginTop: 0 }}>{t.opp.sectionMatchNote}</p>
              <OfficialConditions o={o} s={s} locale={locale} />
              {!user ? (
                <div className="notice info"><Icon name="user" size={18} /><span>{s.detail.saveHint} <Link href="/login">{t.nav.login}</Link> · <Link href="/register">{t.nav.register}</Link></span></div>
              ) : (
                <>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <EligibilityBadge status={a.eligibility} t={t} />
                    <span className="badge b-plain">{t.opp.relevance}: {a.relevance_score ?? "—"}/100</span>
                    <span className="badge b-plain">{t.opp.coverage}: {Math.round(a.evidence_coverage * 100)}%</span>
                    <span className="badge b-plain">{t.opp.unresolved}: {a.unresolved_count}</span>
                  </div>
                  {a.questions.length > 0 && (
                    <div className="notice info" style={{ marginBottom: 12 }}>
                      <Icon name="info" size={18} />
                      <span>{t.opp.questions} {a.questions.map((q) => t.question[q] ?? q).join(" · ")} <Link href={`/profile?ask=${a.questions.join(",")}`}>{t.opp.answerInProfile} →</Link></span>
                    </div>
                  )}
                </>
              )}
              {user && a.obligations.length > 0 && (
                <div className="notice info" style={{ marginBottom: 12 }}>
                  <div><strong>{t.obligations.title}</strong>
                    <ul className="small" style={{ margin: "6px 0 0" }}>{a.obligations.map((ob) => <li key={ob}>{t.obligations[ob] ?? ob}</li>)}</ul></div>
                </div>
              )}
              {o.requirement_set_completeness !== "complete" && <div className="notice small" style={{ marginBottom: 12 }}><Icon name="alert" size={18} /><span>{t.ui.requirementsIncomplete}</span></div>}
              <div className="section-label sl-unverified" style={{ marginTop: 10 }}>{t.opp.sectionRequirements}</div>
              <RequirementsTable results={a.results} t={t} copy={s.detail.req} />
              {record && <DecisionRecordView record={record} s={s} t={t} opportunityId={o.id} />}
              <p className="small muted" style={{ marginBottom: 0 }}>{t.opp.authorityDecides}</p>
            </section>

            {estimate && (
              <section className="card">
                <div className="section-label sl-score">{t.ui.estimate}</div>
                <p className="small muted" style={{ marginTop: 0 }}>{t.ui.estimateNote}</p>
                <p className="kpi">{estimate.estimated_award !== null ? new Intl.NumberFormat(locale === "el" ? "el-GR" : "en-GB", { style: "currency", currency: estimate.currency }).format(estimate.estimated_award) : "—"}</p>
                <details><summary>{t.ui.howCalculated}</summary>
                  <p className="small">{t.ui.formula}: <code>{estimate.formula}</code></p>
                  <ul className="small">{estimate.steps.map((st) => <li key={st}>{st}</li>)}</ul>
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

            <section id="apply" className="card">
              <h2 style={{ marginTop: 0 }}>{s.detail.howToApply}</h2>
              <VerifiedSteps o={o} s={s} locale={locale} />
              <p>{s.detail.applySteps}</p>
              <div className="row">
                <a className="btn btn-primary" href={o.application_url ?? o.canonical_url} target="_blank" rel="noopener noreferrer">{o.application_url ? t.opp.apply : t.opp.official} <Icon name="external" size={16} /></a>
                {guide && <Link className="btn btn-ghost" href={`/guides/${guide}`}><Icon name="book" size={16} />{s.detail.guideCta}</Link>}
              </div>
            </section>

            <section id="sources" className="card">
              <h2 style={{ marginTop: 0 }}>{s.detail.sources}</h2>
              <ul className="checklist small">
                <li><Icon name="shield" size={16} /><span><a href={o.canonical_url} target="_blank" rel="noopener noreferrer">{o.canonical_url}</a></span></li>
                {verified?.sources.filter((src) => src.url !== o.canonical_url).map((src) => (
                  <li key={src.url}><Icon name="shield" size={16} /><span><a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a> <span className="muted">· {s.card.checked} {formatDay(new Date(`${src.checkedOn}T12:00:00Z`), locale, "UTC")}</span></span></li>
                ))}
                {o.official_details?.documents?.map((doc) => (
                  <li key={doc.url}><Icon name="book" size={16} /><span><a href={doc.url} target="_blank" rel="noopener noreferrer" lang="en">{doc.label}</a></span></li>
                ))}
                {o.application_url && o.application_url !== o.canonical_url && <li><Icon name="external" size={16} /><span><a href={o.application_url} target="_blank" rel="noopener noreferrer">{o.application_url}</a></span></li>}
                <li><Icon name="calendar" size={16} /><span>{t.ui.freshness}: {formatDay(o.last_verified_at, locale) ?? <span className="unknown">{t.opp.never}</span>}{o.source_name ? ` · ${o.source_name}` : ""}</span></li>
                {o.deadline_original_text && <li><Icon name="info" size={16} /><span>{t.ui.originalDeadline}: <code>{o.deadline_original_text}</code>{o.deadline_is_date_only ? ` — ${t.ui.dateOnly}` : ""}</span></li>}
              </ul>
            </section>

            <ChangeHistory entries={history} s={s} locale={locale} />
          </div>
        </div>

        <aside className="sticky stack">
          <div className="card keyinfo">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{s.detail.keyInfo}</h2>
            <dl>
              <div><dt>{t.opp.deadline}</dt><dd>{deadlineText(o, t, locale)}</dd></div>
              <div><dt>{amount.label}</dt><dd>{amount.value}</dd></div>
              <div><dt>{s.opps.type}</dt><dd>{s.supportType[supportTypeOf(o.opportunity_type)]}</dd></div>
              {cats.length > 0 && <div><dt>{s.detail.category}</dt><dd>{cats.map((c) => c.name[locale]).join(", ")}</dd></div>}
              {audiences.length > 0 && <div><dt>{s.detail.forWhom}</dt><dd>{audiences.map((p) => t.opt.personas[p] ?? p).join(", ")}</dd></div>}
              <div><dt>{s.opps.scope}</dt><dd>{s.scope[scope]}</dd></div>
              <div><dt>{t.opp.authority}</dt><dd>{o.publishing_authority ?? <span className="unknown">{t.opp.deadlineUnknown}</span>}</dd></div>
              {o.funding_intensity_pct && <div><dt>{t.opp.intensity}</dt><dd>{Number(o.funding_intensity_pct)}%</dd></div>}
              <div><dt>{s.card.checked}</dt><dd>{formatDay(o.last_verified_at, locale) ?? "—"}</dd></div>
            </dl>
            <div className="stack" style={{ marginTop: 16 }}>
              <a className="btn btn-primary btn-block" href={o.canonical_url} target="_blank" rel="noopener noreferrer">{t.opp.official} <Icon name="external" size={16} /></a>
              {user ? (
                <form action={toggleSaveAction}>
                  <input type="hidden" name="opportunity_id" value={o.id} />
                  <button className="btn btn-ghost btn-block"><Icon name="bookmark" size={16} />{saved ? t.opp.unsave : t.opp.save}</button>
                </form>
              ) : <Link className="btn btn-ghost btn-block" href="/login"><Icon name="bookmark" size={16} />{t.opp.save}</Link>}
            </div>
          </div>
          {(cats.length > 0 || audiences.length > 0) && <p className="xs muted" style={{ padding: "0 4px" }}>{s.opps.indicative}</p>}
        </aside>
      </div>
    </div>
  );
}
