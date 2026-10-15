import { describe, expect, it } from "vitest";
import { excerpt, extractDetails, htmlToLines, parseBudget, parseConditions } from "@/lib/sources/adapters/eu-ft-details";
import { mapResult } from "@/lib/sources/adapters/eu-funding-tenders";
import { verifiedFor, displayTitle } from "@/lib/site/verified";
import { MANUAL_RECORDS } from "@/lib/site/taxonomy";

const HOSTS = ["ec.europa.eu", "api.tech.ec.europa.eu"];

// Shapes copied from the live probe of 15 Oct 2026 (scripts/eu-ft-details-probe.ts), shortened.
const BUDGET_CEF = JSON.stringify({ budgetYearsColumns: ["2026"], budgetTopicActionMap: { "115101": [{ action: "CEF-DIG-2026-CABLE-REPAIR-CAPACITIES-WORKS - CEF-INFRA CEF Infrastructure Projects", expectedGrants: 0, minContribution: 0, maxContribution: 0, budgetYearMap: { "2026": "40000000" }, deadlineModel: "single-stage", deadlineDates: ["2026-11-25"] }] } });
const CONDITIONS_CREA = `<div class="eui-u-mt-l>"><h4>Conditions</h4><div><h4>1. Admissibility conditions: Proposal page limit and layout</h4><div class="eui-u-mt-s"><p>described in the <u><a href="https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/crea/wp-call/2027/call-fiche_crea-media-2027-devvgim_en.pdf" rel="noopener noreferrer" target="_blank">call document</a></u>.</p></div></div><div><h4>2. Eligible countries</h4><div class="eui-u-mt-s"><p>described in the call document &amp; annex</p></div></div><div><h4>3. Other</h4><p>see <a href="https://evil.example/x.pdf">this</a></p></div></div>`;

describe("EU portal official details (display only)", () => {
  it("reads the topic budget; zero grant sizes mean 'not published', not €0", () => {
    const b = parseBudget(BUDGET_CEF, "CEF-DIG-2026-CABLE-REPAIR-CAPACITIES-WORKS");
    expect(b).toEqual({ total_eur: 40_000_000, by_year: { "2026": 40_000_000 }, expected_grants: null, min_grant_eur: null, max_grant_eur: null });
  });

  it("only counts the actions of this topic when a call-level map lists several topics", () => {
    const shared = JSON.stringify({ budgetTopicActionMap: { "1": [
      { action: "X-01 - RIA", budgetYearMap: { "2027": "10000000" }, expectedGrants: 2, minContribution: 4000000, maxContribution: 5000000 },
      { action: "X-02 - IA", budgetYearMap: { "2027": "30000000" }, expectedGrants: 3, minContribution: 0, maxContribution: 0 },
    ] } });
    expect(parseBudget(shared, "X-01")).toEqual({ total_eur: 10_000_000, by_year: { "2027": 10_000_000 }, expected_grants: 2, min_grant_eur: 4_000_000, max_grant_eur: 5_000_000 });
    expect(parseBudget(shared, "X-03")).toBeNull(); // not this topic's, and not split by guesswork
    expect(parseBudget("not json", "X-01")).toBeNull();
  });

  it("turns condition HTML into headings + text, and keeps only official https document links", () => {
    const c = parseConditions(CONDITIONS_CREA, HOSTS);
    expect(c.conditions!.map((x) => x.heading)).toEqual(["Admissibility conditions", "Eligible countries", "Other"]);
    expect(c.conditions![1]!.text).toBe("described in the call document & annex");
    expect(c.documents).toEqual([{ label: "call document", url: "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/crea/wp-call/2027/call-fiche_crea-media-2027-devvgim_en.pdf" }]);
  });

  it("plain text only, shortened at a sentence", () => {
    expect(htmlToLines("<p>A &amp; B</p><ul><li>one</li></ul><script>x()</script>")).toEqual(["A & B", "• one"]);
    const e = excerpt("First sentence here. Second sentence is longer and goes on. Third.", 45);
    expect(e).toEqual({ text: "First sentence here.", truncated: true });
  });

  it("is attached by the connector without changing the fingerprinted facts", () => {
    const raw = { metadata: { identifier: ["CEF-DIG-2026-CABLE-REPAIR-CAPACITIES-WORKS"], title: ["Works"], url: ["https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/x"], status: ["31094502"], deadlineDate: ["2026-11-25T00:00:00.000+0000"], budgetOverview: [BUDGET_CEF], typesOfAction: ["CEF Infrastructure Projects"], deadlineModel: ["single-stage"], callIdentifier: ["CEF-DIG-2026-CABLE-REPAIR-CAPACITIES"], callTitle: ["Submarine Cable Repair Capacities"] } };
    const without = { metadata: { ...raw.metadata, budgetOverview: undefined, typesOfAction: undefined, deadlineModel: undefined, callIdentifier: undefined, callTitle: undefined } };
    const a = mapResult(raw, HOSTS);
    const b = mapResult(without, HOSTS);
    if ("skip" in a || "skip" in b) throw new Error("unexpected skip");
    expect(a.details).toMatchObject({ action_type: "CEF Infrastructure Projects", submission: "single-stage", call: { identifier: "CEF-DIG-2026-CABLE-REPAIR-CAPACITIES" }, budget: { total_eur: 40_000_000 } });
    expect(a.text).toBe(b.text);                       // details never change the fingerprint
    expect(b.details).toEqual({ source: "eu-funding-tenders" }); // nothing published → nothing shown
    expect(extractDetails({}, "X", HOSTS)).toBeUndefined();
  });
});

describe("verified facts of the hand-checked records", () => {
  it("every hand-checked record has bilingual benefit, conditions, steps and https sources", () => {
    for (const id of Object.keys(MANUAL_RECORDS)) {
      const v = verifiedFor(`manual:${id}`);
      expect(v, id).not.toBeNull();
      expect(v!.title.el && v!.title.en).toBeTruthy();
      expect(v!.steps.el.length).toBe(v!.steps.en.length);
      expect(v!.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
      for (const r of v!.rules) expect(r.label.el && r.label.en).toBeTruthy();
    }
    expect(verifiedFor("manual:a21")!.benefit!.en).toContain("€70");
    expect(verifiedFor("eu-topic:X")).toBeNull();
  });

  it("shows the verified English title to English visitors, the official title otherwise", () => {
    expect(displayTitle({ external_key: "manual:a21", official_title: "Α21", title_lang: "el" }, "en")).toEqual({ text: "A21 — Child benefit", lang: "en" });
    expect(displayTitle({ external_key: "eu-topic:X", official_title: "Topic X", title_lang: "en" }, "el")).toEqual({ text: "Topic X", lang: "en" });
  });
});
