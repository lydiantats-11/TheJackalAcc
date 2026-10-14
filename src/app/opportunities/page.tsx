import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { listCategories, listOpportunities, loadRequirements, toMatchable, type OpportunityFilters } from "@/lib/data/opportunities";
import { currentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/user";
import { assess, type OpportunityStatus } from "@/lib/domain/eligibility";
import { AvailabilityBadge, EligibilityBadge, SyntheticLabel } from "@/components/badges";
import { OpportunityFacts } from "@/components/opportunity-facts";

export const metadata = { title: "Opportunities" };
const STATUSES: OpportunityStatus[] = ["open", "upcoming", "extended", "suspended", "unverified", "closed"];
const TYPES = ["grant", "subsidy", "loan", "guarantee", "equity", "tax_incentive", "training", "employment_subsidy", "procurement", "unknown"];

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t, locale } = await getDict();
  if (!isDatabaseConfigured()) return <div className="notice bad">{t.noDb}</div>;
  const sp = await searchParams;
  const filters: OpportunityFilters = {
    q: sp.q || undefined,
    category: sp.category || undefined,
    status: STATUSES.includes(sp.status as OpportunityStatus) ? (sp.status as OpportunityStatus) : undefined,
    type: TYPES.includes(sp.type ?? "") ? sp.type : undefined,
  };
  const [rows, categories, user] = await Promise.all([listOpportunities(sql(), filters), listCategories(sql()), currentUser()]);
  const [profile, reqs] = await Promise.all([user ? getProfile(sql(), user) : null, loadRequirements(sql(), rows.map((r) => r.id))]);
  const now = new Date();

  return (
    <>
      <h1>{t.nav.opportunities}</h1>
      <form className="filters card" role="search">
        <div><label htmlFor="q">{t.opp.search}</label><input id="q" name="q" defaultValue={filters.q} placeholder={t.opp.searchPlaceholder} /></div>
        <div><label htmlFor="category">{t.opp.allCategories}</label>
          <select id="category" name="category" defaultValue={filters.category ?? ""}>
            <option value="">{t.opp.allCategories}</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{locale === "el" ? c.name_el : c.name_en}</option>)}
          </select></div>
        <div><label htmlFor="status">{t.opp.allStatuses}</label>
          <select id="status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">{t.opp.allStatuses}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </select></div>
        <div><label htmlFor="type">{t.opp.type}</label>
          <select id="type" name="type" defaultValue={filters.type ?? ""}>
            <option value="">{t.opp.allTypes}</option>
            {TYPES.map((s) => <option key={s} value={s}>{t.type[s]}</option>)}
          </select></div>
        <button className="btn btn-primary">{t.opp.search}</button>
      </form>

      {rows.length === 0 ? <p className="muted" style={{ marginTop: 20 }}>{t.opp.none}</p> : (
        <ul className="opp-list">
          {rows.map((o) => {
            const a = assess(toMatchable(o, reqs.get(o.id) ?? []), profile ?? {}, { now });
            return (
              <li key={o.id} className="opp">
                <div className="row">
                  <AvailabilityBadge value={a.availability} t={t} />
                  {profile && <EligibilityBadge status={a.eligibility} t={t} />}
                  {o.is_synthetic && <SyntheticLabel t={t} />}
                </div>
                <h3><Link href={`/opportunities/${o.id}`}>{o.official_title}</Link></h3>
                <div className="small muted">{o.publishing_authority}{o.source_name ? ` · ${t.ui.source}: ${o.source_name}` : ""}</div>
                <OpportunityFacts o={o} t={t} locale={locale} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
