import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { titled } from "@/lib/site/page-title";
import { sectionById } from "@/lib/knowledge/schema";
import { visibleEntries } from "@/lib/knowledge/store";
import { TopicTiles } from "@/components/knowledge";

const SECTION = sectionById("themata");
export const generateMetadata = titled(({ s }) => `${SECTION.name[s === SITE.el ? "el" : "en"]} · ${s.knowledge.title}`);

/** Γνώση — «Θέματα»: the eight topics, a view over the same entries (no copies). */
export default async function TopicsPage() {
  const { locale } = await getDict();
  const s = SITE[locale];
  return (
    <>
      <header className="page-head">
        <h1>{SECTION.name[locale]}</h1>
        <p className="lead">{SECTION.lead[locale]}</p>
      </header>
      <TopicTiles entries={visibleEntries()} locale={locale} s={s} />
    </>
  );
}
