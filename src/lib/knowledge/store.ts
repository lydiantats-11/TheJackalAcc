/**
 * Knowledge entries the site may show. Public pages read ONLY `visibleEntries()`:
 *   - entries of the register that pass the publication gate (today: none — nothing is approved);
 *   - in the private preview, and only when JACKAL_KNOWLEDGE_DRAFTS=1 (owner decision, 23 Oct 2026 16:19: «Preview
 *     only, marked draft»), every register entry that is not published, flagged `draftPreview` so every page shows the
 *     «draft — not verified, not approved» banner; its draft text if the workbook has one, otherwise the title only;
 *   - for local development only, when JACKAL_KNOWLEDGE_FIXTURES=1, the synthetic fixtures, flagged `synthetic`.
 * Without those switches (production) the register is never rendered.
 */
import register from "../../../data/knowledge/register.json";
import fixtures from "../../../data/knowledge/dev-fixtures.json";
import { KINDS, TOPICS, publicationGate, type Entry, type Kind, type TopicId } from "./schema";

const REGISTER = (register as unknown as { entries: Entry[] }).entries;
const FIXTURES = (fixtures as unknown as { entries: Entry[] }).entries.map((e) => ({ ...e, synthetic: true as const }));

export const fixturesEnabled = () => process.env.JACKAL_KNOWLEDGE_FIXTURES === "1";
export const draftsEnabled = () => process.env.JACKAL_KNOWLEDGE_DRAFTS === "1";

type DraftText = { el?: string | null; en?: string | null } | null | undefined;
/** A register entry as a preview draft: the workbook's draft text (never approved), no source claimed. */
function asDraft(e: Entry): Entry {
  const d = e.draft as DraftText;
  const el = d?.el?.trim() || null;
  const en = d?.en?.trim() || null;
  return { ...e, body: el ? { el, en: en ?? "" } : null, sources: [], editorial_review: null, draftPreview: true };
}
const DRAFTS = REGISTER.filter((e) => !publicationGate(e).ok).map(asDraft);

/** Register entries that pass the gate. */
export function publishedEntries(): Entry[] {
  return REGISTER.filter((e) => publicationGate(e).ok);
}

/** What the pages show: published entries; in the private preview also the drafts (and, in development, fixtures). */
export function visibleEntries(withFixtures = fixturesEnabled(), withDrafts = draftsEnabled()): Entry[] {
  return [...publishedEntries(), ...(withDrafts ? DRAFTS : []), ...(withFixtures ? FIXTURES : [])];
}

export function entryById(id: string, withFixtures = fixturesEnabled(), withDrafts = draftsEnabled()): Entry | null {
  return visibleEntries(withFixtures, withDrafts).find((e) => e.id === id) ?? null;
}

/** Counts of the register by verification state — numbers only, no content. */
export function registerCounts() {
  const by = (k: Kind) => REGISTER.filter((e) => e.kind === k).length;
  const status = (s: string) => REGISTER.filter((e) => e.verification.status === s).length;
  return {
    total: REGISTER.length,
    kinds: Object.fromEntries(KINDS.map((k) => [k, by(k)])) as Record<Kind, number>,
    published: publishedEntries().length,
    inVerification: REGISTER.length - publishedEntries().length,
    sourceLocated: status("source_located"),
    topics: Object.fromEntries(TOPICS.map((t) => [t.id, REGISTER.filter((e) => e.topic === t.id).length])) as Record<TopicId, number>,
  };
}

export const REGISTER_FOR_TESTS = REGISTER;
export const FIXTURES_FOR_TESTS = FIXTURES;
export const DRAFTS_FOR_TESTS = DRAFTS;
