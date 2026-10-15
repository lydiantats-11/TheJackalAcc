import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { GENERAL_GUIDES, PROGRAMME_GUIDES } from "@/lib/site/guides";
import { categoryBySlug } from "@/lib/site/taxonomy";
import { Icon } from "@/components/icons";

export const metadata = { title: "Οδηγοί / Guides" };

export default async function GuidesPage() {
  const { locale } = await getDict();
  const s = SITE[locale];
  const statusLabel: Record<string, string> = locale === "el"
    ? { open: "Ανοιχτή", rolling: "Συνεχής υποβολή", closed: "Κλειστή", future: "Μελλοντική" }
    : { open: "Open", rolling: "Rolling", closed: "Closed", future: "Future" };
  return (
    <div className="container">
      <div className="page-head">
        <h1>{s.guides.title}</h1>
        <p className="lead">{s.guides.lead}</p>
      </div>

      <h2 style={{ marginTop: 8 }}>{s.guides.general}</h2>
      <div className="grid2">
        {GENERAL_GUIDES.map((g) => (
          <Link key={g.slug} href={`/guides/${g.slug}`} className="card card-link cat-card">
            <span className="icon-tile gold"><Icon name="book" /></span>
            <h3>{g.title[locale]}</h3>
            <p>{g.summary[locale]}</p>
            <div className="foot"><strong>{s.guides.read}</strong><Icon name="arrow" size={16} /></div>
          </Link>
        ))}
      </div>

      <h2>{s.guides.programmes}</h2>
      <div className="grid3">
        {PROGRAMME_GUIDES.map((g) => {
          const cat = categoryBySlug(g.categories[0]);
          return (
            <Link key={g.slug} href={`/guides/${g.slug}`} className="card card-link cat-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="icon-tile navy"><Icon name={cat?.icon ?? "book"} /></span>
                <span className={`badge ${g.status === "open" || g.status === "rolling" ? "b-ok" : ""}`}>{statusLabel[g.status] ?? g.status}</span>
              </div>
              <h3>{g.title[locale]}</h3>
              <p>{g.summary[locale]}</p>
              <div className="foot"><span>{s.guides.checked(new Date(`${g.checkedOn}T12:00:00Z`).toLocaleDateString(locale === "el" ? "el-GR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }))}</span><Icon name="arrow" size={16} /></div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
