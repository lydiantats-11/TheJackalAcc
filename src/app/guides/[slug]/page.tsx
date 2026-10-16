import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { SITE } from "@/lib/site/copy";
import { guideBySlug } from "@/lib/site/guides";
import { categoryBySlug } from "@/lib/site/taxonomy";
import { Icon } from "@/components/icons";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { locale } = await getDict();
  const g = guideBySlug((await params).slug);
  return g ? { title: g.title[locale] } : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });

  if (g.kind === "general") {
    return (
      <div className="container">
        <div className="page-head">
          <div className="crumbs"><Link href="/guides">{s.guides.back}</Link></div>
          <h1>{g.title[locale]}</h1>
          <p className="lead">{g.summary[locale]}</p>
        </div>
        <div className="prose stack-lg">
          {g.sections.map((sec) => (
            <section key={sec.h.en} className="card">
              <h2 style={{ marginTop: 0 }}>{sec.h[locale]}</h2>
              <ul className="checklist">{sec.items.map((i) => <li key={i.en}><Icon name="check" size={18} /><span>{i[locale]}</span></li>)}</ul>
            </section>
          ))}
        </div>
      </div>
    );
  }

  // Link to the listing only when it is public (approved) in this database.
  const [rec] = isDatabaseConfigured()
    ? await sql()<{ id: string }[]>`SELECT id FROM opportunities WHERE external_key = ${g.recordKey} AND review_status = 'approved' AND merged_into_id IS NULL LIMIT 1`.catch(() => [])
    : [];
  const cat = categoryBySlug(g.categories[0]);
  return (
    <div className="container">
      <div className="page-head">
        <div className="crumbs"><Link href="/guides">{s.guides.back}</Link>{cat && <> / {cat.name[locale]}</>}</div>
        <h1>{g.title[locale]}</h1>
        <p className="muted" style={{ margin: 0 }}>{g.authority[locale]} · {s.guides.checked(day(g.checkedOn))}</p>
      </div>
      <div className="with-aside-r">
        <div className="prose stack-lg">
          <div className="notice info"><Icon name="info" size={18} /><span>{s.guides.lead}</span></div>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{s.guides.what}</h2>
            <p style={{ margin: 0 }}>{g.summary[locale]}</p>
          </section>
          {g.who.length > 0 && (
            <section className="card">
              <h2 style={{ marginTop: 0 }}>{s.guides.who}</h2>
              <ul className="checklist">{g.who.map((w) => <li key={w.en}><Icon name="check" size={18} /><span>{w[locale]}</span></li>)}</ul>
            </section>
          )}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{s.guides.how}</h2>
            <ol>{g.steps[locale].map((st) => <li key={st}>{st}</li>)}</ol>
            <h3 style={{ marginTop: 18 }}>{s.guides.docs}</h3>
            <p className="small muted" style={{ margin: 0 }}>{s.guides.docsNote}</p>
          </section>
          {g.warnings.length > 0 && (
            <section className="card gold">
              <h2 style={{ marginTop: 0 }}>{s.guides.warnings}</h2>
              <ul className="checklist">{g.warnings.map((w) => <li key={w.en}><Icon name="alert" size={18} /><span>{w[locale]}</span></li>)}</ul>
            </section>
          )}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>{s.guides.sources}</h2>
            <ul className="checklist small">{g.sources.map((src) => <li key={src.url}><Icon name="external" size={16} /><a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a></li>)}</ul>
          </section>
        </div>
        <aside className="sticky">
          <div className="card keyinfo">
            <dl>
              <div><dt>{s.guides.deadline}</dt><dd>{g.deadline ? g.deadline[locale] : <span className="unknown">{s.guides.notStated}</span>}</dd></div>
              <div><dt>{s.guides.amount}</dt><dd>{g.amount ? g.amount[locale] : <span className="unknown">{s.guides.notStated}</span>}</dd></div>
            </dl>
            <div className="stack" style={{ marginTop: 14 }}>
              {g.applyUrl && <a className="btn btn-primary btn-block" href={g.applyUrl} target="_blank" rel="noopener noreferrer">{s.guides.apply} <Icon name="external" size={16} /></a>}
              {rec && <Link className="btn btn-ghost btn-block" href={`/opportunities/${rec.id}`}>{s.guides.record}</Link>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
