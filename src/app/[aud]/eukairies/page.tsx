import Link from "next/link";
import { titled } from "@/lib/site/page-title";
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
import { paths } from "@/lib/site/audience";
import { audienceParam } from "@/lib/site/path-params";
import { loadListing, type ListingFilters } from "@/lib/site/listing";
import { EligibilityBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { OpportunityCard } from "@/components/opportunity-card";

export const generateMetadata = titled(({ s }) => s.paths.nav.opportunities);
const PAGE_SIZE = 24;
const STATUS = ["open", "upcoming", "recheck", "passed", "closed", "all"] as const;
/** People groups offered as a filter in the citizen path (the organisation group belongs to the business path). */
const PERSONAS = PERSONA_IDS.filter((p) => p !== "business_org");

/**
 * Opportunities of ONE path (owner decision, 22 Oct 2026). The path is applied in the database query, so search and
 * every filter work only inside it. Filters that mean nothing in a path are not offered there (people groups only for
 * citizens, industries only for businesses), and categories / support types are offered only when the path has records.
 */
export default async function OpportunitiesPage({ params, searchParams }: { params: Promise<{ aud: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const aud = await audienceParam(params);
  const { t, locale } = await getDict();
  const s = SITE[locale];
  if (!isDatabaseConfigured()) return <div className="container"><div className="notice bad">{t.noDb}</div></div>;
  const sp = await searchParams;
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : undefined);
  const f: ListingFilters = {
    q: sp.q?.trim().slice(0, 100) || undefined,
    cat: categoryBySlug(sp.cat)?.slug,
    type: pick(sp.type, SUPPORT_TYPES),
    audience: aud === "citizen" ? pick(sp.audience, PERSONAS) : undefined,
    scope: pick(sp.scope, ["eu", "gr"] as const),
    status: pick(sp.status, STATUS) ?? "current",
    industry: aud === "business" ? pick(sp.industry, INDUSTRY_IDS) : undefined,
  };
  const BASE = paths.opportunities(aud);
  const list = await loadListing(sql(), aud, f);
  // What exists in this path at all (any status): only those categories and support types are offered.
  const everything = await loadListing(sql(), aud, { status: "all" });
  const pathCats = CATEGORIES.filter((c) => everything.some((x) => x.categories.includes(c.slug)));
  const pathTypes = SUPPORT_TYPES.filter((x) => everything.some((y) => y.support === x));
  const pathScopes = (["gr", "eu"] as const).filter((x) => everything.some((y) => y.scope === x));
  // Empty category: tell "nothing connected yet" apart from "nothing open right now".
  const expiredOnly = list.length === 0 && f.status === "current" ? (await loadListing(sql(), aud, { ...f, status: "all" })).length : 0;
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
    for (const [k, v] of Object.entries({ ...f, page: undefined, ...patch })) if (v && !(k === "status" && v === "current")) p.set(k, String(v));
    const str = p.toString();
    return `${BASE}${str ? `?${str}` : ""}`;
  };
  const anyFilter = Object.entries(f).some(([k, v]) => v && !(k === "status" && v === "current"));
  // Active filters as removable chips (sprint 17 Oct: "clear active filters, easy reset").
  const active: Array<[keyof ListingFilters, string, string]> = [];
  if (f.q) active.push(["q", s.opps.search, `«${f.q}»`]);
  if (cat) active.push(["cat", s.opps.category, cat.name[locale]]);
  if (f.type) active.push(["type", s.opps.type, s.supportType[f.type as keyof typeof s.supportType]]);
  if (f.audience) active.push(["audience", s.opps.audience, (t.opt.personas as Record<string, string>)[f.audience] ?? f.audience]);
  if (f.scope) active.push(["scope", s.opps.scope, s.scope[f.scope as "gr" | "eu"]]);
  if (f.status && f.status !== "current") active.push(["status", s.opps.status, s.status[f.status as keyof typeof s.status]]);
  if (f.industry) active.push(["industry", s.opps.industry, (t.opt.industries as Record<string, string>)[f.industry] ?? f.industry]);
  const select = (px: string, name: string, label: string, value: string | undefined, options: Array<[string, string]>, allLabel = s.opps.all) => (
    <div>
      <label htmlFor={`${px}-${name}`}>{label}</label>
      <select id={`${px}-${name}`} name={name} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const filterForm = (px: string) => (
    <form className="card filter-panel" role="search" action={BASE}>
      {f.cat && <input type="hidden" name="cat" value={f.cat} />}
      <div>
        <label htmlFor={`${px}-q`}>{s.opps.search}</label>
        <input id={`${px}-q`} name="q" type="search" defaultValue={f.q} placeholder={s.opps.searchPlaceholder} />
      </div>
      {pathTypes.length > 1 && select(px, "type", s.opps.type, f.type, pathTypes.map((x) => [x, s.supportType[x]]))}
      {aud === "citizen" && select(px, "audience", s.opps.audience, f.audience, PERSONAS.map((x) => [x, t.opt.personas[x] ?? x]))}
      {pathScopes.length > 1 && select(px, "scope", s.opps.scope, f.scope, pathScopes.map((x) => [x, s.scope[x]]))}
      {select(px, "status", s.opps.status, f.status === "current" ? undefined : f.status, STATUS.map((x) => [x, s.status[x]]), s.status.current)}
      {aud === "business" && select(px, "industry", s.opps.industry, f.industry, INDUSTRY_IDS.map((x) => [x, t.opt.industries[x] ?? x]))}
      <div className="actions">
        <button className="btn btn-primary btn-sm">{s.opps.apply}</button>
        {anyFilter && <Link href={BASE} className="btn btn-ghost btn-sm">{s.opps.clear}</Link>}
      </div>
    </form>
  );

  return (
    <div className="container">
      <div className="page-head">
        {cat && <div className="crumbs"><Link href={BASE}>{s.paths.opps.title[aud]}</Link> / {cat.name[locale]}</div>}
        <h1>{cat ? cat.name[locale] : s.paths.opps.title[aud]}</h1>
        <p className="lead">{cat ? cat.description[locale] : s.paths.opps.lead[aud]}</p>
      </div>

      <nav className="chips-row" aria-label={s.opps.category} style={{ marginBottom: 20 }}>
        <Link className="chip" href={qs({ cat: undefined })} aria-current={!f.cat ? "true" : undefined}>{s.opps.all}</Link>
        {pathCats.map((c) => (
          <Link key={c.slug} className="chip" href={qs({ cat: c.slug })} aria-current={f.cat === c.slug ? "true" : undefined}>
            <Icon name={c.icon} size={16} />{c.name[locale]}
          </Link>
        ))}
      </nav>

      <div className="with-aside">
        <aside className="sticky">
          <div className="filters-desktop">{filterForm("d")}</div>
          <details className="filters-mobile">
            <summary className="btn btn-ghost btn-sm"><Icon name="layers" size={16} />{s.opps.filters}{active.length > 0 ? ` (${active.length})` : ""}</summary>
            {filterForm("m")}
          </details>
        </aside>

        <section aria-live="polite">
          {active.length > 0 && (
            <div className="active-filters" aria-label={s.opps.activeFilters}>
              <span className="xs muted">{s.opps.activeFilters}:</span>
              {active.map(([k, label, value]) => (
                <Link key={k} href={qs({ [k]: k === "status" ? "current" : undefined })} className="chip chip-sm chip-remove" aria-label={s.opps.removeFilter(`${label}: ${value}`)}>
                  <span className="muted">{label}:</span> {value} <span aria-hidden="true">×</span>
                </Link>
              ))}
              <Link href={BASE} className="xs">{s.opps.clear}</Link>
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <span><strong>{s.opps.results(list.length)}</strong> <span className="small muted">· {s.paths.opps.only[aud]}</span>{f.status === "current" && <span className="small muted"> · {s.opps.currentOnly} <Link href={qs({ status: "all" })}>{s.opps.showExpired}</Link></span>}</span>
            {(f.cat || f.audience) && <span className="xs muted" style={{ maxWidth: 520 }}>{s.opps.indicative}</span>}
          </div>
          {list.length > 0 && <p className="xs muted" style={{ margin: "-6px 0 14px", maxWidth: 760 }}>{s.opps.rankNote}</p>}
          {list.length === 0 ? (
            <div className="empty">
              <span className="icon-tile"><Icon name="search" /></span>
              <h3>{f.q ? s.opps.noResultsFor(f.q) : s.opps.emptyTitle}</h3>
              <p>{expiredOnly > 0 ? s.opps.noneOpen : f.cat && !f.q && !f.type && !f.audience && !f.scope && !f.industry ? s.opps.categoryEmpty : s.opps.emptyBody}</p>
              <div className="row" style={{ justifyContent: "center", gap: 8 }}>
                {expiredOnly > 0 && <Link href={qs({ status: "all" })} className="btn btn-ghost btn-sm">{f.q ? s.opps.tryAll : s.opps.showExpired}</Link>}
                {f.q && <Link href={`${paths.guides(aud)}?q=${encodeURIComponent(f.q)}#results`} className="btn btn-ghost btn-sm">{s.opps.tryGuides}</Link>}
                {anyFilter && <Link href={BASE} className="btn btn-ghost btn-sm">{s.opps.tryClear}</Link>}
              </div>
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
