import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { SITE } from "@/lib/site/copy";
import { CATEGORIES } from "@/lib/site/taxonomy";
import { countByCategory, featured, loadListing, type ListedOpportunity } from "@/lib/site/listing";
import { PROGRAMME_GUIDES, GENERAL_GUIDES } from "@/lib/site/guides";
import { AcropolisArt } from "@/components/brand";
import { Icon } from "@/components/icons";
import { OpportunityCard } from "@/components/opportunity-card";

export default async function Home() {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const h = s.home;
  const list: ListedOpportunity[] = isDatabaseConfigured() ? await loadListing(sql()).catch(() => []) : [];
  const counts = countByCategory(list);
  const top = featured(list, 3);
  const guides = [GENERAL_GUIDES[0]!, ...["a21", "unemployment"].map((slug) => PROGRAMME_GUIDES.find((g) => g.slug === slug)).filter((g) => !!g)];

  return (
    <>
      {/* 1 — Hero */}
      <section className="hero">
        <div className="container wrap">
          <div>
            <span className="eyebrow">{h.eyebrow}</span>
            <h1>{h.title}</h1>
            <p className="lead">{h.lead}</p>
            <form action="/opportunities" role="search" className="searchbar">
              <Icon name="search" size={20} />
              <label htmlFor="hero-q" className="visually-hidden">{h.searchLabel}</label>
              <input id="hero-q" name="q" type="search" placeholder={h.searchPlaceholder} />
              <button className="btn btn-primary">{s.opps.search}</button>
            </form>
            <div className="row" style={{ gap: 12 }}>
              <Link href="/opportunities" className="btn btn-dark btn-lg">{h.cta} <Icon name="arrow" size={18} /></Link>
              <Link href="#how" className="btn btn-ghost btn-lg">{h.cta2}</Link>
            </div>
            <div className="trust-row">
              <span><Icon name="shield" size={18} />{h.trust1}</span>
              <span><Icon name="check" size={18} />{h.trust2}</span>
              <span><Icon name="globe" size={18} />{h.trust3}</span>
            </div>
          </div>
          <div className="art-wrap"><AcropolisArt className="art" label={locale === "el" ? "Η Ακρόπολη της Αθήνας" : "The Acropolis of Athens"} /></div>
        </div>
      </section>

      {/* 2 — How it works */}
      <section className="band alt" id="how">
        <div className="container">
          <div className="section-head"><div><h2>{h.stepsTitle}</h2><p>{h.stepsLead}</p></div></div>
          <ol className="steps" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {h.steps.map((st, i) => (
              <li key={st.t} className="step">
                <div className="step-top">
                  <span className="num" aria-hidden="true">{i + 1}</span>
                  <span className="icon-tile"><Icon name={st.icon} /></span>
                </div>
                <h3>{st.t}</h3>
                <p>{st.d}</p>
                <Link href={st.href} className="step-link">{st.cta} <Icon name="arrow" size={16} /></Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3 — Categories */}
      <section className="band">
        <div className="container">
          <div className="section-head">
            <div><h2>{h.catsTitle}</h2><p>{h.catsLead}</p></div>
            <Link href="/categories" className="btn btn-ghost btn-sm">{h.allCats} <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid4">
            {CATEGORIES.slice(0, 8).map((c) => {
              const n = counts[c.slug] ?? { open: 0, total: 0, recheck: 0 };
              return (
                <Link key={c.slug} href={`/opportunities?cat=${c.slug}`} className="card card-link cat-card">
                  <span className="icon-tile"><Icon name={c.icon} /></span>
                  <h3>{c.name[locale]}</h3>
                  <p>{c.description[locale]}</p>
                  <div className="foot"><span>{s.cats.count(n.open, n.total, n.recheck)}</span><Icon name="arrow" size={16} /></div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4 — Featured opportunities (real, verified records) */}
      {top.length > 0 && (
        <section className="band alt">
          <div className="container">
            <div className="section-head">
              <div><h2>{h.featuredTitle}</h2><p>{h.featuredLead}</p></div>
              <Link href="/opportunities?status=open" className="btn btn-ghost btn-sm">{h.allOpps} <Icon name="arrow" size={16} /></Link>
            </div>
            <div className="opp-grid">{top.map((x) => <OpportunityCard key={x.row.id} item={x} t={t} s={s} locale={locale} />)}</div>
          </div>
        </section>
      )}

      {/* 5 — Personalised matching */}
      <section className="band">
        <div className="container">
          <div className="match-panel">
            <div>
              <h2>{h.matchTitle}</h2>
              <p>{h.matchLead}</p>
              <ul>{h.matchPoints.map((p) => <li key={p}><Icon name="check" size={20} />{p}</li>)}</ul>
              <Link href="/for-me" className="btn btn-primary btn-lg">{h.matchCta} <Icon name="arrow" size={18} /></Link>
            </div>
            <div className="match-demo" aria-label={h.matchDemoTitle}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{h.matchDemoTitle}</strong>
                <span className="tag gold">{locale === "el" ? "Ενδεικτικό" : "Illustration"}</span>
              </div>
              <div className="item"><span>{locale === "el" ? "Επίδομα για οικογένειες" : "A family benefit"}</span><span className="badge b-ok">{s.forMe.groups.potentially_eligible}</span></div>
              <div className="item"><span>{locale === "el" ? "Πρόγραμμα κατάρτισης" : "A training programme"}</span><span className="badge b-info">{s.forMe.groups.potentially_eligible_verification_required}</span></div>
              <div className="item"><span>{locale === "el" ? "Επιχορήγηση για νέες επιχειρήσεις" : "A grant for new businesses"}</span><span className="badge">{s.forMe.groups.insufficient_information}</span></div>
              <p className="xs muted" style={{ margin: "12px 0 0" }}>{h.matchDemoNote}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6 — Guides */}
      <section className="band alt">
        <div className="container">
          <div className="section-head">
            <div><h2>{h.guidesTitle}</h2><p>{h.guidesLead}</p></div>
            <Link href="/guides" className="btn btn-ghost btn-sm">{h.allGuides} <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid3">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="card card-link cat-card">
                <span className={`icon-tile ${g.kind === "general" ? "gold" : "navy"}`}><Icon name="book" /></span>
                <h3>{g.title[locale]}</h3>
                <p>{g.summary[locale]}</p>
                <div className="foot"><strong>{s.guides.read}</strong><Icon name="arrow" size={16} /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 7 — Trust & official sources */}
      <section className="band">
        <div className="container">
          <div className="section-head"><div><h2>{h.trustTitle}</h2></div><Link href="/about#sources" className="btn btn-ghost btn-sm">{s.footer.sources} <Icon name="arrow" size={16} /></Link></div>
          <div className="grid3">
            {h.trustPoints.map((p, i) => (
              <div key={p.t} className="card flat">
                <span className="icon-tile"><Icon name={["shield", "calendar", "info"][i]!} /></span>
                <h3 style={{ marginTop: 14 }}>{p.t}</h3>
                <p className="muted" style={{ margin: 0 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="band alt" id="faq">
        <div className="container faq-layout">
          <div className="section-head faq-head">
            <div>
              <h2>{h.faqTitle}</h2>
              <p>{h.faqLead}</p>
            </div>
            <Link href="/about#faq" className="btn btn-ghost btn-sm">{h.faqAll} <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="faq faq-card">
            {s.faq.slice(0, 5).map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
      </section>
    </>
  );
}
