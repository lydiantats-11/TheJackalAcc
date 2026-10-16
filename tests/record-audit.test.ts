/** Workstream B: the record audit and proposed revisions follow the evidence rules. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APPROVED_RECORDS } from "@/lib/site/guide-catalog";

const audit = JSON.parse(readFileSync("data/record-audit-2026-10-16.json", "utf8"));
const rev = JSON.parse(readFileSync("data/proposed-revisions-2026-10-16.json", "utf8"));
/** Official Greek and EU domains (ΑΑΔΕ publishes on aade.gr, not gov.gr). */
const OFFICIAL_HOSTS = /(^|\.)(gov\.gr|europa\.eu|aade\.gr)$/;
const original = readFileSync("data/official-records-2026-10-14.v2.json", "utf8");

describe("record quality audit", () => {
  it("covers exactly the eight approved records and every field", () => {
    expect(audit.records.map((r: { id: string }) => r.id).sort()).toEqual([...APPROVED_RECORDS].sort());
    for (const r of audit.records) {
      expect(Object.keys(r.fields).sort()).toEqual([...audit.fields].sort());
      for (const f of Object.values(r.fields) as Array<{ status: string }>) expect(audit.statuses).toContain(f.status);
    }
  });
});

describe("proposed revisions", () => {
  it("every change cites official evidence with a quote and stays pending approval", () => {
    expect(rev.revisions.length).toBeGreaterThan(0);
    for (const r of rev.revisions) {
      expect(r.status, r.id).toBe("pending_approval");
      expect(APPROVED_RECORDS.has(r.record), r.id).toBe(true);
      expect(r.evidence.length, r.id).toBeGreaterThan(0);
      for (const e of r.evidence) {
        expect(new URL(e.url).hostname, r.id).toMatch(OFFICIAL_HOSTS);
        expect(e.quote.length, r.id).toBeGreaterThan(5);
        expect(e.read_on, r.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
  it("the approved dataset was not edited (proposals live in a separate file)", () => {
    expect(original).toContain("amount: not stated on the page");
    expect(original).not.toContain("565");
  });
});
