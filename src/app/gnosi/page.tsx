import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { titled } from "@/lib/site/page-title";
import { SECTIONS } from "@/lib/knowledge/schema";
import { registerCounts, visibleEntries } from "@/lib/knowledge/store";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { TopicTiles, browserLabels, sectionHref, toItems, topicOptions } from "@/components/knowledge";

export const generateMetadata = titled(({ s }) => s.knowledge.title);

/** Γνώση — hub: search across all four sections, the sections, the eight topics, and how content is published. */
export default async function KnowledgeHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const k = s.knowledge;
  const entries = visibleEntries();
  const counts = registerCounts();
  const q = ((await searchParams).q ?? "").slice(0, 100);
  return (
    <>
      <header className="page-head">
        <h1>{k.title}</h1>
        <p className="lead">{k.lead}</p>
        <p className="small muted" style={{ margin: 0 }}>{k.universal}</p>
      </header>

      <section aria-label={k.searchLabel} className="kn-hub-search">
        {q || entries.length ? (
          <KnowledgeBrowser items={toItems(entries, locale)} topics={topicOptions(locale)} letters={[]} labels={browserLabels(s, locale)} initialQ={q} showKind />
        ) : (
          <p className="kn-empty">{k.empty}</p>
        )}
      </section>

      <section aria-labelledby="kn-sections" className="kn-block">
        <h2 id="kn-sections">{k.sectionsTitle}</h2>
        <ul className="kn-sections">
          {SECTIONS.map((x) => {
            const n = x.kind ? entries.filter((e) => e.kind === x.kind).length : entries.length;
            return (
              <li key={x.id}>
                <Link href={sectionHref(x.id)} className="card kn-section" data-section={x.id}>
                  <strong>{x.name[locale]}</strong>
                  <span className="small">{x.lead[locale]}</span>
                  <span className="xs muted">{k.count(n)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="kn-topics" className="kn-block">
        <h2 id="kn-topics">{k.topicsTitle}</h2>
        <TopicTiles entries={entries} locale={locale} />
      </section>

      <section aria-labelledby="kn-status" className="card flat kn-block">
        <h2 id="kn-status" style={{ marginTop: 0, fontSize: "1.05rem" }}>{k.statusTitle}</h2>
        <p className="small" style={{ marginBottom: 0 }}>{k.status(counts.total, counts.published)}</p>
      </section>
    </>
  );
}
