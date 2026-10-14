/**
 * Programme-level default rules that apply "unless the topic says otherwise".
 * They are attached as INFORMATIONAL records (never decide eligibility) so users see them and are asked about them,
 * until the topic's own conditions have been extracted and reviewed.
 *
 * Evidence: Horizon Europe Work Programme 2026–2027, General Annexes (eligible countries; default consortium).
 * Programme code 43108390 = HORIZON in the EU Funding & Tenders search index (from independent client documentation).
 */
import type { RequirementRecord } from "./engine/requirement";

const HORIZON_ANNEXES = "https://sciencebusiness.net/sites/default/files/inline-files/HORIZON-General-annexes-2026-2027_05_18_2026.pdf";

export const PROGRAMME_DEFAULTS: Record<string, Omit<RequirementRecord, "id" | "version">[]> = {
  "43108390": [
    {
      key: "default_consortium", category: "consortium", kind: "informational",
      value: { min_entities: 3, min_countries: 3 },
      original_text: "[Paraphrase] Unless the topic states otherwise: at least three independent legal entities, each established in a different country, at least one in a Member State.",
      original_lang: "en", interpretation: "Programme default; many topics (e.g. single-beneficiary schemes) differ.",
      evidence: { source_url: HORIZON_ANNEXES, location: "General Annexes — eligibility" }, evidence_rank: 1, confidence: "medium", flags: [],
    },
  ],
};
