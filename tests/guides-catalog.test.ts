/** Guides Phase 2: approved categories, one article model, verification states, search and drafts. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  APPROVED_RECORDS, ARTICLES, GUIDE_CATEGORIES, articleBySlug, countByCategory, fold, reviewDue, searchGuides, verificationOf,
} from "@/lib/site/guide-catalog";
import { programmeStatus } from "@/lib/site/guide-status";
import { SITE } from "@/lib/site/copy";

const NOW = new Date("2026-10-16T12:00:00Z");
const GREEK = /[Ͱ-Ͽἀ-῿]/;

describe("guide categories", () => {
  it("are exactly the eight approved categories, in the approved order and wording", () => {
    expect(GUIDE_CATEGORIES.map((c) => `${c.name.el} / ${c.name.en}`)).toEqual([
      "Οδηγοί Βήμα-Βήμα / Step-by-Step Guides",
      "Επιδόματα & Παροχές / Benefits & Allowances",
      "Επιχειρηματικότητα & Επιδοτήσεις / Business & Grants",
      "Εργασία & Εκπαίδευση / Employment & Education",
      "Στέγαση & Ενέργεια / Housing & Energy",
      "Ευρωπαϊκά Προγράμματα / European Programmes",
      "Συχνές Ερωτήσεις & Όροι / FAQs & Glossary",
      "Νέα & Αλλαγές / News & Updates",
    ]);
  });
  it("have Greek and English descriptions, with no Greek in the English text", () => {
    for (const c of GUIDE_CATEGORIES) {
      expect(c.desc.el.length).toBeGreaterThan(10);
      expect(GREEK.test(c.desc.en.replace(/ESPA/g, ""))).toBe(false);
    }
  });
});

describe("articles", () => {
  it("have unique slugs, known categories and https sources", () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const known = new Set(GUIDE_CATEGORIES.map((c) => c.slug));
    for (const a of ARTICLES) {
      expect(a.categories.length, a.slug).toBeGreaterThan(0);
      for (const c of a.categories) expect(known.has(c), `${a.slug}: ${c}`).toBe(true);
      for (const s of a.sources) expect(s.url.startsWith("https://"), s.url).toBe(true);
      expect(a.title.el && a.title.en && a.intro.el && a.intro.en, a.slug).toBeTruthy();
    }
  });

  it("approved records match the owner's approval file", () => {
    const sql = readFileSync("db/seed/approvals-2026-10-15.sql", "utf8");
    const approved = new Set([...sql.matchAll(/manual:([a-z0-9-]+)/g)].map((m) => m[1]));
    expect([...APPROVED_RECORDS].sort()).toEqual([...approved].sort());
  });

  it("a guide for an unapproved record is a draft, hidden from the list but reachable for review", () => {
    const eic = articleBySlug("eic")!;
    expect(verificationOf(eic, NOW)).toBe("draft");
    expect(searchGuides({}).some((a) => a.slug === "eic")).toBe(false);
    expect(searchGuides({ q: "EIC" })).toEqual([]);
  });
});

describe("verification state (about the content, never the application status)", () => {
  const state = (slug: string, now = NOW) => verificationOf(articleBySlug(slug)!, now);

  it("reflects what the checked records say", () => {
    expect(state("discovereu")).toBe("conflicting");
    expect(state("spiti2")).toBe("conflicting");
    expect(state("unemployment")).toBe("conflicting");
    expect(state("art5c")).toBe("incomplete");
    expect(state("a21")).toBe("incomplete");
    expect(state("studenthousing")).toBe("incomplete");
    expect(state("art5b")).toBe("needs_reverification"); // guide PDF dated 2023, later amendments not checked
    expect(state("eligibility-labels")).toBe("educational");
  });

  it("asks for a new check after the review interval (a trigger, not a verdict)", () => {
    const a21 = articleBySlug("a21")!;
    expect(reviewDue(a21, new Date("2026-11-13T00:00:00Z"))).toBe(false);
    expect(reviewDue(a21, new Date("2026-11-14T12:00:00Z"))).toBe(true);
    expect(state("a21", new Date("2026-11-14T12:00:00Z"))).toBe("needs_reverification");
  });

  it("stays independent of the programme's application status", () => {
    const d = articleBySlug("discovereu")!;
    expect(programmeStatus(d.recordKey!, NOW)).toBe("deadline_passed");
    expect(verificationOf(d, NOW)).toBe("conflicting");
  });

  it("every state has a Greek and English label and explanation", () => {
    for (const k of ["verified", "needs_reverification", "incomplete", "conflicting", "draft", "educational"] as const) {
      for (const l of ["el", "en"] as const) {
        expect(SITE[l].guides.states[k]).toBeTruthy();
        expect(SITE[l].guides.stateHelp[k].length).toBeGreaterThan(20);
      }
    }
  });
});

describe("search and filtering", () => {
  it("folds accents, case and final sigma", () => {
    expect(fold("Επίδομα ΑΝΕΡΓΊΑΣ")).toBe("επιδομα ανεργιασ");
  });
  it("finds guides in Greek without accents and in English", () => {
    expect(searchGuides({ q: "επιδομα ανεργιας" }).map((a) => a.slug)).toContain("unemployment");
    expect(searchGuides({ q: "Unemployment" }).map((a) => a.slug)).toContain("unemployment");
    expect(searchGuides({ q: "φοιτητικό" }).map((a) => a.slug)).toContain("studenthousing");
  });
  it("requires every word to match", () => {
    expect(searchGuides({ q: "ανεργίας στέγαση" })).toEqual([]);
    expect(searchGuides({ q: "zzzz-not-a-guide" })).toEqual([]);
  });
  it("filters by category, and combines category with words", () => {
    const housing = searchGuides({ cat: "housing-energy" }).map((a) => a.slug).sort();
    expect(housing).toEqual(["spiti2", "studenthousing"]);
    expect(searchGuides({ cat: "housing-energy", q: "φοιτητ" }).map((a) => a.slug)).toEqual(["studenthousing"]);
    expect(searchGuides({ cat: "news-updates" })).toEqual([]); // no invented news
  });
  it("counts only public guides per category", () => {
    const n = countByCategory();
    expect(n["news-updates"]).toBe(0);
    expect(n["eu-programmes"]).toBe(1); // DiscoverEU; EIC is a draft
  });
});

describe("unemployment benefit application guide (draft)", () => {
  const a = articleBySlug("unemployment-benefit-application")!;
  it("is a draft until the owner approves it, so it is not listed", () => {
    expect(a).toBeTruthy();
    expect(verificationOf(a, NOW)).toBe("draft");
    expect(searchGuides({ q: "ανεργίας" }).some((x) => x.slug === a.slug)).toBe(false);
  });
  it("cites only official sources", () => {
    for (const s of a.sources) expect(new URL(s.url).hostname, s.url).toMatch(/(^|\.)(gov\.gr)$/);
  });
  it("marks the screens it has not seen and never asks for credentials", () => {
    expect(a.steps.filter((s) => !s.confirmed).length).toBeGreaterThan(0);
    expect(a.steps.filter((s) => s.confirmed).length).toBeGreaterThan(0);
    const text = JSON.stringify(a);
    expect(text).not.toMatch(/εγγυ[άα]ται|θα εγκριθ|guaranteed|will be approved/i);
  });
  it("English text has Greek only inside «» official names or known acronyms", () => {
    const en = JSON.stringify([a.title.en, a.intro.en, a.provides?.en, a.timing?.en, ...a.audience, ...a.eligibility, ...(a.documents ?? []),
      ...a.steps.flatMap((s) => [s.text, ...(s.details ?? [])]), ...a.afterSubmission, ...a.mistakes, ...a.faq.flatMap((f) => [f.q, f.a]), ...a.limitations]
      .map((x) => (x && typeof x === "object" ? (x as { en: string }).en : x)));
    const stripped = en.replace(/«[^»]*»/g, "").replace(/ΔΥΠΑ|ΚΠΑ2|Ε6|Ε7|ΑΑΔΕ/g, "");
    expect(GREEK.test(stripped)).toBe(false);
  });
  it("Greek text addresses the reader formally", () => {
    const el = JSON.stringify(a).match(/"el":"[^"]*"/g)!.join(" ");
    expect(el).not.toMatch(/(?<!\p{L})(σου|είσαι|έχεις|μπορείς|κάνε|Κάνε|Συνδέσου|Επίλεξε)(?!\p{L})/u);
  });
});
