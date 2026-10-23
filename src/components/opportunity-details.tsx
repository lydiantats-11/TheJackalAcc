/**
 * "More details" on an opportunity (owner request, 15 Oct 2026): amount / budget, dates, conditions and steps,
 * shown ONLY from (a) the hand-checked record file (verified.ts) or (b) what the official source publishes in structured
 * form (opportunities.official_details). Nothing is estimated or filled in; missing values say so.
 * Display only — eligibility still comes from the engine and the imported requirements.
 */
import type { OpportunityRow } from "@/lib/data/opportunities";
import { normaliseDeadline } from "@/lib/domain/deadline";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import { verifiedFor, type VerifiedFacts } from "@/lib/site/verified";
import { isHandChecked } from "@/lib/site/provenance";
import { formatDate, formatDay } from "@/lib/format";
import { amountText } from "./opportunity-facts";
import { hasApplicantMoney, moneyOf, pctText, type Range } from "@/lib/site/money";
import { Icon } from "./icons";
import { cutoffDayMonth, moveYearRows, type MoveYearRule } from "@/lib/site/move-year";

const loc = (l: Locale) => (l === "el" ? "el-GR" : "en-GB");
const eur = (n: number, l: Locale, compact = false) =>
  new Intl.NumberFormat(loc(l), { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: compact ? 1 : 0, ...(compact ? { notation: "compact" as const } : {}) }).format(n);

/** A verified date string: "2026-10-05" (a day) or a full timestamp. */
function verifiedDate(v: string | null, l: Locale, tz: string | null): string | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDay(new Date(`${v}T12:00:00Z`), l, "UTC");
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : formatDate(d, l, tz ?? "Europe/Athens");
}

