import Link from "next/link";
import { getDict } from "@/lib/i18n/server";

export default async function Home() {
  const { t } = await getDict();
  return (
    <div className="stack">
      <section className="hero">
        <h1>{t.landing.title}</h1>
        <p className="lead">{t.landing.body}</p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link href="/opportunities" className="btn btn-primary">{t.landing.ctaBrowse}</Link>
          <Link href="/register" className="btn btn-ghost">{t.landing.ctaRegister}</Link>
        </div>
      </section>
      <div className="notice">{t.landing.status}</div>
      <section className="grid3" style={{ marginTop: 22 }}>
        <div className="card"><h2 style={{ marginTop: 0 }}>{t.landing.p1t}</h2><p className="muted">{t.landing.p1}</p></div>
        <div className="card"><h2 style={{ marginTop: 0 }}>{t.landing.p2t}</h2><p className="muted">{t.landing.p2}</p></div>
        <div className="card"><h2 style={{ marginTop: 0 }}>{t.landing.p3t}</h2><p className="muted">{t.landing.p3}</p></div>
      </section>
    </div>
  );
}
