/** The one opportunity card used everywhere (home, listing, categories, For Me). */
import Link from "next/link";
import { isHandChecked } from "@/lib/site/provenance";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import type { ListedOpportunity } from "@/lib/site/listing";
import { categoryBySlug, guideOf } from "@/lib/site/taxonomy";
import { formatDate, formatDay } from "@/lib/format";
import { RecordStatusBadge, SyntheticLabel } from "./badges";
import { cardAmount } from "./opportunity-details";
import { displayAuthority, displayTitle } from "@/lib/site/verified";
import { TimeLeftPill } from "./brief";
import { paths } from "@/lib/site/audience";

/** Short deadline for cards: date (and time when stated), naming Brussels time only when it applies. */
function cardDeadline(o: ListedOpportunity["row"], t: Dictionary, s: SiteCopy, locale: Locale) {
  if (o.deadline_kind === "rolling") return <>{t.opp.deadlineRolling}</>;
  if (o.deadline_kind === "not_applicable") return <>{t.opp.deadlineNone}</>;
  if (o.deadline_kind !== "official" || !o.closes_at) return <span className="muted">{t.opp.deadlineUnknown}</span>;
  const when = o.deadline_is_date_only ? formatDay(o.closes_at, locale, o.deadline_timezone) : formatDate(o.closes_at, locale, o.deadline_timezone);
  return <>{when}{o.deadline_timezone === "Europe/Brussels" ? <span className="muted"> · {s.card.brussels}</span> : null}</>;
}

/**
 * Honest provenance line: hand-checked records say «Ελέγχθηκε», records imported automatically from an official portal
 * say «Ανακτήθηκε», test records say they were not checked. A retrieval date is never presented as a human check.
 */
export function checkedLine(o: Pick<ListedOpportunity["row"], "external_key" | "is_synthetic" | "last_verified_at"> & { publication_basis?: string | null }, s: SiteCopy, locale: Locale): string {
  if (o.is_synthetic) return s.card.syntheticDate;
  const day = formatDay(o.last_verified_at, locale) ?? "—";
  return `${isHandChecked(o) ? s.card.checked : s.card.retrieved}: ${day}`;
}

export function OpportunityCard({ item, t, s, locale, extra }: {
  item: ListedOpportunity; t: Dictionary; s: SiteCopy; locale: Locale; extra?: React.ReactNode;
}) {
  const o = item.row;
  const cat = categoryBySlug(item.categories[0]);
  const guide = guideOf(o);
  const title = displayTitle(o, locale);
  const amount = cardAmount(o, t, s, locale);
  // Listings only ever contain records of one path (loadListing), so the record's own path is the page's path.
  const aud = o.audience ?? "citizen";
  return (
    <article className="opp-card">
      <div className="card-status"><RecordStatusBadge record={item.record} s={s} locale={locale} /><TimeLeftPill input={{ record: item.record, closesAt: o.closes_at, opensAt: o.opens_at, deadlineKind: o.deadline_kind, hasGuide: !!guide }} s={s} locale={locale} now={new Date()} /></div>
      <h3 lang={title.lang}><Link href={paths.opportunity(aud, o.id)}>{title.text}</Link></h3>
      {title.codeOnly && <p className="xs muted" style={{ margin: "-6px 0 0" }}>{s.card.codeOnly}</p>}
      <div className="tags">
        {cat && <span className="tag cat">{cat.name[locale]}</span>}
        {item.support !== "unconfirmed" && <span className="tag">{s.supportType[item.support]}</span>}
        {locale === "el" && title.lang === "en" && <span className="tag en" lang="el">{s.card.inEnglish}</span>}
        {o.is_synthetic && <SyntheticLabel t={t} />}
      </div>
      <p className="authority">{[displayAuthority(o, locale), s.scope[item.scope]].filter(Boolean).join(" · ")}</p>
      {extra}
      <dl className="meta">
        <div><dt>{s.card.deadline}</dt><dd>{cardDeadline(o, t, s, locale)}</dd></div>
        <div><dt>{amount.label}</dt><dd>{amount.value}</dd></div>
      </dl>
      <div className="foot">
        <span>{checkedLine(o, s, locale)}</span>
        {guide && <Link href={paths.guide(aud, guide)}>{s.opps.guide} →</Link>}
      </div>
    </article>
  );
}
