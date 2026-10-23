"use client";
/**
 * Γνώση — live search, topic filter and A–Ω index over the entries the server allowed (visibleEntries()).
 * Receives only display fields; never the register. Every item is always in the page (hidden when filtered out), so it
 * works without JavaScript and the static preview copy can filter the same list (scripts/snapshot-assets/snap.js).
 *
 * Modes (owner review, 23 Oct 2026 18:07):
 *   searchOnly — the Γνώση home page: nothing is listed until the visitor types (no 221-entry wall);
 *   compact    — one line per entry (dictionary), with letter headings when not searching.
 */
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { filterAndRank, searchWords } from "@/lib/knowledge/search";

export interface BrowserItem {
  id: string;
  kind: "term" | "article" | "faq";
  topic: string;
  title: string;
  alt: string | null;
  snippet: string;
  letter: string;
  synthetic: boolean;
  /** A register entry shown in the private preview as a draft. */
  isDraft: boolean;
  /** Folded text of both languages, for search. */
  hay: string;
  /** Folded titles (both languages): matches in the title come first. */
  ft: string;
}

export interface BrowserLabels {
  searchLabel: string; searchPlaceholder: string; searchButton: string; all: string; allTopics: string; topicLabel: string;
  letters: string; noResults: string;
  /** Plain strings only: a client component cannot receive functions from the server. */
  results: { one: string; many: string }; fixtureTag: string; draftTag: string; empty: string;
  pending: string; reviewFlag: string;
  kindName: Record<string, string>;
}

export function KnowledgeBrowser({
  items, topics, letters, labels, initialQ = "", initialTopic = "", showKind = false, showLetters = false, showTopics = true,
  searchOnly = false, compact = false, base = "/gnosi/oros",
}: {
  items: BrowserItem[]; topics: Array<{ id: string; name: string }>; letters: string[]; labels: BrowserLabels;
  initialQ?: string; initialTopic?: string; showKind?: boolean; showLetters?: boolean; showTopics?: boolean;
  searchOnly?: boolean; compact?: boolean; base?: string;
}) {
  const [q, setQ] = useState(initialQ);
  const [topic, setTopic] = useState(initialTopic);
  const [letter, setLetter] = useState("");
  const present = useMemo(() => new Set(items.map((i) => i.letter)), [items]);
  const searching = searchWords(q).length > 0;
  const shown = useMemo(() => filterAndRank(items, q, topic, letter), [items, q, topic, letter]);
  const visible = useMemo(() => new Set(searchOnly && !searching ? [] : shown.map((i) => i.id)), [shown, searchOnly, searching]);
  // Ranked results first, the rest after them (hidden), so every item stays in the page.
  // Not searching: alphabetical order as given (letter headings stay with their entries).
  const ordered = useMemo(() => (searching ? [...shown, ...items.filter((i) => !shown.includes(i))] : items), [searching, shown, items]);
  const usedTopics = topics.filter((t) => items.some((i) => i.topic === t.id));
  const heads = compact && showLetters && !searching; // letter headings only in the dictionary
  const n = visible.size;

  return (
    <div className={`kn-browser${compact ? " is-compact" : ""}`} data-search-only={searchOnly || undefined} data-compact={compact || undefined}>
      <form role="search" className="kn-search" action="" method="get" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="kn-q" className="visually-hidden">{labels.searchLabel}</label>
        <input id="kn-q" name="q" type="search" value={q} placeholder={labels.searchPlaceholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary" type="submit">{labels.searchButton}</button>
      </form>

      {showTopics && usedTopics.length > 1 && (
        <div className="kn-chips" role="group" aria-label={labels.topicLabel}>
          <button type="button" className="chip" data-topic="" aria-pressed={!topic} onClick={() => setTopic("")}>{labels.allTopics}</button>
          {usedTopics.map((t) => (
            <button key={t.id} type="button" className="chip" data-topic={t.id} aria-pressed={topic === t.id} onClick={() => setTopic(topic === t.id ? "" : t.id)}>{t.name}</button>
          ))}
        </div>
      )}

      {showLetters && (
        <nav className="kn-letters" aria-label={labels.letters}>
          <button type="button" data-letter="" aria-pressed={!letter} onClick={() => setLetter("")}>{labels.all}</button>
          {letters.filter((l) => present.has(l) || /\p{Script=Greek}/u.test(l)).map((l) => (
            <button key={l} type="button" data-letter={l} disabled={!present.has(l)} aria-pressed={letter === l} onClick={() => setLetter(letter === l ? "" : l)}>{l}</button>
          ))}
        </nav>
      )}

      <p className="small muted kn-count" aria-live="polite" data-one={labels.results.one} data-many={labels.results.many} hidden={searchOnly && !searching} style={{ margin: "4px 0 12px" }}>
        {items.length ? `${n} ${n === 1 ? labels.results.one : labels.results.many}` : null}
      </p>

      {!items.length ? <p className="kn-empty">{labels.empty}</p> : (
        <>
          <p className="kn-empty kn-noresults" hidden={!(n === 0 && (!searchOnly || searching))}>{labels.noResults}</p>
          <ul className={compact ? "kn-compact" : "kn-list"}>
            {ordered.map((i, idx) => {
              const prev = ordered[idx - 1];
              const head = heads && i.letter !== prev?.letter;
              const hidden = !visible.has(i.id);
              return (
                <Fragment key={i.id}>
                  {head && <li className="kn-letter-head" data-letter-head={i.letter} aria-hidden="true" hidden={!ordered.some((x) => x.letter === i.letter && visible.has(x.id))}>{i.letter}</li>}
                  {compact ? (
                    <li className="kn-row kn-item" data-entry-id={i.id} hidden={hidden} data-synthetic={i.synthetic || undefined} data-draft={i.isDraft || undefined} data-topic={i.topic} data-letter={i.letter} data-hay={i.hay} data-ft={i.ft}>
                      <Link href={`${base}/${i.id}`}>
                        <span className="kn-item-title kn-row-title">{i.title}</span>
                        {i.alt && <span className="kn-row-alt">{i.alt}</span>}
                      </Link>
                      <span className="kn-row-meta">
                        {!i.snippet && <span className="kn-pending" data-pending>{labels.pending}</span>}
                        {i.isDraft && <span className="kn-flag">{labels.reviewFlag}</span>}
                        {i.synthetic && <span className="tag gold">{labels.fixtureTag}</span>}
                      </span>
                    </li>
                  ) : (
                    <li className="kn-item" data-entry-id={i.id} hidden={hidden} data-synthetic={i.synthetic || undefined} data-draft={i.isDraft || undefined} data-topic={i.topic} data-letter={i.letter} data-hay={i.hay} data-ft={i.ft}>
                      <Link href={`${base}/${i.id}`}>
                        <span className="kn-item-title">{i.title}</span>
                        {i.alt && <span className="kn-item-alt">{i.alt}</span>}
                      </Link>
                      {i.snippet ? <p>{i.snippet}</p> : <p className="kn-pending" data-pending>{labels.pending}</p>}
                      <div className="kn-item-tags">
                        {showKind && <span className="tag">{labels.kindName[i.kind]}</span>}
                        <span className="tag">{topics.find((t) => t.id === i.topic)?.name}</span>
                        {i.synthetic && <span className="tag gold">{labels.fixtureTag}</span>}
                        {i.isDraft && <span className="kn-flag">{labels.reviewFlag}</span>}
                      </div>
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
