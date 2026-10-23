/**
 * Γνώση search (owner, 23 Oct 2026): every query word must appear (accents and case ignored, Greek or English); results
 * keep alphabetical order, ranked: 0 exact title; 1 a title word starts with each query word; 2 a word of the text
 * starts with each query word; 3 the letters only appear inside a word. So «ΙΚΕ» lists the entry «ΙΚΕ», then
 * «Ποια η διαφορά ΙΚΕ και…», before entries that merely contain «φορολογικές».
 * Shared by the page (knowledge-browser.tsx) and mirrored in the static preview copy (scripts/snapshot-assets/snap.js).
 */
import { fold } from "@/lib/text/search";

export interface Searchable { topic: string; letter: string; hay: string; ft: string }

export function searchWords(q: string): string[] {
  return fold(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function filterAndRank<T extends Searchable>(items: T[], q: string, topic = "", letter = ""): T[] {
  const words = searchWords(q);
  const found = items.filter((i) => (!topic || i.topic === topic) && (!letter || i.letter === letter) && words.every((w) => i.hay.includes(w)));
  if (!words.length) return found;
  const whole = words.join(" ");
  const starts = (text: string) => { const ws = text.split(/[^\p{L}\p{N}]+/u); return words.every((w) => ws.some((x) => x.startsWith(w))); };
  const rank = (i: T) => (i.ft.split("|").includes(whole) ? 0 : starts(i.ft) ? 1 : starts(i.hay) ? 2 : 3);
  return found.map((i, n) => ({ i, n, r: rank(i) })).sort((a, b) => a.r - b.r || a.n - b.n).map((x) => x.i);
}
