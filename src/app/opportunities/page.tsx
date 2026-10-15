import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { loadRequirements, toMatchable } from "@/lib/data/opportunities";
import { currentUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/data/user";
import { assess } from "@/lib/domain/eligibility";
import { INDUSTRY_IDS } from "@/lib/domain/industries";
import { PERSONA_IDS } from "@/lib/domain/personas";
import { SITE } from "@/lib/site/copy";
import { CATEGORIES, SUPPORT_TYPES, categoryBySlug } from "@/lib/site/taxonomy";
import { loadListing, type ListingFilters } from "@/lib/site/listing";
import { EligibilityBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { OpportunityCard } from "@/components/opportunity-card";

export const metadata = { title: "Ευκαιρίες / Opportunities" };
const PAGE_SIZE = 24;
const STATUS = ["open", "upcoming", "passed", "closed"] as const;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  if (!isDatabaseConfigured()) return <div className="container"><div className="notice bad">{t.noDb}</div></div>;
  const sp = await searchParams;
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
  const f: ListingFilters = {
    q: sp.q?.trim().slice(0, 100) || undefined,
    cat: categoryBySlug(sp.cat)?.slug,
    type: pick(sp.type, SUPPORT_TYPES),
    audience: pick(sp.audience, PERSONA_IDS),
    scope: pick(sp.scope, ["eu", "gr"] as const),
    status: pick(sp.status, STATUS),
    industry: pick(sp.industry, INDUSTRY_IDS),
  };
  const list = await loadListing(sql(), f);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Logged-in users also see their eligibility label (same engine as before; requirements loaded for this page only).
  const user = await currentUser().catch(() => null);
  const profile = user ? await getProfile(sql(), user) : null;
  const reqs = profile ? await loadRequirements(sql(), shown.map((x) => x.row.id)) : null;
  const now = new Date();

  const cat = categoryBySlug(f.cat);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, page: undefined, ...patch })) if (v) p.set(k, String(v));
    const str = p.toString();
    return `/opportunities${str ? `?${str}` : ""}`;
  };
  const anyFilter = Object.values(f).some(Boolean);
  const select = (name: string, label: string, value: string | undefined, options: Array<[string, string]>) => (
    <div>
      <label htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{s.opps.all}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div className="container">
      <div className="page-head">
        {cat && <div className="crumbs"><Link href="/opportunities">{s.opps.title}</Link> / {cat.name[locale]}</div>}
        <h1>{cat ? cat.name[locale] : s.opps.title}</h1>
        <p className="lead">{cat ? cat.description[locale] : s.opps.lead}</p>
      </div>

      <nav className="chips-row" aria-label={s.opps.category} style={{ marginBottom: 20 }}>
        <Link className="chip" href={qs({ cat: undefined })} aria-current={!f.cat ? "true" : undefined}>{s.opps.all}</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} className="chip" href={qs({ cat: c.slug })} aria-current={f.cat === c.slug ? "true" : undefined}>
            <Icon name={c.icon} size={16} />{c.name[locale]}
          </Link>
        ))}
      </nav>

      <div className="with-aside">
        <aside className="sticky">
          <details className="filters-mobile">
            <summary className="btn btn-ghost btn-sm"><Icon name="layers" size={16} />{s.opps.filters}</summary>
            <form className="card filter-panel" role="search" action="/opportunities">
              {f.cat && <input type="hidden" name="cat" value={f.cat} />}
              <div>
                <label htmlFor="f-q">{s.opps.search}</label>
                <input id="f-q" name="q" type="search" defaultValue={f.q} placeholder={s.opps.searchPlaceholder} />
              </div>
              {select("type", s.opps.type, f.type, SUPPORT_TYPES.map((x) => [x, s.supportType[x]]))}
              {select("audience", s.opps.audience, f.audience, PERSONA_IDS.map((x) => [x, t.opt.personas[x] ?? x]))}
              {select("scope", s.opps.scope, f.scope, [["gr", s.scope.gr], ["eu", s.scope.eu]])}
              {select("status", s.opps.status, f.status, STATUS.map((x) => [x, s.status[x]]))}
              {select("industry", s.opps.industry, f.industry, INDUSTRY_IDS.map((x) => [x, t.opt.industries[x] ?? x]))}
              <div className="actions">
                <button className="btn btn-primary btn-sm">{s.opps.apply}</button>
                {anyFilter && <Link href="/opportunities" className="btn btn-ghost btn-sm">{s.opps.clear}</Link>}
              </div>
            </form>
          </details>
        </aside>

        <section aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <strong>{s.opps.results(list.length)}</strong>
            {(f.cat || f.audience) && <span className="xs muted" style={{ maxWidth: 520 }}>{s.opps.indicative}</span>}
          </div>
          {list.length === 0 ? (
            <div className="empty">
              <span className="icon-tile"><Icon name="search" /></span>
              <h3>{s.opps.emptyTitle}</h3>
              <p>{f.cat && !f.q && !f.type && !f.audience && !f.scope && !f.status && !f.industry ? s.opps.categoryEmpty : s.opps.emptyBody}</p>
              <Link href="/opportunities" className="btn btn-ghost btn-sm">{s.opps.clear}</Link>
            </div>
          ) : (
            <div className="opp-grid">
              {shown.map((x) => {
                const a = profile && reqs ? assess(toMatchable(x.row, reqs.get(x.row.id) ?? []), profile, { now }) : null;
                return <OpportunityCard key={x.row.id} item={x} t={t} s={s} locale={locale}
                  extra={a ? <div><EligibilityBadge status={a.eligibility} t={t} /></div> : undefined} />;
              })}
            </div>
          )}
          {pages > 1 && (
            <nav className="pager" aria-label={s.opps.page}>
              {page > 1 && <Link className="btn btn-ghost btn-sm" href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page - 1}`}>← {s.opps.prev}</Link>}
              <span className="small muted">{s.opps.page} {page} / {pages}</span>
              {page < pages && <Link className="btn btn-ghost btn-sm" href={`${qs({})}${qs({}).includes("?") ? "&" : "?"}page=${page + 1}`}>{s.opps.next} →</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
