/**
 * Document lists prepared for approval (17 Oct 2026): every item has an official source, a location and a class
 * (mandatory / conditional / on_request). Nothing here is shown on the site until approved.
 */
import { describe, expect, it } from "vitest";
import lists from "../data/document-lists-2026-10-17.json";
import proposals from "../data/proposed-revisions-2026-10-17.json";

const OFFICIAL = /^https:\/\/([a-z0-9-]+\.)*(gov\.gr|europa\.eu|aade\.gr)\//;
type Item = { el: string; en: string; class: string; evidence: { url: string; location: string; read_on: string } };

describe("document lists for approval", () => {
  for (const key of ["a21", "art5c"] as const) {
    const rec = (lists.records as Record<string, { status: string; items?: Item[] }>)[key]!;
    it(`${key}: every item is classed and evidenced by an official source`, () => {
      expect(rec.items!.length).toBeGreaterThan(0);
      for (const i of rec.items!) {
        expect(["mandatory", "conditional", "on_request"]).toContain(i.class);
        expect(i.evidence.url).toMatch(OFFICIAL);
        expect(i.evidence.location.length).toBeGreaterThan(3);
        expect(i.el && i.en).toBeTruthy();
      }
    });
  }
  it("the lists are not marked approved", () => {
    expect(lists.status).toMatch(/prepared_for_approval/);
  });
});

describe("17 Oct proposals", () => {
  it("are all pending approval", () => {
    for (const r of proposals.revisions) expect(r.status).toBe("pending_approval");
  });
  it("A21 verification is recorded per field, with unchecked fields listed", () => {
    const v = proposals.revisions.find((r) => r.id === "a21-field-verification-17oct") as unknown as { fields: Array<{ verified_on: string }>; not_rechecked: string[] };
    expect(v.fields.every((f) => f.verified_on === "2026-10-17")).toBe(true);
    expect(v.not_rechecked.length).toBeGreaterThan(0);
  });
});
