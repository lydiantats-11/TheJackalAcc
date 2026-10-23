import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { SITE } from "@/lib/site/copy";
import { formatDay } from "@/lib/format";
import { sectionOfKind, topicById } from "@/lib/knowledge/schema";
import { entryById } from "@/lib/knowledge/store";
import { RelatedList, RichText, sectionHref, topicHref } from "@/components/knowledge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { locale } = await getDict();
  const e = entryById((await params).id);
  return e ? { title: `${e.title[locale] ?? e.title.el} · ${SITE[locale].knowledge.title}` } : {};
}

const day = (iso: string | null | undefined, l: "el" | "en") => (iso ? formatDay(new Date(`${iso}T12:00:00Z`), l, "UTC") ?? iso : null);

/**
 * One Knowledge entry. Only entries that pass the publication gate exist here (plus synthetic fixtures in the preview,
 * under the banner); anything else is «not found», even by direct address.
 */
export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale } = await getDict();
  const s = SITE[locale];
  const k = s.knowledge;
  const e = entryById((await params).id);
  if (!e) notFound();
  const section = sectionOfKind(e.kind);
  const topic = topicById(e.topic)!;
  const other = locale === "el" ? e.title.en : e.title.el;
  return (
    <article className="kn-entry" data-entry={e.id} data-synthetic={e.synthetic || undefined}>
      <nav className="crumbs small" aria-label={k.section}>
        <Link href="/gnosi">{k.title}</Link> / <Link href={sectionHref(section.id)}>{section.name[locale]}</Link>
      </nav>
      <header className="page-head">
        <h1>{e.title[locale] ?? e.title.el}</h1>
        {other && <p className="kn-alt" lang={locale === "el" ? "en" : "el"}>{other}</p>}
        <div className="tags">
          <span className="tag">{section.name[locale]}</span>
          <Link className="tag" href={topicHref(topic.id)}>{topic.name[locale]}</Link>
          {e.synthetic && <span className="tag gold">{k.fixtureTag}</span>}
        </div>
      </header>
      {e.body && <div className="kn-body"><p><RichText text={e.body[locale] ?? e.body.el} locale={locale} /></p></div>}
      <section className="kn-sources" aria-labelledby="kn-src">
        <h2 id="kn-src">{k.source}</h2>
        {e.sources.length ? (
          <ul>
            {e.sources.map((src) => (
              <li key={src.url}>
                <a href={src.url} target="_blank" rel="noopener noreferrer">{src.label}</a> — {src.locator}
                <span className="muted small"> · {k.checked} {day(src.checked_on, locale)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{k.noSource}</p>}
        {e.editorial_review && <p className="xs muted">{k.reviewed}: {day(e.editorial_review.on, locale)}</p>}
      </section>
      <RelatedList ids={e.related} locale={locale} s={s} />
      <p className="xs muted kn-note">{k.notAdvice}</p>
      <p><Link href="/gnosi">← {k.back}</Link></p>
    </article>
  );
}
