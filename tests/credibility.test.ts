/**
 * Sprint 17 Oct 2026, Priority 0 — credibility in the interface:
 * «what we don't know» is derived only from recorded facts; retrieval dates are never presented as human checks;
 * the homepage «checked» selection only ever contains hand-checked records.
 */
import { describe, expect, it } from "vitest";
import { unknownsOf, type UnknownInput } from "@/lib/site/unknowns";
import { SITE } from "@/lib/site/copy";

const base: UnknownInput = {
  record: { display: "open", freshness: "current" }, hasConflict: false, completeness: "complete", deadlineKind: "official",
  hasDeadline: true, amountState: "known", applicant: "individuals", documentsApproved: true,
};

describe("what we don't know yet", () => {
  it("a fully recorded, fresh listing has no open questions", () => {
    expect(unknownsOf(base)).toEqual([]);
  });
  it("each missing fact produces exactly its own line", () => {
    expect(unknownsOf({ ...base, record: { display: "recheck", freshness: "recheck" } })).toEqual(["recheck"]);
    expect(unknownsOf({ ...base, hasConflict: true })).toEqual(["conflict"]);
    expect(unknownsOf({ ...base, completeness: "partial" })).toEqual(["requirementsIncomplete"]);
    expect(unknownsOf({ ...base, deadlineKind: "official", hasDeadline: false })).toEqual(["deadlineUnknown"]);
    expect(unknownsOf({ ...base, deadlineKind: "unknown", hasDeadline: false })).toEqual(["deadlineUnknown"]);
    expect(unknownsOf({ ...base, amountState: "unknown" })).toEqual(["amountUnknown"]);
    expect(unknownsOf({ ...base, applicant: "unknown" })).toEqual(["applicantUnknown"]);
    expect(unknownsOf({ ...base, documentsApproved: false })).toEqual(["documentsUnreviewed"]);
  });
  it("rolling deadlines and tax regimes without an amount are not «unknown»", () => {
    expect(unknownsOf({ ...base, deadlineKind: "rolling", hasDeadline: false, amountState: "not_applicable" })).toEqual([]);
  });
  it("a passed deadline is not hidden: an unverified record still says it needs re-check", () => {
    expect(unknownsOf({ ...base, record: { display: "deadline_passed", freshness: "unverified" } })).toContain("recheck");
  });
  it("every line has Greek and English text", () => {
    for (const k of ["recheck", "conflict", "requirementsIncomplete", "deadlineUnknown", "amountUnknown", "applicantUnknown", "documentsUnreviewed"] as const) {
      expect(SITE.el.detail.unknown[k]).toBeTruthy();
      expect(SITE.en.detail.unknown[k]).toBeTruthy();
    }
  });
});

describe("provenance wording", () => {
  it("checked and retrieved are different words in both languages", () => {
    expect(SITE.el.card.checked).not.toBe(SITE.el.card.retrieved);
    expect(SITE.en.card.retrieved).toMatch(/Retrieved/);
    expect(SITE.el.card.syntheticDate).toMatch(/δεν ελέγχθηκε/);
  });
  it("no copy claims that every fact comes from an official source", () => {
    const all = JSON.stringify(SITE);
    expect(all).not.toMatch(/Κάθε στοιχείο προέρχεται/);
    expect(all).not.toMatch(/Each fact comes from/);
    expect(all).not.toMatch(/Μόνο επίσημες πηγές|Official sources only/);
  });
});