/** Every official submission date (current + other cut-offs), in order, read the same way the pipeline reads them. */
export function allCutoffs(o: OpportunityRow): Array<{ at: Date; dateOnly: boolean }> {
  const out: Array<{ at: Date; dateOnly: boolean }> = [];
  if (o.deadline_kind === "official" && o.closes_at) out.push({ at: o.closes_at, dateOnly: o.deadline_is_date_only });
  const extra = Array.isArray(o.additional_deadlines) ? o.additional_deadlines : [];
  const reading = { utcLabelIsLocalTime: o.official_details?.source === "eu-funding-tenders" };
  for (const x of extra) {
    const raw = typeof x === "string" ? x : x && typeof x === "object" && typeof (x as { at?: unknown }).at === "string" ? (x as { at: string }).at : null;
    const n = normaliseDeadline(raw, o.deadline_timezone, reading);
    if (n.closes_at && !out.some((d) => d.at.getTime() === n.closes_at!.getTime())) out.push({ at: n.closes_at, dateOnly: n.deadline_is_date_only });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

const rangeEur = (r: Range, l: Locale, s: SiteCopy, compact = false): string =>
  r.min !== null && r.max !== null
    ? (r.min === r.max ? eur(r.max, l, compact) : `${eur(r.min, l, compact)}–${eur(r.max, l, compact)}`)
    : r.max !== null ? `${s.card.money.upTo} ${eur(r.max, l, compact)}` : r.min !== null ? `${s.card.money.from} ${eur(r.min, l, compact)}` : "";

/**
 * Card "amount" cell (owner decision, 21 Oct 2026): what ONE applicant can get — verified benefit, subsidy rate with the
 * project expenditure range, or a stated grant amount. The programme budget (all projects together) is never shown on a
 * card; it stays on the detail page with its own label.
 */
export function cardAmount(o: OpportunityRow, t: Dictionary, s: SiteCopy, l: Locale): { label: string; value: React.ReactNode } {
  const v = verifiedFor(o.external_key);
  if (v?.benefit) return { label: s.card.benefit, value: <span className="clamp-3" title={v.benefit[l]}>{v.benefit[l]}</span> };
  const m = moneyOf(o);
  if (m.rate) {
    return { label: s.card.money.rate, value: <>{pctText(m.rate)}{m.projectBudget && <span className="xs muted" style={{ display: "block", fontWeight: 500 }}>{s.card.money[m.projectBudget.basis]}: {rangeEur(m.projectBudget, l, s)}</span>}
      {m.projectBudgetPending && <span className="xs muted" style={{ display: "block", fontWeight: 500 }} data-pending="project_budget">{s.card.money.project}: {s.card.money.pending}</span>}</> };
  }
  if (m.grant) return { label: s.card.money.grant, value: o.funding_amount_state === "known" ? amountText(o, t, l) : rangeEur(m.grant, l, s) };
  if (m.projectBudget) return { label: s.card.money[m.projectBudget.basis], value: rangeEur(m.projectBudget, l, s) };
  return { label: s.card.amount, value: <span className="muted" style={{ fontWeight: 500 }}>{s.card.amountNone}</span> };
}

/** Short amount for the key-information panel. */
export function keyAmount(o: OpportunityRow, t: Dictionary, s: SiteCopy, l: Locale): { label: string; value: React.ReactNode } {
  const c = cardAmount(o, t, s, l);
  const v = verifiedFor(o.external_key);
  return v?.benefit ? { label: c.label, value: v.benefit[l] } : c;
}

/**
 * «Τι παίρνετε» in the detail brief: what ONE applicant can get. A programme budget is never shown here (it is the
 * amount for all projects together); the subsidy rate or a stated grant is shown instead, else "see official source".
 */
export function briefWhat(o: OpportunityRow, t: Dictionary, s: SiteCopy, l: Locale): React.ReactNode {
  const v = verifiedFor(o.external_key);
  if (v?.benefit) return v.benefit[l];
  const m = moneyOf(o);
  if (m.grant) return o.funding_amount_state === "known" ? amountText(o, t, l) : rangeEur(m.grant, l, s);
  if (m.rate) return s.card.intensity(pctText(m.rate));
  if (m.projectBudget) return `${s.card.money[m.projectBudget.basis]}: ${rangeEur(m.projectBudget, l, s)}`;
  return s.card.amountNone;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div><dt>{k}</dt><dd>{children}</dd></div>;
}

/**
 * Deadline verification line (owner decision, 21 Oct 2026): when the deadline was last verified and on which document;
 * after the deadline, whether that check was before or after it. An extension is never assumed.
 */
export function DeadlineCheck({ o, s, locale }: { o: OpportunityRow; s: SiteCopy; locale: Locale }) {
  if (o.deadline_kind !== "official" || !o.closes_at || !o.last_verified_at) return null;
  const f = s.facts;
  const checked = isHandChecked(o);
  const gov = checked ? o.status_evidence?.governing_document : undefined;
  const passed = o.closes_at.getTime() < Date.now();
  return (
    <div className="xs muted" style={{ marginTop: 4 }} data-deadline-check>
      {checked ? f.deadlineChecked : s.card.retrieved}: {formatDay(o.last_verified_at, locale)}{gov ? ` · ${f.deadlineSource}: ${gov}` : ""}
      {passed && <div>{o.last_verified_at.getTime() < o.closes_at.getTime() ? f.passedBeforeCheck : f.passedAfterCheck}</div>}
    </div>
  );
}

/** The "Key facts" section of the detail page. */
export function KeyFacts({ o, s, locale, t }: { o: OpportunityRow; s: SiteCopy; locale: Locale; t: Dictionary }) {
  const f = s.facts;
  const v = verifiedFor(o.external_key);
  const d = o.official_details;
  const cutoffs = allCutoffs(o);
  const fmtCut = (c: { at: Date; dateOnly: boolean }) => (c.dateOnly ? formatDay(c.at, locale, o.deadline_timezone) : formatDate(c.at, locale, o.deadline_timezone));
  const tzNote = o.deadline_timezone === "Europe/Brussels" ? ` · ${s.card.brussels}` : "";
  const hasEu = !!d && (!!d.budget || !!d.action_type || !!d.submission || !!d.call || !!d.funding);
  const m = moneyOf(o);
  const isEuPortal = d?.source === "eu-funding-tenders";
  const deadlineNote = <DeadlineCheck o={o} s={s} locale={locale} />;

  if (!v && !hasEu && o.funding_amount_state !== "known") {
    return (
      <section id="details" className="card">
        <h2 style={{ marginTop: 0 }}>{f.title}</h2>
        <dl className="facts-grid">
          <Row k={f.deadline}>{cutoffs.length ? <>{cutoffs.map(fmtCut).join(" · ")}{tzNote}</> : o.deadline_kind === "rolling" ? f.openEnded : o.deadline_kind === "not_applicable" ? t.opp.deadlineNone : <span className="muted">{t.opp.deadlineUnknown}</span>}{deadlineNote}</Row>
          {o.opens_at && <Row k={f.opens}>{formatDay(o.opens_at, locale, o.deadline_timezone)}</Row>}
        </dl>
        <div className="notice small" style={{ marginTop: 12 }}><Icon name="info" size={18} /><span><strong>{f.noneTitle}.</strong> {f.none}</span></div>
      </section>
    );
  }

  return (
    <section id="details" className="card">
      <h2 style={{ marginTop: 0 }}>{f.title}</h2>
      <dl className="facts-grid">
        {v && (
          <>
            <Row k={f.benefit}>{v.benefit ? v.benefit[locale] : <span className="muted">{s.card.amountNone}</span>}
              {v.benefitState !== "verified" && <div className="xs muted" style={{ marginTop: 4 }}>{f.partial}</div>}</Row>
            <Row k={f.period}>
              {v.deadlineRule ? <span data-pending="move_year">{s.moveYear.inTable}</span>
                : o.status === "unverified" ? <span className="tag gold" data-pending="period">{s.card.money.pending}</span>
                : v.period.opens && v.period.closes ? <>{verifiedDate(v.period.opens, locale, v.period.timezone)} → {verifiedDate(v.period.closes, locale, v.period.timezone)}</>
                : v.period.closes ? <>{s.brief.until(verifiedDate(v.period.closes, locale, v.period.timezone) ?? "")}</>
                : v.period.opens ? <>{verifiedDate(v.period.opens, locale, v.period.timezone)} → {f.openEnded}</>
                : f.openEnded}
              {v.period.wording && <div className="xs muted" style={{ marginTop: 4 }}>{f.officialWording}: «{v.period.wording[locale]}»</div>}
              {deadlineNote}
            </Row>
          </>
        )}
        {!v && m.rate && <Row k={s.card.money.rate}>{pctText(m.rate)}{m.rate.note && <div className="xs muted" style={{ marginTop: 4 }}>{m.rate.note}</div>}</Row>}
        {!v && m.projectBudgetPending && <Row k={s.card.money.project}><span className="tag gold" data-pending="project_budget">{s.card.money.pending}</span><div className="xs muted" style={{ marginTop: 4 }}>{s.card.money.pendingNote}</div></Row>}
        {!v && m.projectBudget && <Row k={s.card.money[m.projectBudget.basis]}>{rangeEur(m.projectBudget, locale, s)}{m.projectBudget.note && <div className="xs muted" style={{ marginTop: 4 }}>{m.projectBudget.note}</div>}</Row>}
        {!v && m.grant && <Row k={s.card.money.grant}>{o.funding_amount_state === "known" ? amountText(o, t, locale) : rangeEur(m.grant, locale, s)}</Row>}
        {d?.budget && d.budget.total_eur > 0 && (
          <Row k={f.budget}>
            {eur(d.budget.total_eur, locale)}
            {Object.keys(d.budget.by_year).length > 1 && <div className="xs muted" style={{ marginTop: 4 }}>{Object.entries(d.budget.by_year).sort().map(([y, n]) => `${y}: ${eur(n, locale)}`).join(" · ")}</div>}
            {Object.keys(d.budget.by_year).length === 1 && <div className="xs muted" style={{ marginTop: 4 }}>{f.budgetYear} {Object.keys(d.budget.by_year)[0]}</div>}
            <div className="xs muted" style={{ marginTop: 4 }}>{f.budgetNote}</div>
          </Row>
        )}
        {d && isEuPortal && !m.grant && (
          <Row k={f.grantSize}>
            {d.budget?.min_grant_eur && d.budget.max_grant_eur
              ? (d.budget.min_grant_eur === d.budget.max_grant_eur ? eur(d.budget.max_grant_eur, locale) : <>{eur(d.budget.min_grant_eur, locale)} – {eur(d.budget.max_grant_eur, locale)}</>)
              : d.budget?.max_grant_eur ? <>{t.opp.upTo} {eur(d.budget.max_grant_eur, locale)}</>
              : <span className="muted">{f.notPublished}</span>}
          </Row>
        )}
        {d?.budget?.expected_grants ? <Row k={f.grants}>{d.budget.expected_grants}</Row> : null}
        {!v && <Row k={cutoffs.length > 1 ? f.cutoffs : f.deadline}>{cutoffs.length ? <>{cutoffs.map(fmtCut).join(" · ")}{tzNote}</> : o.deadline_kind === "rolling" ? f.openEnded : o.deadline_kind === "not_applicable" ? t.opp.deadlineNone : <span className="muted">{t.opp.deadlineUnknown}</span>}{deadlineNote}</Row>}
        {!v && (o.opens_at || d?.planned_opening) && <Row k={f.opens}>{o.opens_at ? formatDay(o.opens_at, locale, o.deadline_timezone) : verifiedDate(d!.planned_opening!.slice(0, 10), locale, null)}</Row>}
        {d?.submission && <Row k={f.submission}>{f.stages[d.submission] ?? d.submission}</Row>}
        {d?.action_type && <Row k={f.actionType}><span lang="en">{d.action_type}</span></Row>}
        {d?.call && <Row k={f.call}><span lang="en">{d.call.title ? `${d.call.title} · ` : ""}{d.call.identifier}</span></Row>}
      </dl>
      {v?.deadlineRule && <MoveYearDeadlines rule={v.deadlineRule} s={s} locale={locale} now={new Date()} />}
      {v && v.conflicts.length > 0 && (
        <div className="notice bad small" style={{ marginTop: 12 }}><Icon name="alert" size={18} /><div><strong>{f.conflicts}</strong>
          <ul style={{ margin: "4px 0 0" }}>{v.conflicts.map((c) => <li key={c.en}>{c[locale]}</li>)}</ul></div></div>
      )}
      <p className="xs muted" style={{ margin: "12px 0 0" }}>
        {v ? `${f.verifiedOn} ${verifiedDate(v.checkedOn, locale, null)}.` : d?.retrieved_at ? `${f.fromPortal} · ${f.retrieved} ${formatDay(new Date(d.retrieved_at), locale) ?? ""}.` : null}
      </p>
    </section>
  );
}

/** Official scope text (EU topics) for the overview section. */
export function OfficialScope({ o, s }: { o: OpportunityRow; s: SiteCopy }) {
  const sc = o.official_details?.scope_excerpt;
  if (!sc?.text) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div className="kpi-label">{s.facts.scope}</div>
      {s.lang === "el" && sc.lang === "en" && <p className="xs muted" style={{ margin: "0 0 6px" }}>{s.facts.originalOnly}</p>}
      <div lang={sc.lang} className="official-text">{sc.text.split("\n").map((p, i) => <p key={i}>{p}</p>)}</div>
      {sc.truncated && <p className="small" style={{ margin: 0 }}><a href={o.canonical_url} target="_blank" rel="noopener noreferrer">{s.facts.scopeMore} →</a></p>}
    </div>
  );
}

/** Official conditions block for the eligibility section. */
export function OfficialConditions({ o, s, locale }: { o: OpportunityRow; s: SiteCopy; locale: Locale }) {
  const f = s.facts;
  const v = verifiedFor(o.external_key);
  if (v && v.rules.length) return <VerifiedRules v={v} s={s} locale={locale} />;
  const d = o.official_details;
  if (!d || (!d.conditions?.length && !d.documents?.length)) return null;
  return (
    <div className="official-block">
      <div className="kpi-label">{f.conditionsTitle}</div>
      {d.conditions && d.conditions.length > 0 && (
        <ul className="checklist small" lang="en">{d.conditions.map((c) => <li key={c.heading}><Icon name="check" size={16} /><span><strong>{c.heading}</strong>{c.text ? `: ${c.text}` : ""}</span></li>)}</ul>
      )}
      {d.documents && d.documents.length > 0 && (
        <p className="small" style={{ margin: "8px 0 0" }}>{f.documents}: {d.documents.map((doc, i) => <span key={doc.url}>{i > 0 && " · "}<a href={doc.url} target="_blank" rel="noopener noreferrer" lang="en">{doc.label}</a></span>)}</p>
      )}
      <p className="xs muted" style={{ margin: "8px 0 0" }}>{f.conditionsNote}</p>
    </div>
  );
}

function VerifiedRules({ v, s, locale }: { v: VerifiedFacts; s: SiteCopy; locale: Locale }) {
  return (
    <div className="official-block">
      <div className="kpi-label">{s.facts.rulesTitle}</div>
      <ul className="checklist small">
        {v.rules.map((r) => (
          <li key={r.label.en}><Icon name="check" size={16} /><span>{r.label[locale]}
            {r.quote && <details className="quote"><summary>{s.facts.quote}</summary><blockquote>«{r.quote}»</blockquote></details>}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Verified application steps, for the "How to apply" section. */
export function VerifiedSteps({ o, s, locale }: { o: OpportunityRow; s: SiteCopy; locale: Locale }) {
  const v = verifiedFor(o.external_key);
  if (!v || !v.steps[locale]?.length) return null;
  return (
    <>
      <div className="kpi-label">{s.facts.stepsTitle}</div>
      <ol className="steps-list small">{v.steps[locale].map((st) => <li key={st}>{st}</li>)}</ol>
    </>
  );
}

/**
 * Deadlines by year of move (5Α, 5Β; owner, 23 Oct 2026): application, supporting documents and period of application
 * kept apart, one row per year of move, from the rule recorded once (move-year.ts). No single date is shown as everyone's.
 */
export function MoveYearDeadlines({ rule, s, locale, now }: { rule: MoveYearRule; s: SiteCopy; locale: Locale; now: Date }) {
  const c = s.moveYear;
  const { day, month } = cutoffDayMonth(rule);
  const cut = `${day}/${month}`;
  const day_ = (d: Date) => formatDay(d, locale, rule.timezone) ?? "";
  const rows = moveYearRows(rule, now);
  return (
    <div className="move-year" data-move-year>
      <p className="small" style={{ margin: "0 0 8px" }}>{c.lead}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="table small">
          <thead><tr><th scope="col">{c.moved}</th><th scope="col">{c.application}</th><th scope="col">{c.documents}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.moveYear}-${r.part}`} data-move-row={`${r.moveYear}-${r.part}`}>
                <th scope="row">{r.part === "by_cutoff" ? c.byCutoff(cut, r.moveYear) : c.afterCutoff(cut, r.moveYear)}</th>
                <td>{r.windows.map((w, i) => (
                  <div key={w.year} data-window={w.state}>
                    {i > 0 && <span className="muted">{c.or} </span>}
                    {w.state === "previous_rules" ? <>{c.inYear(w.year)}: <span className="muted">{c.previousRules}</span></>
                      : <>{c.inYear(w.year)}: {c.until(day_(w.applicationBy))} <span className={w.state === "passed" ? "tag" : "tag green"}>{w.state === "passed" ? c.passed : c.open}</span></>}
                  </div>
                ))}</td>
                <td>{r.windows.map((w) => w.state === "previous_rules" ? null : <div key={w.year}>{c.until(day_(w.documentsBy))}</div>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xs muted" style={{ margin: "8px 0 0" }}>
        <strong>{c.regime}:</strong> {c.regimeYears(rule.regime.years)}{rule.regime.start ? `, ${rule.regime.start[locale]}` : ` · ${c.startUnconfirmed}`}.
        {" "}{c.basis}: {rule.basis[locale]}. {c.later}
      </p>
    </div>
  );
}
