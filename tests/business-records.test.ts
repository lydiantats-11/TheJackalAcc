/**
 * The reviewed business batch of 20 Oct 2026 (owner approval: development database / preview only).
 * Guards the evidence the owner asked to keep: official identifiers, governing amendment, deadlines in Athens time,
 * registered sources, and no test records in user-facing results.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCE_SEEDS } from "../db/seed/sources";
import { APPLICANT_TYPES } from "@/lib/domain/requirements";
import { isHandChecked } from "@/lib/site/provenance";
import { applicantAudienceOf } from "@/lib/site/applicants";

const root = join(__dirname, "..");
const data = JSON.parse(readFileSync(join(root, "data/business-records-2026-10-20.json"), "utf8"));
const recs: Array<Record<string, any>> = data.records;
const seedSql = readFileSync(join(root, "db/seed/business-records-2026-10-20.sql"), "utf8");
const approvalsSql = readFileSync(join(root, "db/seed/approvals-2026-10-20.sql"), "utf8");

const athens = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Athens", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(iso));

describe("business batch of 20 Oct 2026", () => {
  it("has the 11 approved records, each once", () => {
    expect(recs).toHaveLength(11);
    expect(new Set(recs.map((r) => r.external_key)).size).toBe(11);
    expect(new Set(recs.map((r) => r.canonical_url)).size).toBe(11);
    expect(new Set(recs.map((r) => r.official_identifier)).size).toBe(11);
  });

  it("the four ΔΑΜ calls carry distinct official codes and ΟΠΣ numbers", () => {
    const dam = recs.filter((r) => /\(ΔΑΜ2[1-4]\)/.test(r.title));
    expect(dam.map((r) => r.official_identifier).sort()).toEqual(["1.2.5.2", "1.2.6.2", "1.4.1.2", "1.4.2.2"]);
    expect(dam.map((r) => r.external_key).sort()).toEqual(["opske:23466", "opske:23467", "opske:23486", "opske:23487"]);
  });

  it("every deadline matches the official wording in Athens time and comes after the opening", () => {
    for (const r of recs) {
      expect(new Date(r.closes_at).getTime()).toBeGreaterThan(new Date(r.opens_at).getTime());
      const local = athens(r.closes_at); // "dd/mm/yyyy, HH:MM"
      const [date, time] = local.split(", ");
      const [d, m, y] = date!.split("/");
      expect(r.deadline_text.replace(/-/g, "/")).toContain(`${d}/${m}/${y}`);
      expect(r.deadline_verbatim.replace(/-/g, "/")).toContain(`${d}/${m}/${y}`);
      expect(time).toBe(r.id.startsWith("dam") ? "14:00" : "15:00");
    }
    const nea = recs.find((r) => r.id === "epiro-nea-eykairia")!;
    expect(athens(nea.closes_at)).toBe("21/10/2026, 15:00");
  });

  it("keeps the governing amendment, official documents and reviewer notes", () => {
    for (const r of recs) {
      expect(r.governing_document.length).toBeGreaterThan(10);
      expect(r.documents.length).toBeGreaterThan(0);
      for (const [label, url] of r.documents) { expect(label).toBeTruthy(); expect(url).toMatch(/^https:\/\/(opske\.gr|efepae\.gr)\//); }
      expect(Array.isArray(r.uncertainties)).toBe(true);
    }
    const dam22 = recs.find((r) => r.id === "dam22")!;
    expect(dam22.uncertainties.join(" ")).toContain("30/09/2026");
    const crete = recs.find((r) => r.id === "crete-kainotomo")!;
    expect(crete.funding.rate).toEqual({ min: 75, max: 75 });
    expect(crete.funding.grant).toBeNull();
  });

  it("every record points to a registered official source; the four new sources stay manual and unscheduled", () => {
    const slugs = new Set(SOURCE_SEEDS.map((s) => s.slug));
    for (const slug of ["opske", "efepae", "minfin", "aade"]) {
      expect(slugs.has(slug)).toBe(true);
      expect(SOURCE_SEEDS.find((s) => s.slug === slug)!.adapter).toBe("manual");
    }
    for (const r of recs) {
      const host = new URL(r.canonical_url).hostname;
      expect(SOURCE_SEEDS.some((s) => s.allowed_hosts.includes(host))).toBe(true);
    }
  });

  it("applicant types use the engine vocabulary and give the expected audience", () => {
    for (const r of recs) for (const t of r.applicants) expect(APPLICANT_TYPES).toContain(t);
    const aud = (id: string) => applicantAudienceOf({ external_key: "x" }, [{ category: "applicant_type", value: { types: recs.find((r) => r.id === id)!.applicants } }]);
    expect(aud("epiro-nea-eykairia")).toBe("individuals");
    expect(aud("dam22")).toBe("organisations");
    expect(aud("dam21")).toBe("both");
  });

  it("the generated SQL imports all 11 as manual review, pending, and the approval covers exactly those keys", () => {
    for (const r of recs) {
      expect(seedSql).toContain(`'${r.external_key}'`);
      expect(approvalsSql).toContain(`'${r.external_key}'`);
    }
    expect((seedSql.match(/INSERT INTO opportunities/g) ?? []).length).toBe(11);
    expect(seedSql).toContain("'manual_review'");
    expect(seedSql).not.toMatch(/'approved'/);
    expect(approvalsSql).toContain("preview_only");
  });
});

describe("credibility and test records", () => {
  it("records from a manual review count as checked; portal imports do not", () => {
    expect(isHandChecked({ external_key: "opske:23487", publication_basis: "manual_review" })).toBe(true);
    expect(isHandChecked({ external_key: "manual:a21", publication_basis: "manual_review" })).toBe(true);
    expect(isHandChecked({ external_key: "eu-topic:HORIZON-X", publication_basis: "official_structured" })).toBe(false);
  });

  it("test records are not seeded unless asked and never reach public queries by default", () => {
    const seed = readFileSync(join(root, "scripts/seed.ts"), "utf8");
    expect(seed).toContain('process.env.SEED_SYNTHETIC === "true"');
    const q = readFileSync(join(root, "src/lib/data/opportunities.ts"), "utf8");
    expect((q.match(/AND NOT o\.is_synthetic/g) ?? []).length).toBe(2);
  });

});
