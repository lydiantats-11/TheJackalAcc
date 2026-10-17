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
import { loadListing, type ListingFilters } from "@/lib/site/listing";
import { EligibilityBadge } from "@/components/badges";
import { Icon } from "@/components/icons";
import { OpportunityCard } from "@/components/opportunity-card";

export const generateMetadata = titled(({ s }) => s.nav.opportunities);
const PAGE_SIZE = 24;
const STATUS = ["open", "upcoming", "recheck", "passed", "closed", "all"] as const;

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
    status: pick(sp.status, STATUS) ?? "current",
    industry: pick(sp.industry, INDUSTRY_IDS),
    applicant: pick(sp.applicant, ["individuals", "organisations", "unknown"] as const),
  };
  const list = await loadListing(sql(), f);
  // Empty category: tell "nothing connected yet" apart from "nothing open right now".
  const expiredOnly = list.length === 0 && f.status === "current" ? (await loadListing(sql(), { ...f, status: "all" })).length : 0;
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
    return `/opportunities${str ? `?${str}` : ""}`;
  };
  const anyFilter = Object.entries(f).some(([k, v]) => v && !(k === "status" && v === "current"));
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
    <form className="card filter-panel" role="search" action="/opportunities">
      {f.cat && <input type="hidden" name="cat" value={f.cat} />}
      <div>
        <label htmlFor={`${px}-q`}>{s.opps.search}</label>
        <input id={`${px}-q`} name="q" type="search" defaultValue={f.q} placeholder={s.opps.searchPlaceholder} />
      </div>
      {select(px, "type", s.opps.type, f.type, SUPPORT_TYPES.map((x) => [x, s.supportType[x]]))}
      {select(px, "applicant", s.opps.applicant, f.applicant, (["individuals", "organisations", "unknown"] as const).map((x) => [x, s.opps.applicantOpts[x]]))}
      {select(px, "audience", s.opps.audience, f.audience, PERSONA_IDS.map((x) => [x, t.opt.personas[x] ?? x]))}
      {select(px, "scope", s.opps.scope, f.scope, [["gr", s.scope.gr], ["eu", s.scope.eu]])}
      {select(px, "status", s.opps.status, f.status === "current" ? undefined : f.status, STATUS.map((x) => [x, s.status[x]]), s.status.current)}
      {select(px, "industry", s.opps.industry, f.industry, INDUSTRY_IDS.map((x) => [x, t.opt.industries[x] ?? x]))}
      <div className="actions">
        <button className="btn btn-primary btn-sm">{s.opps.apply}</button>
        {anyFilter && <Link href="/opportunities" className="btn btn-ghost btn-sm">{s.opps.clear}</Link>}
      </div>
    </form>
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
          <div className="filters-desktop">{filterForm("d")}</div>
          <details className="filters-mobile">
            <summary className="btn btn-ghost btn-sm"><Icon name="layers" size={16} />{s.opps.filters}</summary>
            {filterForm("m")}
          </details>
        </aside>

        <section aria-live="polite">
          <nav className="quick-views" aria-label={s.opps.quick}>
            {([
              [s.opps.quickAll, { applicant: undefined, scope: undefined }],
              [s.opps.quickPeopleGr, { applicant: "individuals", scope: "gr" }],
              [s.opps.quickGr, { applicant: undefined, scope: "gr" }],
              [s.opps.quickEu, { applicant: undefined, scope: "eu" }],
            ] as const).map(([label, patch]) => {
              const on = (f.applicant ?? undefined) === patch.applicant && (f.scope ?? undefined) === patch.scope;
              return <Link key={label} className="chip chip-sm" href={qs(patch)} aria-current={on ? "true" : undefined}>{label}</Link>;
            })}
          </nav>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <span><strong>{s.opps.results(list.length)}</strong>{f.status === "current" && <span className="small muted"> · {s.opps.currentOnly} <Link href={qs({ status: "all" })}>{s.opps.showExpired}</Link></span>}</span>
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
                {f.q && <Link href={`/guides?q=${encodeURIComponent(f.q)}#results`} className="btn btn-ghost btn-sm">{s.opps.tryGuides}</Link>}
                {anyFilter && <Link href="/opportunities" className="btn btn-ghost btn-sm">{s.opps.tryClear}</Link>}
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
