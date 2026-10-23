/**
 * Γνώση — Phase K (owner, 23 Oct 2026): universal page, four sections over one content system, eight topics, and a
 * publication gate that keeps every unverified entry off the public page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GREEK_LETTERS, SECTIONS, TOPICS, indexLetter, linkParts, matches, publicationGate, type Entry } from "@/lib/knowledge/schema";
import { FIXTURES_FOR_TESTS, REGISTER_FOR_TESTS, entryById, fixturesEnabled, publishedEntries, registerCounts, visibleEntries } from "@/lib/knowledge/store";
import { KNOWLEDGE_PATH } from "@/lib/site/audience";
import { SITE } from "@/lib/site/copy";
import { browserLabels } from "@/components/knowledge";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const filesUnder = (d: string): string[] => readdirSync(join(root, d)).flatMap((f) => {
  const p = join(d, f);
  return statSync(join(root, p)).isDirectory() ? filesUnder(p) : [p];
});

const complete: Entry = {
  id: "LEX-9999", kind: "term", topic: "forologia",
  title: { el: "Όρος", en: "Term" }, body: { el: "Κείμενο.", en: "Text." },
  sources: [{ label: "Επίσημη πηγή", url: "https://example.gov/doc", locator: "άρθρο 1 παρ. 2", checked_on: "2026-10-23" }],
  verification: { status: "verified", checked_on: "2026-10-23" },
  editorial_review: { by: "editor", on: "2026-10-23" },
  publication: { approved: true, approved_by: "owner", approved_on: "2026-10-23" },
  related: [],
};

describe("the content register (owner's workbook, 23 Oct 2026)", () => {
  it("holds the 221 planned entries once each: 166 dictionary terms, 28 basics, 27 FAQ; one primary topic each", () => {
    expect(REGISTER_FOR_TESTS).toHaveLength(221);
    expect(new Set(REGISTER_FOR_TESTS.map((e) => e.id)).size).toBe(221);
    expect(registerCounts().kinds).toEqual({ term: 166, article: 28, faq: 27 });
    for (const e of REGISTER_FOR_TESTS) expect(TOPICS.map((t) => t.id)).toContain(e.topic);
    expect(Object.values(registerCounts().topics).reduce((a, b) => a + b, 0)).toBe(221);
  });
  it("nothing in it is approved or passes the gate; nothing of it is visible", () => {
    for (const e of REGISTER_FOR_TESTS) {
      expect(e.publication.approved).toBe(false);
      expect(publicationGate(e).ok).toBe(false);
    }
    expect(publishedEntries()).toEqual([]);
    expect(visibleEntries(false)).toEqual([]);
    expect(visibleEntries(true).every((e) => e.synthetic)).toBe(true);
    expect(entryById("LEX-0001", true)).toBeNull();
    expect(registerCounts().published).toBe(0);
  });
  it("where the workbook's sheets disagree the stricter state is kept, and the disagreements are listed", () => {
    const reg = JSON.parse(read("data/knowledge/register.json"));
    expect(reg.sheet_disagreements.length).toBeGreaterThan(0);
    const kad = REGISTER_FOR_TESTS.find((e) => e.id === "LEX-0041")!;
    expect(kad.verification.status).toBe("draft"); // register says draft, evidence gate says checked → draft
    for (const e of REGISTER_FOR_TESTS) expect(["unverified", "draft", "source_located"]).toContain(e.verification.status);
  });
  it("the importer refuses a row marked approved without review", () => {
    expect(read("scripts/import_knowledge_register.py")).toContain("refusing to import an approval without review");
  });
});

describe("the publication gate", () => {
  it("passes only with verified source + exact locator + EL and EN title and text + editorial review + approval", () => {
    expect(publicationGate(complete)).toEqual({ ok: true, missing: [] });
    const cases: Array<[Partial<Entry>, string]> = [
      [{ verification: { status: "source_located" } }, "verified_source"],
      [{ sources: [] }, "exact_source"],
      [{ sources: [{ ...complete.sources[0]!, locator: "" }] }, "exact_source"],
      [{ sources: [{ ...complete.sources[0]!, url: "http://example.gov" }] }, "exact_source"],
      [{ title: { el: "Όρος", en: null } }, "title_el_en"],
      [{ body: { el: "Κείμενο.", en: "" } }, "text_el_en"],
      [{ body: null }, "text_el_en"],
      [{ editorial_review: null }, "editorial_review"],
      [{ publication: { approved: false, approved_by: null, approved_on: null } }, "publication_approval"],
      [{ publication: { approved: true, approved_by: null, approved_on: "2026-10-23" } }, "publication_approval"],
      [{ synthetic: true }, "synthetic"],
    ];
    for (const [change, key] of cases) {
      const r = publicationGate({ ...complete, ...change } as Entry);
      expect(r.ok, key).toBe(false);
      expect(r.missing).toContain(key);
    }
  });
});

describe("synthetic development fixtures", () => {
  const before = process.env.JACKAL_KNOWLEDGE_FIXTURES;
  afterEach(() => { if (before === undefined) delete process.env.JACKAL_KNOWLEDGE_FIXTURES; else process.env.JACKAL_KNOWLEDGE_FIXTURES = before; });
  it("are flagged, carry no source and no real rule, and say so in their text", () => {
    for (const e of FIXTURES_FOR_TESTS) {
      expect(e.synthetic).toBe(true);
      expect(e.id).toMatch(/^DEV-\d{3}$/);
      expect(e.sources).toEqual([]);
      expect(`${e.title.el} ${e.body!.el}`).toMatch(/[Δδ]οκιμαστικ/);
      expect(`${e.title.en} ${e.body!.en}`).toMatch(/[Tt]est/);
      for (const r of e.related) expect(FIXTURES_FOR_TESTS.some((x) => x.id === r)).toBe(true);
    }
  });
  it("appear only when JACKAL_KNOWLEDGE_FIXTURES=1 (preview), never by default", () => {
    delete process.env.JACKAL_KNOWLEDGE_FIXTURES;
    expect(fixturesEnabled()).toBe(false);
    expect(visibleEntries()).toEqual([]);
    process.env.JACKAL_KNOWLEDGE_FIXTURES = "1";
    expect(visibleEntries().length).toBe(FIXTURES_FOR_TESTS.length);
  });
  it("only the two private preview workflows turn them on; the layout shows the test-content banner whenever one is visible", () => {
    expect(read(".github/workflows/design-preview.yml")).toContain("JACKAL_KNOWLEDGE_FIXTURES=1 PORT=3000 npm start");
    expect(read(".github/workflows/static-snapshot.yml")).toContain("JACKAL_KNOWLEDGE_FIXTURES=1 PORT=3000 npm start");
    for (const f of readdirSync(join(root, ".github/workflows")).filter((x) => !["design-preview.yml", "static-snapshot.yml"].includes(x))) {
      expect(read(`.github/workflows/${f}`), f).not.toContain("JACKAL_KNOWLEDGE_FIXTURES");
    }
    expect(read("src/app/gnosi/layout.tsx")).toContain("{anySynthetic && <FixtureBanner s={s} />}");
    expect(SITE.el.knowledge.fixtureBanner).toMatch(/^ΔΟΚΙΜΑΣΤΙΚΟ ΠΕΡΙΕΧΟΜΕΝΟ/);
  });
  it("cover every kind and every topic, so each part of the page can be checked", () => {
    expect(new Set(FIXTURES_FOR_TESTS.map((e) => e.kind))).toEqual(new Set(["term", "article", "faq"]));
    expect(new Set(FIXTURES_FOR_TESTS.map((e) => e.topic)).size).toBe(8);
  });
});

describe("structure: four sections over one content system, eight topics", () => {
  it("exactly four sections; the first three are kinds of entry, «Θέματα» is a view", () => {
    expect(SECTIONS.map((s) => s.name.el)).toEqual(["Λεξικό", "Μάθε τα βασικά", "Συχνές Ερωτήσεις", "Θέματα"]);
    expect(SECTIONS.map((s) => s.name.en)).toEqual(["Dictionary", "Learn the Basics", "FAQ", "Topics"]);
    expect(SECTIONS.map((s) => s.kind)).toEqual(["term", "article", "faq", null]);
  });
  it("the eight topics, in the owner's order", () => {
    expect(TOPICS.map((t) => t.name.el)).toEqual(["Φορολογία", "Επιχειρηματικότητα", "Οικονομικά & Χρηματοδότηση", "Εργασία & Ασφάλιση",
      "Επιδοτήσεις & Προγράμματα", "Ακίνητα & Στέγαση", "Κοινωνικές Παροχές", "Νομοθεσία & Δημόσιο"]);
  });
  it("pages read entries only through the gate (never the register file) and never touch opportunities or news", () => {
    const files = [...filesUnder("src/app/gnosi"), "src/components/knowledge.tsx", "src/components/knowledge-browser.tsx", "src/components/knowledge-tabs.tsx"];
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const f of files) {
      const t = read(f);
      expect(t, f).not.toMatch(/register\.json|REGISTER_FOR_TESTS|publishedEntries\(\)\s*\.|\.draft\b/);
      expect(t, f).not.toMatch(/@\/lib\/data\/opportunities|@\/lib\/site\/listing|@\/lib\/site\/news|audienceParam|@\/lib\/db/);
    }
  });
  it("labels passed to the client component are plain data (functions cannot cross to the client)", () => {
    for (const l of ["el", "en"] as const) {
      const lab = browserLabels(SITE[l], l);
      expect(JSON.parse(JSON.stringify(lab))).toEqual(lab);
    }
    expect(browserLabels(SITE.el, "el").results).toEqual({ one: "αποτέλεσμα", many: "αποτελέσματα" });
  });
  it("the client component receives display fields only", () => {
    expect(read("src/components/knowledge-browser.tsx")).not.toMatch(/@\/lib\/knowledge\/store/);
  });
});

describe("navigation: five tabs, Γνώση replaces Οδηγοί and is universal", () => {
  it("order Ευκαιρίες · Νέα · Γνώση · Τι είναι το Jackal · Ο λογαριασμός μου; Γνώση at /gnosi", () => {
    expect(read("src/components/site-nav.tsx")).toContain('const ITEMS: NavItem[] = ["opportunities", "news", "knowledge", "about", "account"];');
    expect(KNOWLEDGE_PATH).toBe("/gnosi");
    expect(SITE.el.knowledge.nav).toBe("Γνώση");
    expect(SITE.en.knowledge.nav).toBe("Knowledge");
    expect(read("src/app/layout.tsx")).toContain("nav: { ...p.nav, knowledge: s.knowledge.nav }");
  });
  it("Γνώση is reachable before choosing a path, and from either path", () => {
    const nav = read("src/components/site-nav.tsx");
    expect(nav).toContain("<Link href={KNOWLEDGE_PATH} aria-current={current(KNOWLEDGE_PATH)}>{labels.nav.knowledge}</Link>");
    expect(nav).toContain('s === "knowledge" ? KNOWLEDGE_PATH');
  });
});

describe("private preview copy (static snapshot)", () => {
  it("captures the Γνώση pages and filters them without the app's scripts, with the same accent folding", () => {
    const crawl = read("scripts/static-snapshot.mjs");
    for (const p of ['"/gnosi"', '"/gnosi/lexiko"', '"/gnosi/vasika"', '"/gnosi/syxnes-erotiseis"', '"/gnosi/themata"']) expect(crawl).toContain(p);
    const snap = read("scripts/snapshot-assets/snap.js");
    expect(snap).toContain('s.normalize("NFD").replace(/\\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ")');
    expect(read("src/lib/text/search.ts")).toContain('s.normalize("NFD").replace(/\\p{M}/gu, "").toLowerCase().replace(/ς/g, "σ")');
    const browser = read("src/components/knowledge-browser.tsx");
    for (const a of ["data-topic={i.topic}", "data-letter={i.letter}", "data-hay={i.hay}", "data-letter={l}", "data-topic={t.id}"]) expect(browser).toContain(a);
  });
});

describe("search, index and links", () => {
  const e = (title: string, body = ""): Entry => ({ ...complete, title: { el: title, en: null }, body: { el: body, en: "" } });
  it("A–Ω index: accents ignored, Latin titles in the Latin index", () => {
    expect(indexLetter("ΑΦΜ")).toBe("Α");
    expect(indexLetter("ήτα")).toBe("Η");
    expect(indexLetter("Ώρα")).toBe("Ω");
    expect(indexLetter("de minimis")).toBe("D");
    expect(indexLetter("«Σπίτι»")).toBe("#");
    expect(GREEK_LETTERS).toHaveLength(24);
  });
  it("search matches every word, ignoring accents and case, in either language", () => {
    expect(matches(e("Φορολογική κατοικία", "Κριτήρια"), "φορολογικη")).toBe(true);
    expect(matches(e("Φορολογική κατοικία"), "κατοικια φορολογικη")).toBe(true);
    expect(matches(e("Φορολογική κατοικία"), "ΦΠΑ")).toBe(false);
    expect(matches({ ...complete, title: { el: "Όρος", en: "Tax residence" } }, "residence")).toBe(true);
  });
  it("[[ID]] and [[ID|label]] become links to other entries", () => {
    expect(linkParts("Δείτε [[LEX-0001]] και [[DEV-002|αυτό]].")).toEqual([
      { text: "Δείτε " }, { id: "LEX-0001", label: null }, { text: " και " }, { id: "DEV-002", label: "αυτό" }, { text: "." },
    ]);
  });
});
