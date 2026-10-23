"use client";
/**
 * Γνώση — live search, topic filter and A–Ω index over the entries the server allowed (visibleEntries()).
 * Receives only display fields; never the register. Works without JavaScript too: the server renders the full list and
 * the search form submits ?q= to the same page.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { fold } from "@/lib/text/search";

export interface BrowserItem {
  id: string;
  kind: "term" | "article" | "faq";
  topic: string;
  title: string;
  alt: string | null;
  snippet: string;
  letter: string;
  synthetic: boolean;
  /** Folded text of both languages, for search. */
  hay: string;
}

export interface BrowserLabels {
  searchLabel: string; searchPlaceholder: string; searchButton: string; all: string; allTopics: string; topicLabel: string;
  letters: string; noResults: string; results: (n: number) => string; fixtureTag: string; empty: string;
  kindName: Record<string, string>;
}

export function KnowledgeBrowser({ items, topics, letters, labels, initialQ = "", initialTopic = "", showKind = false, showLetters = false, base = "/gnosi/oros" }: {
  items: BrowserItem[]; topics: Array<{ id: string; name: string }>; letters: string[]; labels: BrowserLabels;
  initialQ?: string; initialTopic?: string; showKind?: boolean; showLetters?: boolean; base?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [topic, setTopic] = useState(initialTopic);
  const [letter, setLetter] = useState("");
  const present = useMemo(() => new Set(items.map((i) => i.letter)), [items]);
  const shown = useMemo(() => {
    const words = fold(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return items.filter((i) => (!topic || i.topic === topic) && (!letter || i.letter === letter) && words.every((w) => i.hay.includes(w)));
  }, [items, q, topic, letter]);
  const usedTopics = topics.filter((t) => items.some((i) => i.topic === t.id));

  return (
    <div className="kn-browser">
      <form role="search" className="kn-search" action="" method="get" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="kn-q" className="visually-hidden">{labels.searchLabel}</label>
        <input id="kn-q" name="q" type="search" value={q} placeholder={labels.searchPlaceholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary" type="submit">{labels.searchButton}</button>
      </form>

      {usedTopics.length > 1 && (
        <div className="kn-chips" role="group" aria-label={labels.topicLabel}>
          <button type="button" className="chip" aria-pressed={!topic} onClick={() => setTopic("")}>{labels.allTopics}</button>
          {usedTopics.map((t) => (
            <button key={t.id} type="button" className="chip" aria-pressed={topic === t.id} onClick={() => setTopic(topic === t.id ? "" : t.id)}>{t.name}</button>
          ))}
        </div>
      )}

      {showLetters && (
        <nav className="kn-letters" aria-label={labels.letters}>
          <button type="button" aria-pressed={!letter} onClick={() => setLetter("")}>{labels.all}</button>
          {letters.map((l) => (
            <button key={l} type="button" disabled={!present.has(l)} aria-pressed={letter === l} onClick={() => setLetter(letter === l ? "" : l)}>{l}</button>
          ))}
        </nav>
      )}

      <p className="small muted" aria-live="polite" style={{ margin: "4px 0 12px" }}>{items.length ? labels.results(shown.length) : null}</p>

      {!items.length ? <p className="kn-empty">{labels.empty}</p> : !shown.length ? <p className="kn-empty">{labels.noResults}</p> : (
        <ul className="kn-list">
          {shown.map((i) => (
            <li key={i.id} className="kn-item" data-synthetic={i.synthetic || undefined}>
              <Link href={`${base}/${i.id}`}>
                <span className="kn-item-title">{i.title}</span>
                {i.alt && <span className="kn-item-alt">{i.alt}</span>}
              </Link>
              <p>{i.snippet}</p>
              <div className="kn-item-tags">
                {showKind && <span className="tag">{labels.kindName[i.kind]}</span>}
                <span className="tag">{topics.find((t) => t.id === i.topic)?.name}</span>
                {i.synthetic && <span className="tag gold">{labels.fixtureTag}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
