import Link from "next/link";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { GUIDE_CATEGORIES, countByCategory, guideCategory, guidesOf, searchGuides, verificationOf } from "@/lib/site/guide-catalog";
import { paths } from "@/lib/site/audience";
import { audienceParam } from "@/lib/site/path-params";
import { programmeStatus } from "@/lib/site/guide-status";
import { loadLiveGuideRecords } from "@/lib/site/guide-live";
import { GuideCard } from "@/components/guide-ui";
import { Icon } from "@/components/icons";

export const generateMetadata = titled(({ s }) => s.paths.nav.guides);

/** Guides of ONE path: search, categories and counts only ever see this path's guides. */
export default async function GuidesPage({ params, searchParams }: { params: Promise<{ aud: string }>; searchParams: Promise<{ q?: string; cat?: string }> }) {
  const aud = await audienceParam(params);
  const mine = guidesOf(aud);
  const BASE = paths.guides(aud);
  const { locale } = await getDict();
  const s = SITE[locale];
  const g = s.guides;
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const cat = typeof sp.cat === "string" && guideCategory(sp.cat) ? sp.cat : "";
  const results = searchGuides({ q, cat }, mine);
  const counts = countByCategory(mine);
  // Only the guide categories this path has guides in.
  const cats = GUIDE_CATEGORIES.filter((c) => counts[c.slug] > 0);
  // Statuses are computed for this request (never the stored snapshot); verification is about the guide's content.
  const now = new Date();
  const live = await loadLiveGuideRecords(mine.flatMap((a) => (a.recordKey ? [a.recordKey] : [])), now);
  const href = (next: { q?: string; cat?: string }) => {
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.cat) p.set("cat", next.cat);
    const str = p.toString();
    return str ? `${BASE}?${str}#results` : `${BASE}#results`;
  };
  const selected = guideCategory(cat);
  const heading = q ? g.resultsFor(q) : selected ? selected.name[locale] : g.allCategories;

  return (
    <>
      <section className="guides-hero">
        <div className="container">
          <h1>{s.paths.guides.title[aud]}</h1>
          <p className="lead">{g.heroLead}</p>
          <form className="guide-search" role="search" action={`${BASE}#results`}>
            <label className="visually-hidden" htmlFor="guide-q">{g.searchLabel}</label>
            <Icon name="search" size={20} />
            <input id="guide-q" name="q" type="search" defaultValue={q} placeholder={g.searchPlaceholder} maxLength={100} autoComplete="off" />
            {cat && <input type="hidden" name="cat" value={cat} />}
            <button className="btn btn-primary" type="submit">{g.searchButton}</button>
          </form>
        </div>
      </section>

      <div className="container">
        <h2 id="categories">{g.categoriesTitle}</h2>
        <nav className="guide-cats" aria-label={g.categoriesTitle}>
          {cats.map((c) => (
            <Link key={c.slug} href={href({ q, cat: cat === c.slug ? undefined : c.slug })} className="guide-cat" aria-current={cat === c.slug ? "true" : undefined}>
              <span className="icon-tile navy" aria-hidden="true"><Icon name={c.icon} /></span>
              <span className="guide-cat-text">
                <strong>{c.name[locale]}</strong>
                <span className="small muted">{c.desc[locale]}</span>
                <span className="xs muted">{g.count(counts[c.slug])}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="section-head" id="results" style={{ marginTop: 40, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0 }}>{heading}</h2>
            <p>{g.count(results.length)}</p>
          </div>
          {(q || cat) && <Link className="btn btn-ghost btn-sm" href={`${BASE}#results`}>{g.clear}</Link>}
        </div>

        {results.length === 0 ? (
          <div className="empty">
            <span className="icon-tile navy"><Icon name="search" /></span>
            <h3>{g.emptyTitle}</h3>
            <p className="muted" style={{ maxWidth: 520, margin: "0 auto" }}>{!q && cat ? g.emptyCategory : g.emptyText}</p>
            <p style={{ marginTop: 16 }}><Link className="btn btn-ghost btn-sm" href={`${BASE}#results`}>{g.allCategories}</Link></p>
          </div>
        ) : (
          <div className="opp-grid">
            {results.map((a) => (
              <GuideCard key={a.slug} a={a} href={paths.guide(aud, a.slug)} s={s} locale={locale} state={verificationOf(a, now)}
                status={a.recordKey ? programmeStatus(a.recordKey, now, live.get(a.recordKey)) : null} />
            ))}
          </div>
        )}
      </div>

      <section className="band alt" id="faq" style={{ marginTop: 56 }}>
        <div className="container faq-layout">
          <div className="section-head faq-head">
            <div>
              <h2>{g.questionsTitle}</h2>
              <p>{s.home.faqLead}</p>
            </div>
            <Link href={`${paths.about(aud)}#faq`} className="btn btn-ghost btn-sm">{s.home.faqAll} <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="faq faq-card">
            {s.faq.slice(0, 5).map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
      </section>
    </>
  );
}
