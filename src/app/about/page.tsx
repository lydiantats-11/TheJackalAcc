import { getDict } from "@/lib/i18n/server";
import { titled } from "@/lib/site/page-title";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { SITE } from "@/lib/site/copy";
import { EligibilityBadge, RecordStatusBadge } from "@/components/badges";
import { Icon } from "@/components/icons";

export const generateMetadata = titled(({ s }) => s.nav.how);

export default async function AboutPage() {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const ab = s.about;
  const sources = isDatabaseConfigured()
    ? await sql()<{ slug: string; name: string; authority: string; base_url: string; lifecycle: string }[]>`
        SELECT slug, name, authority, base_url, lifecycle FROM sources ORDER BY scope DESC, name`.catch(() => [])
    : [];
  const recordLabels = ["open", "rolling", "upcoming", "recheck", "deadline_passed", "closed"] as const;
  return (
    <div className="container">
      <div className="page-head">
        <h1>{ab.title}</h1>
        <p className="lead">{ab.lead}</p>
      </div>

      <nav className="toc about-toc" aria-label={ab.title}>
        <a href="#how">{ab.nav.how}</a>
        <a href="#mission">{ab.nav.mission}</a>
        <a href="#principles">{ab.nav.principles}</a>
        <a href="#labels">{ab.nav.labels}</a>
        <a href="#sources">{ab.nav.sources}</a>
        <a href="#privacy">{ab.nav.privacy}</a>
        <a href="#faq">{ab.nav.faq}</a>
      </nav>

      {/* Four connected steps (owner brief, 17 Oct 2026) */}
      <section id="how" className="about-section" style={{ marginTop: 0 }}>
        <div className="section-head"><div><h2>{ab.howTitle}</h2><p>{ab.howLead}</p></div></div>
        <ol className="flow">
          {ab.how.map((h, i) => (
            <li key={h.t}>
              <span className="flow-num" aria-hidden="true">{i + 1}</span>
              <span className="icon-tile"><Icon name={h.icon} /></span>
              <h3>{h.t}</h3>
              <p>{h.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="mission" className="mission-panel about-section">
        <div>
          <span className="eyebrow">{ab.missionTitle}</span>
          <p className="mission-text">{ab.mission}</p>
        </div>
        <div>
          <span className="eyebrow">{ab.visionTitle}</span>
          <p className="mission-text">{ab.vision}</p>
        </div>
      </section>

      <div className="grid2 about-section">
        <div className="card">
          <span className="icon-tile"><Icon name="sparkle" /></span>
          <h2 style={{ marginTop: 14, fontSize: "1.2rem" }}>{ab.whatTitle}</h2>
          <p style={{ margin: 0 }}>{ab.what}</p>
        </div>
        <div className="card">
          <span className="icon-tile"><Icon name="alert" /></span>
          <h2 style={{ marginTop: 14, fontSize: "1.2rem" }}>{ab.notTitle}</h2>
          <ul className="checklist">{ab.not.map((n) => <li key={n}><Icon name="info" size={18} /><span>{n}</span></li>)}</ul>
        </div>
      </div>

      <section className="about-section">
        <div className="section-head"><div><h2>{ab.eligTitle}</h2></div></div>
        <div className="grid2">
          {ab.elig.map((e, i) => (
            <div key={e.t} className="card flat">
              <span className="icon-tile"><Icon name={i === 0 ? "shield" : "layers"} /></span>
              <h3 style={{ marginTop: 14 }}>{e.t}</h3>
              <p className="muted" style={{ margin: 0 }}>{e.d}</p>
            </div>
          ))}
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

      {/* The same labels the cards and detail pages use (canonical record status + eligibility groups) */}
      <h2 id="labels" style={{ marginTop: 48 }}>{ab.statusTitle}</h2>
      <div className="grid2">
        <div className="card flat">
          <div className="section-label sl-official">{s.opps.status}</div>
          <ul className="checklist small">
            {recordLabels.map((v) => (
              <li key={v} style={{ alignItems: "center" }}><RecordStatusBadge record={{ display: v, application: v, lastVerifiedAt: null }} s={s} locale={locale} detail={false} /></li>
            ))}
          </ul>
          <p className="xs muted" style={{ margin: 0 }}>{s.record.recheckHelp}</p>
        </div>
        <div className="card flat">
          <div className="section-label sl-score">{t.opp.sectionMatch}</div>
          <ul className="checklist small">
            {(["potentially_eligible", "potentially_eligible_verification_required", "insufficient_information", "unlikely_eligible"] as const).map((g) => (
              <li key={g} style={{ alignItems: "center" }}><EligibilityBadge status={g} t={t} /><span className="muted">{s.forMe.groupNotes[g]}</span></li>
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

      <h2 id="privacy" style={{ marginTop: 48 }}>{ab.privacyTitle}</h2>
      <ul className="checklist" style={{ maxWidth: 760 }}>{ab.privacy.map((p) => <li key={p}><Icon name="check" size={18} /><span>{p}</span></li>)}</ul>

      <h2 id="faq" style={{ marginTop: 48 }}>{s.home.faqTitle}</h2>
      <div className="faq" style={{ maxWidth: 860 }}>
        {s.faq.map((f) => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}
      </div>

      <h2 style={{ marginTop: 48 }}>{ab.contactTitle}</h2>
      <p className="muted">{ab.contact}</p>
    </div>
  );
}
