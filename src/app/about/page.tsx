import { getDict } from "@/lib/i18n/server";
import { titled } from "@/lib/site/page-title";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { SITE } from "@/lib/site/copy";
import { AvailabilityBadge, EligibilityBadge } from "@/components/badges";
import { Icon } from "@/components/icons";

export const generateMetadata = titled(({ s }) => s.footer.about);

export default async function AboutPage() {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const ab = s.about;
  const sources = isDatabaseConfigured()
    ? await sql()<{ slug: string; name: string; authority: string; base_url: string; lifecycle: string }[]>`
        SELECT slug, name, authority, base_url, lifecycle FROM sources ORDER BY scope DESC, name`.catch(() => [])
    : [];
  return (
    <div className="container">
      <div className="page-head">
        <h1>{ab.title}</h1>
        <p className="lead">{ab.lead}</p>
      </div>

      <nav className="toc about-toc" aria-label={ab.title}>
        <a href="#mission">{ab.nav.mission}</a>
        <a href="#principles">{ab.nav.principles}</a>
        <a href="#how">{ab.nav.how}</a>
        <a href="#labels">{ab.nav.labels}</a>
        <a href="#sources">{ab.nav.sources}</a>
        <a href="#faq">{ab.nav.faq}</a>
      </nav>

      <section id="mission" className="mission-panel">
        <div>
          <span className="eyebrow">{ab.missionTitle}</span>
          <p className="mission-text">{ab.mission}</p>
        </div>
        <div>
          <span className="eyebrow">{ab.visionTitle}</span>
          <p className="mission-text">{ab.vision}</p>
        </div>
      </section>

      <section id="principles" className="about-section">
        <div className="section-head"><div><h2>{ab.principlesTitle}</h2><p>{ab.principlesLead}</p></div></div>
        <div className="principles">
          {ab.principles.map((pr) => (
            <div key={pr.t} className="card principle">
              <span className="icon-tile"><Icon name={pr.icon} /></span>
              <h3>{pr.t}</h3>
              <p>{pr.d}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid2 about-section">
        <div className="card tint">
          <span className="icon-tile"><Icon name="sparkle" /></span>
          <h2 style={{ marginTop: 14, fontSize: "1.2rem" }}>{ab.whatTitle}</h2>
          <p style={{ margin: 0 }}>{ab.what}</p>
        </div>
        <div className="card">
          <span className="icon-tile gold"><Icon name="alert" /></span>
          <h2 style={{ marginTop: 14, fontSize: "1.2rem" }}>{ab.notTitle}</h2>
          <ul className="checklist">{ab.not.map((n) => <li key={n}><Icon name="info" size={18} /><span>{n}</span></li>)}</ul>
        </div>
      </div>

      <section id="how" className="about-section">
        <div className="section-head"><div><h2>{ab.howTitle}</h2><p>{ab.howLead}</p></div></div>
        <ol className="steps four">
          {ab.how.map((h, i) => (
            <li key={h.t} className="step">
              <div className="step-top">
                <span className="num" aria-hidden="true">{i + 1}</span>
                <span className="icon-tile"><Icon name={h.icon} /></span>
              </div>
              <h3>{h.t}</h3>
              <p>{h.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <h2 id="labels" style={{ marginTop: 48 }}>{ab.statusTitle}</h2>
      <div className="grid2">
        <div className="card flat">
          <div className="section-label sl-score">{t.opp.sectionMatch}</div>
          <ul className="checklist small">
            {(["potentially_eligible", "potentially_eligible_verification_required", "insufficient_information", "unlikely_eligible"] as const).map((g) => (
              <li key={g} style={{ alignItems: "center" }}><EligibilityBadge status={g} t={t} /><span className="muted">{s.forMe.groupNotes[g]}</span></li>
            ))}
          </ul>
        </div>
        <div className="card flat">
          <div className="section-label sl-official">{s.opps.status}</div>
          <ul className="checklist small">
            {(["open", "upcoming", "deadline_passed_unconfirmed", "unverified", "closed"] as const).map((v) => (
              <li key={v} style={{ alignItems: "center" }}><AvailabilityBadge value={v} t={t} /></li>
            ))}
          </ul>
        </div>
      </div>

      <h2 id="sources" style={{ marginTop: 48 }}>{ab.sourcesTitle}</h2>
      <p className="muted">{ab.sourcesLead}</p>
      {sources.length > 0 && (
        <div className="card scroll" style={{ padding: 0 }}>
          <table className="crit">
            <thead><tr><th style={{ paddingLeft: 20 }}>{s.footer.sources}</th><th>{t.opp.authority}</th><th>{locale === "el" ? "Κατάσταση σύνδεσης" : "Connection status"}</th></tr></thead>
            <tbody>
              {sources.map((src) => (
                <tr key={src.slug}>
                  <td style={{ paddingLeft: 20 }}><a href={src.base_url} target="_blank" rel="noopener noreferrer">{src.name}</a></td>
                  <td>{src.authority}</td>
                  <td><span className={`badge ${src.lifecycle === "active" || src.lifecycle === "tested" ? "b-ok" : ""}`}>{t.lifecycle[src.lifecycle] ?? src.lifecycle}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="faq" style={{ marginTop: 48 }}>{s.home.faqTitle}</h2>
      <div className="faq" style={{ maxWidth: 860 }}>
        {s.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
      </div>

      <h2 style={{ marginTop: 48 }}>{ab.contactTitle}</h2>
      <p className="muted">{ab.contact}</p>
    </div>
  );
}
