/** The one opportunity card used everywhere (home, listing, categories, For Me). */
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import type { ListedOpportunity } from "@/lib/site/listing";
import { categoryBySlug, guideOf } from "@/lib/site/taxonomy";
import { formatDate, formatDay } from "@/lib/format";
import { AvailabilityBadge, SyntheticLabel } from "./badges";
import { cardAmount } from "./opportunity-details";
import { displayAuthority, displayTitle } from "@/lib/site/verified";

/** Short deadline for cards: date (and time when stated), naming Brussels time only when it applies. */
function cardDeadline(o: ListedOpportunity["row"], t: Dictionary, s: SiteCopy, locale: Locale) {
  if (o.deadline_kind === "rolling") return <>{t.opp.deadlineRolling}</>;
  if (o.deadline_kind === "not_applicable") return <>{t.opp.deadlineNone}</>;
  if (o.deadline_kind !== "official" || !o.closes_at) return <span className="muted">{t.opp.deadlineUnknown}</span>;
  const when = o.deadline_is_date_only ? formatDay(o.closes_at, locale, o.deadline_timezone) : formatDate(o.closes_at, locale, o.deadline_timezone);
  return <>{when}{o.deadline_timezone === "Europe/Brussels" ? <span className="muted"> · {s.card.brussels}</span> : null}</>;
}

export function OpportunityCard({ item, t, s, locale, extra }: {
  item: ListedOpportunity; t: Dictionary; s: SiteCopy; locale: Locale; extra?: React.ReactNode;
}) {
  const o = item.row;
  const cat = categoryBySlug(item.categories[0]);
  const guide = guideOf(o);
  const title = displayTitle(o, locale);
  const amount = cardAmount(o, t, s, locale);
  return (
    <article className="opp-card">
      <div className="tags">
        <AvailabilityBadge value={item.availability} t={t} />
        {cat && <span className="tag cat" title={cat.name[locale]}>{cat.name[locale]}</span>}
        <span className="tag navy">{s.scope[item.scope]}</span>
        {o.is_synthetic && <SyntheticLabel t={t} />}
      </div>
      <h3 lang={title.lang}><Link href={`/opportunities/${o.id}`}>{title.text}</Link></h3>
      <p className="authority">{displayAuthority(o, locale)}</p>
      {extra}
      <dl className="meta">
        <div><dt>{s.card.deadline}</dt><dd>{cardDeadline(o, t, s, locale)}</dd></div>
        <div><dt>{amount.label}</dt><dd>{amount.value}</dd></div>
      </dl>
      <div className="foot">
        <span>{s.card.checked}: {formatDay(o.last_verified_at, locale) ?? "—"}</span>
        {guide && <Link href={`/guides/${guide}`}>{s.opps.guide} →</Link>}
      </div>
    </article>
  );
}
