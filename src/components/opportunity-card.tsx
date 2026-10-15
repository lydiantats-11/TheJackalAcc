/** The one opportunity card used everywhere (home, listing, categories, For Me). */
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { SiteCopy } from "@/lib/site/copy";
import type { ListedOpportunity } from "@/lib/site/listing";
import { categoryBySlug, guideOf } from "@/lib/site/taxonomy";
import { formatDay } from "@/lib/format";
import { AvailabilityBadge, SyntheticLabel } from "./badges";
import { amountText, deadlineText } from "./opportunity-facts";

export function OpportunityCard({ item, t, s, locale, extra }: {
  item: ListedOpportunity; t: Dictionary; s: SiteCopy; locale: Locale; extra?: React.ReactNode;
}) {
  const o = item.row;
  const cat = categoryBySlug(item.categories[0]);
  const guide = guideOf(o);
  return (
    <article className="opp-card">
      <div className="tags">
        <AvailabilityBadge value={item.availability} t={t} />
        {cat && <span className="tag cat">{cat.name[locale]}</span>}
        <span className="tag">{s.supportType[item.support]}</span>
        <span className="tag navy">{s.scope[item.scope]}</span>
        {o.is_synthetic && <SyntheticLabel t={t} />}
      </div>
      <h3 lang={o.title_lang}><Link href={`/opportunities/${o.id}`}>{o.official_title}</Link></h3>
      <p className="authority">{o.publishing_authority}</p>
      {extra}
      <dl className="meta">
        <div><dt>{s.card.deadline}</dt><dd>{deadlineText(o, t, locale)}</dd></div>
        <div><dt>{s.card.amount}</dt><dd>{amountText(o, t, locale)}</dd></div>
      </dl>
      <div className="foot">
        <span>{s.card.checked}: {formatDay(o.last_verified_at, locale) ?? "—"}</span>
        {guide && <Link href={`/guides/${guide}`}>{s.opps.guide} →</Link>}
      </div>
    </article>
  );
}
