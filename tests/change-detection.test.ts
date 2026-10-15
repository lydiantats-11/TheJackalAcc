import { describe, expect, it } from "vitest";
import { detailsChanged } from "@/lib/ingestion/pipeline";
import type { OfficialDetails } from "@/lib/sources/types";

const base: OfficialDetails = {
  source: "eu-funding-tenders", retrieved_at: "2026-10-15T10:00:00Z",
  budget: { total_eur: 40_000_000, by_year: { "2026": 40_000_000 }, expected_grants: null, min_grant_eur: null, max_grant_eur: null },
  action_type: "CEF Infrastructure Projects", submission: "single-stage", call: { identifier: "CEF-DIG-2026", title: "Cables" },
  scope_excerpt: { text: "Scope.", lang: "en", truncated: false },
  conditions: [{ heading: "Eligible countries", text: "described in section 6" }],
  documents: [{ label: "call document", url: "https://ec.europa.eu/x.pdf" }],
};

describe("change detection in official details (core capability 3)", () => {
  it("reports nothing the first time details arrive, or when only timestamps/text excerpts change", () => {
    expect(detailsChanged(null, base)).toEqual([]);
    expect(detailsChanged(base, { ...base, retrieved_at: "2026-10-16T10:00:00Z", scope_excerpt: { text: "Reworded.", lang: "en", truncated: false } })).toEqual([]);
  });

  it("reports which material fields changed", () => {
    const more = { ...base, budget: { ...base.budget!, total_eur: 45_000_000, by_year: { "2026": 45_000_000 } } };
    expect(detailsChanged(base, more)).toEqual(["budget"]);
    expect(detailsChanged(base, { ...base, conditions: [{ heading: "Eligible countries", text: "described in section 7" }], submission: "two-stage" })).toEqual(["conditions", "submission"]);
    expect(detailsChanged(base, { ...base, documents: [...base.documents!, { label: "corrigendum", url: "https://ec.europa.eu/c.pdf" }] })).toEqual(["documents"]);
  });
});
