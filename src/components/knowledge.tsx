/**
 * Γνώση — shared pieces for the four sections (server components).
 */
import Link from "next/link";
import { fold } from "@/lib/text/search";
import { TOPICS, indexLetter, linkParts, sectionOfKind, type Entry, type Locale } from "@/lib/knowledge/schema";
import { entryById } from "@/lib/knowledge/store";
import type { SiteCopy } from "@/lib/site/copy";
import type { BrowserItem, BrowserLabels } from "./knowledge-browser";

export const sectionHref = (id: string) => (id === "lexiko" ? "/gnosi/lexiko" : id === "vasika" ? "/gnosi/vasika" : id === "syxnes-erotiseis" ? "/gnosi/syxnes-erotiseis" : "/gnosi/themata");
export const entryHref = (id: string) => `/gnosi/oros/${id}`;
export const topicHref = (id: string) => `/gnosi/themata/${id}`;

const title = (e: Entry, l: Locale) => e.title[l] ?? e.title.el ?? e.id;

/** Plain text with [[ID]] links removed to their label (for snippets and search). */
export function plain(text: string, l: Locale): string {
  return linkParts(text).map((p) => ("text" in p ? p.text : p.label ?? (entryById(p.id) ? title(entryById(p.id)!, l) : ""))).join("");
}

export function toItems(entries: Entry[], l: Locale): BrowserItem[] {
  return entries.map((e) => {
    const body = e.body ? plain(e.body[l] ?? e.body.el, l) : "";
    const t = title(e, l);
    const other = l === "el" ? e.title.en : e.title.el;
    return {
      id: e.id, kind: e.kind, topic: e.topic, title: t, alt: other && other !== t ? other : null,
      snippet: body.length > 180 ? `${body.slice(0, 177).trimEnd()}…` : body,
      letter: indexLetter(t), synthetic: !!e.synthetic, isDraft: !!e.draftPreview,
      hay: fold([e.title.el, e.title.en, e.body?.el, e.body?.en].filter(Boolean).join(" ")),
      ft: [e.title.el, e.title.en].filter(Boolean).map((x) => fold(x!).replace(/[^\p{L}\p{N}]+/gu, " ").trim()).join("|"),
    };
  });
}

export function browserLabels(s: SiteCopy, l: Locale): BrowserLabels {
  const k = s.knowledge;
  return {
    searchLabel: k.searchLabel, searchPlaceholder: k.searchPlaceholder, searchButton: k.searchButton, all: k.all, allTopics: k.allTopics,
    topicLabel: k.topicLabel, letters: k.letters, noResults: k.noResults, results: { one: k.results(1).replace(/^1 /, ""), many: k.results(2).replace(/^2 /, "") }, fixtureTag: k.fixtureTag, draftTag: k.draftTag, empty: k.empty,
    kindName: { term: sectionOfKind("term").name[l], article: sectionOfKind("article").name[l], faq: sectionOfKind("faq").name[l] },
  };
}

export const topicOptions = (l: Locale) => TOPICS.map((t) => ({ id: t.id, name: t.name[l] }));

/** Text with [[ID]] / [[ID|label]] turned into links to entries that are visible; others stay plain text. */
export function RichText({ text, locale }: { text: string; locale: Locale }) {
  return (
    <>
      {linkParts(text).map((p, i) => {
        if ("text" in p) return <span key={i}>{p.text}</span>;
        const target = entryById(p.id);
        const label = p.label ?? (target ? title(target, locale) : "");
        return target ? <Link key={i} href={entryHref(target.id)}>{label}</Link> : <span key={i}>{label}</span>;
      })}
    </>
  );
}

export function FixtureBanner({ s }: { s: SiteCopy }) {
  return <div className="notice kn-fixture" role="note" data-fixture-banner><strong>{s.knowledge.fixtureBanner}</strong></div>;
}

/** Private preview of the K1 register: every page says the entries are drafts, not verified and not approved. */
export function DraftBanner({ s }: { s: SiteCopy }) {
  return <div className="notice kn-fixture" role="note" data-draft-banner><strong>{s.knowledge.draftBanner}</strong></div>;
}

/** Card of one entry, by id, for "see also" lists. */
export function RelatedList({ ids, locale, s }: { ids: string[]; locale: Locale; s: SiteCopy }) {
  const items = ids.map((id) => entryById(id)).filter((e): e is Entry => !!e);
  if (!items.length) return null;
  return (
    <section className="kn-related" aria-labelledby="kn-related">
      <h2 id="kn-related">{s.knowledge.related}</h2>
      <ul>
        {items.map((e) => (
          <li key={e.id}>
            <Link href={entryHref(e.id)}>{title(e, locale)}</Link>
            <span className="muted small"> · {sectionOfKind(e.kind).name[locale]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TopicTiles({ entries, locale }: { entries: Entry[]; locale: Locale }) {
  return (
    <ul className="kn-topics">
      {TOPICS.map((t) => {
        const n = entries.filter((e) => e.topic === t.id).length;
        return (
          <li key={t.id}>
            <Link href={topicHref(t.id)} className="kn-topic" data-topic={t.id}>
              <strong>{t.name[locale]}</strong>
              <span className="small muted">{t.scope[locale]}</span>
              <span className="xs muted">{n}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
