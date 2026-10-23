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
 * One Knowledge entry. Only entries that pass the publication gate exist here; in the private preview also the K1
 * register drafts (marked draft, with their review status) and, in development, synthetic fixtures. Anything else is
 * «not found», even by direct address.
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
  const v = e.verification as { status: string; candidate_authority?: string | null; official_source_candidate?: { url?: string | null; scope?: string | null } | null };
  const text = e.body ? (e.body[locale] || e.body.el) : null;
  const candidate = e.draftPreview && v.official_source_candidate?.url?.startsWith("https://") ? v.official_source_candidate : null;
  return (
    <article className="kn-entry" data-entry={e.id} data-synthetic={e.synthetic || undefined} data-draft={e.draftPreview || undefined}
      data-complete={String(!!(e.title.en && e.body?.en))}>
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
          {e.draftPreview && <span className="tag gold">{k.draftTag}</span>}
        </div>
      </header>
      {e.draftPreview && (
        <p className="notice kn-fixture" role="note">
          <strong>{k.draftNotice}</strong> {k.draftStatus}: {k.draftStates[v.status] ?? v.status} · {e.id}
        </p>
      )}
      {text ? (
        <div className="kn-body">
          <p><RichText text={text} locale={locale} /></p>
          {locale === "en" && e.draftPreview && !e.body?.en && <p className="muted small">{k.draftNoEn}</p>}
        </div>
      ) : e.draftPreview ? <p className="muted">{k.draftNoText}</p> : null}
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
        ) : <p className="muted small">{e.draftPreview ? k.draftNoSource : k.noSource}</p>}
        {candidate && (
          <p className="small">
            {k.draftCandidate}: <a href={candidate.url!} target="_blank" rel="noopener noreferrer">{candidate.scope || v.candidate_authority || candidate.url}</a>
          </p>
        )}
        {e.editorial_review && <p className="xs muted">{k.reviewed}: {day(e.editorial_review.on, locale)}</p>}
      </section>
      <RelatedList ids={e.related} locale={locale} s={s} />
      <p className="xs muted kn-note">{k.notAdvice}</p>
      <p><Link href="/gnosi">← {k.back}</Link></p>
    </article>
  );
}
