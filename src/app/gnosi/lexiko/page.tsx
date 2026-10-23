import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { titled } from "@/lib/site/page-title";
import { GREEK_LETTERS, LATIN_LETTERS, sectionById, byTitle } from "@/lib/knowledge/schema";
import { visibleEntries } from "@/lib/knowledge/store";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { browserLabels, toItems, topicOptions } from "@/components/knowledge";

const SECTION = sectionById("lexiko");
export const generateMetadata = titled(({ s }) => `${SECTION.name[s === SITE.el ? "el" : "en"]} · ${s.knowledge.title}`);

/** Γνώση — «${SECTION.name.el}»: entries of one kind only (the same records the other sections link to). */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; topic?: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const sp = await searchParams;
  const entries = visibleEntries().filter((e) => e.kind === "term").sort(byTitle(locale));
  return (
    <>
      <header className="page-head">
        <h1>{SECTION.name[locale]}</h1>
        <p className="lead">{SECTION.lead[locale]}</p>
      </header>
      <KnowledgeBrowser items={toItems(entries, locale)} topics={topicOptions(locale)} letters={[...GREEK_LETTERS, ...LATIN_LETTERS]}
        labels={browserLabels(s, locale)} initialQ={(sp.q ?? "").slice(0, 100)} initialTopic={sp.topic ?? ""} showLetters={true} />
    </>
  );
}
