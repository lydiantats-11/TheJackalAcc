import { geographyOf, type OpportunityRow } from "@/lib/data/opportunities";
import { geographyKind } from "@/lib/domain/requirements";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { formatDate, formatMoney, zoneLabel } from "@/lib/format";

export function deadlineText(o: OpportunityRow, t: Dictionary, locale: Locale) {
  if (o.deadline_kind === "rolling") return <>{t.opp.deadlineRolling}</>;
  if (o.deadline_kind === "not_applicable") return <>{t.opp.deadlineNone}</>;
  if (o.deadline_kind !== "official" || !o.closes_at) return <span className="unknown">{t.opp.deadlineUnknown}</span>;
  // 5Α / 5Β: the next deadline, never one date for everyone (owner, 23 Oct 2026).
  if (o.deadline_rule === "move_year")
    return <>{locale === "el" ? "Επόμενη: " : "Next: "}{new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", { dateStyle: "medium", timeZone: o.deadline_timezone }).format(o.closes_at)} <span className="muted small">· {locale === "el" ? "ανάλογα με το έτος μεταφοράς" : "depends on the year you moved"}</span></>;
  if (o.deadline_is_date_only)
    return <>{new Intl.DateTimeFormat(locale === "el" ? "el-GR" : "en-GB", { dateStyle: "medium", timeZone: o.deadline_timezone }).format(o.closes_at)} <span className="muted small">· {zoneLabel(o.deadline_timezone, locale)}</span></>;
  return <>{formatDate(o.closes_at, locale, o.deadline_timezone)} <span className="muted small">· {zoneLabel(o.deadline_timezone, locale)}</span></>;
}

export function amountText(o: OpportunityRow, t: Dictionary, locale: Locale) {
  if (o.funding_amount_state !== "known") return <span className="unknown">{t.opp.amountUnknown}</span>;
  const cur = o.currency ?? "EUR";
  const min = formatMoney(o.funding_min, locale, cur);
  const max = formatMoney(o.funding_max, locale, cur);
  if (min && max) return <>{min} – {max}</>;
  if (max) return <>{t.opp.upTo} {max}</>;
  return <>{t.opp.from} {min}</>;
}

export function OpportunityFacts({ o, t, locale }: { o: OpportunityRow; t: Dictionary; locale: Locale }) {
  const geo = geographyKind(geographyOf(o));
  return (
    <dl className="facts">
      <div><dt>{t.opp.deadline}</dt><dd>{deadlineText(o, t, locale)}</dd></div>
      <div><dt>{t.opp.type}</dt><dd className={o.opportunity_type === "unknown" ? "unknown" : undefined}>{t.type[o.opportunity_type] ?? o.opportunity_type}</dd></div>
      <div><dt>{t.opp.amount}</dt><dd>{amountText(o, t, locale)}</dd></div>
      <div><dt>{t.opp.geography}</dt><dd className={geo === "unknown" ? "unknown" : undefined}>{t.geo[geo]}</dd></div>
      {o.official_identifier && <div><dt>{t.ui.identifier}</dt><dd>{o.official_identifier}</dd></div>}
    </dl>
  );
}
