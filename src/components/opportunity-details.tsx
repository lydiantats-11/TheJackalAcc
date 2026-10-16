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
import { formatDate, formatDay } from "@/lib/format";
import { amountText } from "./opportunity-facts";
import { Icon } from "./icons";

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

/** Card "amount" cell: verified benefit → official call budget → per-applicant amount → "see official source". */
export function cardAmount(o: OpportunityRow, t: Dictionary, s: SiteCopy, l: Locale): { label: string; value: React.ReactNode } {
  const v = verifiedFor(o.external_key);
  if (v?.benefit) return { label: s.card.benefit, value: <span className="clamp-2" title={v.benefit[l]}>{v.benefit[l]}</span> };
  if (o.funding_amount_state === "known") return { label: s.card.amount, value: amountText(o, t, l) };
  const b = o.official_details?.budget;
  if (b && b.total_eur > 0) return { label: s.card.budget, value: <>{eur(b.total_eur, l, true)}</> };
  return { label: s.card.amount, value: <span className="muted" style={{ fontWeight: 500 }}>{s.card.amountNone}</span> };
}

/** Short amount for the key-information panel. */
export function keyAmount(o: OpportunityRow, t: Dictionary, s: SiteCopy, l: Locale): { label: string; value: React.ReactNode } {
  const c = cardAmount(o, t, s, l);
  const v = verifiedFor(o.external_key);
  return v?.benefit ? { label: c.label, value: v.benefit[l] } : c;
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div><dt>{k}</dt><dd>{children}</dd></div>;
}

/** The "Key facts" section of the detail page. */
export function KeyFacts({ o, s, locale, t }: { o: OpportunityRow; s: SiteCopy; locale: Locale; t: Dictionary }) {
  const f = s.facts;
  const v = verifiedFor(o.external_key);
  const d = o.official_details;
  const cutoffs = allCutoffs(o);
  const fmtCut = (c: { at: Date; dateOnly: boolean }) => (c.dateOnly ? formatDay(c.at, locale, o.deadline_timezone) : formatDate(c.at, locale, o.deadline_timezone));
  const tzNote = o.deadline_timezone === "Europe/Brussels" ? ` · ${s.card.brussels}` : "";
  const hasEu = !!d && (!!d.budget || !!d.action_type || !!d.submission || !!d.call);

  if (!v && !hasEu && o.funding_amount_state !== "known") {
    return (
      <section id="details" className="card">
        <h2 style={{ marginTop: 0 }}>{f.title}</h2>
        <dl className="facts-grid">
          <Row k={f.deadline}>{cutoffs.length ? <>{cutoffs.map(fmtCut).join(" · ")}{tzNote}</> : o.deadline_kind === "rolling" ? f.openEnded : <span className="muted">{t.opp.deadlineUnknown}</span>}</Row>
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
              {v.period.opens || v.period.closes ? (
                <>{verifiedDate(v.period.opens, locale, v.period.timezone) ?? "—"} → {verifiedDate(v.period.closes, locale, v.period.timezone) ?? f.openEnded}</>
              ) : f.openEnded}
              {v.period.wording && <div className="xs muted" style={{ marginTop: 4 }}>{f.officialWording}: «{v.period.wording[locale]}»</div>}
            </Row>
          </>
        )}
        {!v && o.funding_amount_state === "known" && <Row k={f.grantSize}>{amountText(o, t, locale)}</Row>}
        {d?.budget && d.budget.total_eur > 0 && (
          <Row k={f.budget}>
            {eur(d.budget.total_eur, locale)}
            {Object.keys(d.budget.by_year).length > 1 && <div className="xs muted" style={{ marginTop: 4 }}>{Object.entries(d.budget.by_year).sort().map(([y, n]) => `${y}: ${eur(n, locale)}`).join(" · ")}</div>}
            {Object.keys(d.budget.by_year).length === 1 && <div className="xs muted" style={{ marginTop: 4 }}>{f.budgetYear} {Object.keys(d.budget.by_year)[0]}</div>}
            <div className="xs muted" style={{ marginTop: 4 }}>{f.budgetNote}</div>
          </Row>
        )}
        {d && hasEu && (
          <Row k={f.grantSize}>
            {d.budget?.min_grant_eur && d.budget.max_grant_eur
              ? (d.budget.min_grant_eur === d.budget.max_grant_eur ? eur(d.budget.max_grant_eur, locale) : <>{eur(d.budget.min_grant_eur, locale)} – {eur(d.budget.max_grant_eur, locale)}</>)
              : d.budget?.max_grant_eur ? <>{t.opp.upTo} {eur(d.budget.max_grant_eur, locale)}</>
              : <span className="muted">{f.notPublished}</span>}
          </Row>
        )}
        {d?.budget?.expected_grants ? <Row k={f.grants}>{d.budget.expected_grants}</Row> : null}
        {!v && <Row k={cutoffs.length > 1 ? f.cutoffs : f.deadline}>{cutoffs.length ? <>{cutoffs.map(fmtCut).join(" · ")}{tzNote}</> : o.deadline_kind === "rolling" ? f.openEnded : <span className="muted">{t.opp.deadlineUnknown}</span>}</Row>}
        {!v && (o.opens_at || d?.planned_opening) && <Row k={f.opens}>{o.opens_at ? formatDay(o.opens_at, locale, o.deadline_timezone) : verifiedDate(d!.planned_opening!.slice(0, 10), locale, null)}</Row>}
        {d?.submission && <Row k={f.submission}>{f.stages[d.submission] ?? d.submission}</Row>}
        {d?.action_type && <Row k={f.actionType}><span lang="en">{d.action_type}</span></Row>}
        {d?.call && <Row k={f.call}><span lang="en">{d.call.title ? `${d.call.title} · ` : ""}{d.call.identifier}</span></Row>}
      </dl>
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
