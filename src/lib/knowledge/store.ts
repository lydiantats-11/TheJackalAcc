/**
 * Knowledge entries the site may show. Public pages read ONLY `visibleEntries()`:
 *   - entries of the register that pass the publication gate (today: none — nothing is approved);
 *   - in the preview, and only when JACKAL_KNOWLEDGE_FIXTURES=1, the synthetic fixtures, always flagged `synthetic`
 *     so every page shows the «test content» banner.
 * The register itself (221 planned entries, drafts included) is never rendered.
 */
import register from "../../../data/knowledge/register.json";
import fixtures from "../../../data/knowledge/dev-fixtures.json";
import { KINDS, TOPICS, publicationGate, type Entry, type Kind, type TopicId } from "./schema";

const REGISTER = (register as unknown as { entries: Entry[] }).entries;
const FIXTURES = (fixtures as unknown as { entries: Entry[] }).entries.map((e) => ({ ...e, synthetic: true as const }));

export const fixturesEnabled = () => process.env.JACKAL_KNOWLEDGE_FIXTURES === "1";

/** Register entries that pass the gate. */
export function publishedEntries(): Entry[] {
  return REGISTER.filter((e) => publicationGate(e).ok);
}

/** What the public pages show: published entries, plus synthetic fixtures in the preview only. */
export function visibleEntries(withFixtures = fixturesEnabled()): Entry[] {
  return [...publishedEntries(), ...(withFixtures ? FIXTURES : [])];
}

export function entryById(id: string, withFixtures = fixturesEnabled()): Entry | null {
  return visibleEntries(withFixtures).find((e) => e.id === id) ?? null;
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
