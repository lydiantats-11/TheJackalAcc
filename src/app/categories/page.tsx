import Link from "next/link";
import { titled } from "@/lib/site/page-title";
import { getDict } from "@/lib/i18n/server";
import { isDatabaseConfigured, sql } from "@/lib/db";
import { PERSONA_IDS } from "@/lib/domain/personas";
import { INDUSTRY_IDS } from "@/lib/domain/industries";
import { SITE } from "@/lib/site/copy";
import { CATEGORIES, SUPPORT_TYPES } from "@/lib/site/taxonomy";
import { countByCategory, loadListing } from "@/lib/site/listing";
import { Icon } from "@/components/icons";

export const generateMetadata = titled(({ s }) => s.nav.categories);

export default async function CategoriesPage() {
  const { t, locale } = await getDict();
  const s = SITE[locale];
  const counts = isDatabaseConfigured() ? countByCategory(await loadListing(sql()).catch(() => [])) : {};
  return (
    <div className="container">
      <div className="page-head">
        <h1>{s.cats.title}</h1>
        <p className="lead">{s.cats.lead}</p>
      </div>

      <div className="grid3">
        {CATEGORIES.map((c) => {
          const n = counts[c.slug] ?? { open: 0, total: 0, recheck: 0 };
          return (
            <Link key={c.slug} href={`/opportunities?cat=${c.slug}`} className="card card-link cat-card">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="icon-tile"><Icon name={c.icon} /></span>
                <span className={`tag ${n.open > 0 ? "cat" : ""}`}>{s.cats.count(n.open, n.total, n.recheck)}</span>
              </div>
              <h3>{c.name[locale]}</h3>
              <p>{c.description[locale]}</p>
              <div className="tags" style={{ marginTop: 6 }}>
                {c.subcategories.map((sc) => <span key={sc.en} className="tag">{sc[locale]}</span>)}
              </div>
              <div className="foot">
                <span>{s.cats.forWhom}: {c.audiences.map((a) => t.opt.personas[a] ?? a).join(" · ")}</span>
                <Icon name="arrow" size={16} />
              </div>
            </Link>
          );
        })}
      </div>

      <h2 style={{ marginTop: 48 }}>{s.cats.otherTitle}</h2>
      <div className="grid3">
        <div className="card flat">
          <h3>{s.cats.otherType}</h3>
          <div className="tags">{SUPPORT_TYPES.filter((x) => x !== "unconfirmed").map((x) => <Link key={x} className="chip" href={`/opportunities?type=${x}`}>{s.supportType[x]}</Link>)}</div>
        </div>
        <div className="card flat">
          <h3>{s.cats.otherAudience}</h3>
          <div className="tags">{PERSONA_IDS.map((x) => <Link key={x} className="chip" href={`/opportunities?audience=${x}`}>{t.opt.personas[x] ?? x}</Link>)}</div>
        </div>
        <div className="card flat">
          <h3>{s.cats.otherIndustry}</h3>
          <form action="/opportunities" className="row" style={{ flexWrap: "nowrap" }}>
            <label htmlFor="ind" className="visually-hidden">{s.opps.industry}</label>
            <select id="ind" name="industry" defaultValue="">
              <option value="">{t.opp.allIndustries}</option>
              {INDUSTRY_IDS.map((x) => <option key={x} value={x}>{t.opt.industries[x]}</option>)}
            </select>
            <button className="btn btn-primary btn-sm">{s.opps.apply}</button>
          </form>
          <p className="xs muted" style={{ margin: "10px 0 0" }}>{s.cats.note}</p>
        </div>
      </div>
    </div>
  );
}
