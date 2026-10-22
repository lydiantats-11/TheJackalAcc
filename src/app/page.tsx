import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { paths } from "@/lib/site/audience";
import { AcropolisArt } from "@/components/brand";
import { Icon } from "@/components/icons";

/**
 * Home page (owner decision, 22 Oct 2026): what Jackal is, and a required choice between the two paths.
 * It shows no opportunities, news or guides: those are only shown inside a path, so nothing is mixed.
 */
export default async function Home() {
  const { locale } = await getDict();
  const s = SITE[locale];
  const h = s.home;
  const c = s.paths.chooser;
  return (
    <>
      <section className="hero hero-navy">
        <div className="container wrap">
          <div>
            <span className="eyebrow">{c.eyebrow}</span>
            <h1>{c.title}</h1>
            <p className="lead">{c.lead}</p>
            <p className="path-question" id="path-q">{c.question}</p>
            <div className="path-choices" role="group" aria-labelledby="path-q">
              <Link href={paths.opportunities("citizen")} className="path-choice" data-path="citizen">
                <span className="icon-tile"><Icon name="user" /></span>
                <strong>{s.paths.name.citizen}</strong>
                <span className="d">{c.citizen.d}</span>
                <span className="go">{c.citizen.cta} <Icon name="arrow" size={16} /></span>
              </Link>
              <Link href={paths.opportunities("business")} className="path-choice" data-path="business">
                <span className="icon-tile"><Icon name="briefcase" /></span>
                <strong>{s.paths.name.business}</strong>
                <span className="d">{c.business.d}</span>
                <span className="go">{c.business.cta} <Icon name="arrow" size={16} /></span>
              </Link>
            </div>
            <p className="path-note">{c.note}</p>
          </div>
          <div className="art-wrap" aria-hidden="false"><AcropolisArt className="art" label={locale === "el" ? "Η Ακρόπολη της Αθήνας" : "The Acropolis of Athens"} /></div>
        </div>
      </section>

      <section className="band" id="how">
        <div className="container">
          <ol className="flow flow-3">
            {c.steps.map((st, i) => (
              <li key={st.t}>
                <span className="flow-num" aria-hidden="true">{i + 1}</span>
                <span className="icon-tile"><Icon name={["layers", "search", "external"][i]!} /></span>
                <h3>{st.t}</h3>
                <p>{st.d}</p>
              </li>
            ))}
          </ol>
          <div className="trust-row" style={{ marginTop: 28 }}>
            <span><Icon name="shield" size={18} />{h.trust1}</span>
            <span><Icon name="check" size={18} />{h.trust2}</span>
            <span><Icon name="globe" size={18} />{h.trust3}</span>
          </div>
          <p className="small muted" style={{ marginTop: 18 }}><Link href="/about">{s.paths.nav.about} →</Link></p>
        </div>
      </section>
    </>
  );
}
