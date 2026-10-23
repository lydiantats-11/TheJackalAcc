import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { SECTIONS, byTitle, topicById } from "@/lib/knowledge/schema";
import { visibleEntries } from "@/lib/knowledge/store";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import { browserLabels, toItems, topicOptions } from "@/components/knowledge";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }) {
  const { locale } = await getDict();
  const t = topicById((await params).topic);
  return t ? { title: `${t.name[locale]} · ${SITE[locale].knowledge.title}` } : {};
}

/** One topic: entries of every kind whose primary topic it is, with the kind shown on each. */
export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const t = topicById((await params).topic);
  if (!t) notFound();
  const entries = visibleEntries().filter((e) => e.topic === t.id).sort(byTitle(locale));
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">{SECTIONS[3].name[locale]}</p>
        <h1>{t.name[locale]}</h1>
        <p className="lead">{t.scope[locale]}</p>
      </header>
      <KnowledgeBrowser items={toItems(entries, locale)} topics={topicOptions(locale)} letters={[]} labels={browserLabels(s, locale)} showKind />
    </>
  );
}
