import type { OpportunityForMatching } from "@/lib/domain/eligibility";
import type { RequirementRecord } from "@/lib/domain/engine/requirement";

export const NOW = new Date("2026-10-13T09:00:00Z");
let n = 0;

/** Builds a SYNTHETIC requirement record (test data). */
export function rec(category: string, value: unknown, o: Partial<RequirementRecord> = {}): RequirementRecord {
  n++;
  return {
    id: `synthetic-req-${n}`, key: o.key ?? `${category}-${n}`, version: 1, category, kind: "mandatory", value,
    original_text: `[TEST] ${category} rule`, original_lang: "en",
    evidence: { source_url: "https://test-data.example/call", excerpt: "synthetic" },
    evidence_rank: 1, confidence: "high", flags: [], ...o,
  };
}

export function opp(requirements: RequirementRecord[], o: Partial<OpportunityForMatching> = {}): OpportunityForMatching {
  return {
    id: "synthetic-opp", version: 1, status: "open", opportunity_type: "grant",
    closes_at: new Date(NOW.getTime() + 30 * 86_400_000), deadline_kind: "official", last_verified_at: NOW,
    requirement_set_completeness: "complete", requirements, ...o,
  };
}
