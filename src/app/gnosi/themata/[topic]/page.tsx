import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { sectionById, byTitle, topicById } from "@/lib/knowledge/schema";
import { visibleComparisons, visibleEntries } from "@/lib/knowledge/store";
import { ComparisonTable, CompactList, sectionHref } from "@/components/knowledge";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { locale } = await getDict();
  const t = topicById((await params).topic);
  return t ? { title: `${t.name[locale]} · ${SITE[locale].knowledge.title}` } : {};
}

/**
 * One topic (owner review, 23 Oct 2026 18:07): everything about it in one place, grouped as
 * Μάθε τα βασικά · Συγκρίσεις (when there are any) · Λεξικό · Συχνές Ερωτήσεις — sections of this page, not new tabs.
 */
export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const k = s.knowledge;
  const t = topicById((await params).topic);
  if (!t) notFound();
  const mine = visibleEntries().filter((e) => e.topic === t.id).sort(byTitle(locale));
  const comparisons = visibleComparisons().filter((c) => c.topic === t.id);
  const group = (kind: "article" | "term" | "faq", id: "vasika" | "lexiko" | "syxnes-erotiseis") => {
    const list = mine.filter((e) => e.kind === kind);
    const sec = sectionById(id);
    return (
      <section key={id} className="kn-topic-section" aria-labelledby={`sec-${id}`} data-topic-section={id}>
        <div className="kn-topic-section-head">
          <h2 id={`sec-${id}`}>{sec.name[locale]} <span className="kn-n">{list.length}</span></h2>
          <Link className="small" href={sectionHref(id)}>{k.allInSection} →</Link>
        </div>
        {list.length ? <CompactList entries={list} locale={locale} s={s} letters={kind === "term" && list.length > 12} /> : <p className="kn-empty small">{k.sectionEmpty}</p>}
      </section>
    );
  };
  return (
    <>
      <nav className="crumbs small" aria-label={k.section}>
        <Link href="/gnosi">{k.title}</Link> / <Link href="/gnosi/themata">{sectionById("themata").name[locale]}</Link>
      </nav>
      <header className="page-head">
        <h1>{t.name[locale]}</h1>
        <p className="lead">{t.scope[locale]}</p>
        <p className="small muted">{mine.length ? k.kindCounts(mine.filter((e) => e.kind === "term").length, mine.filter((e) => e.kind === "article").length, mine.filter((e) => e.kind === "faq").length) : k.count(0)}</p>
      </header>
      {group("article", "vasika")}
      {comparisons.length > 0 && (
        <section className="kn-topic-section" aria-labelledby="sec-compare" data-topic-section="sygkriseis">
          <div className="kn-topic-section-head"><h2 id="sec-compare">{k.comparisons} <span className="kn-n">{comparisons.length}</span></h2></div>
          {comparisons.map((c) => <ComparisonTable key={c.id} c={c} locale={locale} s={s} />)}
        </section>
      )}
      {group("term", "lexiko")}
      {group("faq", "syxnes-erotiseis")}
    </>
  );
}
