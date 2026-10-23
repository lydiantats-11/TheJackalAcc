import Link from "next/link";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { titled } from "@/lib/site/page-title";
import { sectionById } from "@/lib/knowledge/schema";
import { registerCounts, visibleComparisons, visibleEntries } from "@/lib/knowledge/store";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { TopicTiles, browserLabels, sectionHref, toItems, topicHref, topicOptions } from "@/components/knowledge";

export const generateMetadata = titled(({ s }) => s.knowledge.title);

/**
 * Γνώση — home (owner review, 23 Oct 2026 18:07): a prominent search, then the eight topics as the main way in, then
 * «Μάθε και σύγκρινε», then the sections. Entries are listed only when the visitor searches — never all at once here.
 */
export default async function KnowledgeHome({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const k = s.knowledge;
  const entries = visibleEntries();
  const counts = registerCounts();
  const comparisons = visibleComparisons();
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const sections = (["lexiko", "vasika", "syxnes-erotiseis"] as const).map((id) => sectionById(id));
  return (
    <>
      <header className="page-head kn-hero">
        <h1>{k.title}</h1>
        <p className="lead">{k.hubLead}</p>
      </header>

      <section aria-label={k.searchLabel} className="kn-hub-search">
        {entries.length ? (
          <KnowledgeBrowser items={toItems(entries, locale)} topics={topicOptions(locale)} letters={[]}
            labels={{ ...browserLabels(s, locale), searchPlaceholder: k.searchPrompt }} initialQ={q} showKind showTopics={false} searchOnly />
        ) : (
          <p className="kn-empty">{k.empty}</p>
        )}
      </section>

      <section aria-labelledby="kn-topics" className="kn-block">
        <h2 id="kn-topics">{k.exploreTopics}</h2>
        <TopicTiles entries={entries} locale={locale} s={s} />
      </section>

      {comparisons.length > 0 && (
        <section aria-labelledby="kn-compare" className="kn-block">
          <h2 id="kn-compare">{k.learnCompare}</h2>
          <ul className="kn-teasers">
            {comparisons.map((c) => (
              <li key={c.id}>
                <Link href={`${topicHref(c.topic)}#${c.id.toLowerCase()}`} className="card kn-teaser" data-comparison-teaser={c.id}>
                  <strong>{c.title[locale]}</strong>
                  <span className="small">{c.lead[locale]}</span>
                  {!c.publication.approved && <span className="kn-flag">{k.comparisonStatus}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="kn-sections" className="kn-block">
        <h2 id="kn-sections">{k.browseSections}</h2>
        <ul className="kn-sections">
          {sections.map((x) => {
            const n = entries.filter((e) => e.kind === x.kind).length;
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

      <section aria-labelledby="kn-status" className="kn-block kn-status">
        <h2 id="kn-status">{k.statusTitle}</h2>
        <p className="small">{k.status(counts.total, counts.published)}</p>
        <p className="small muted">{k.universal}</p>
      </section>
    </>
  );
}
