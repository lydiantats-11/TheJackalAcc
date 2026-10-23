/**
 * Γνώση — Phase K (owner, 23 Oct 2026): universal page, four sections over one content system, eight topics, and a
 * publication gate that keeps every unverified entry off the public page.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GREEK_LETTERS, SECTIONS, TOPICS, indexLetter, linkParts, matches, publicationGate, type Entry } from "@/lib/knowledge/schema";
import { COMPARISONS_FOR_TESTS, visibleComparisons, DRAFTS_FOR_TESTS, FIXTURES_FOR_TESTS, REGISTER_FOR_TESTS, draftsEnabled, entryById, fixturesEnabled, publishedEntries, registerCounts, visibleEntries } from "@/lib/knowledge/store";
import { KNOWLEDGE_PATH } from "@/lib/site/audience";
import { SITE } from "@/lib/site/copy";
import { browserLabels, toItems } from "@/components/knowledge";
import { filterAndRank } from "@/lib/knowledge/search";

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
    expect(visibleEntries(false, false)).toEqual([]);
    expect(visibleEntries(true, false).every((e) => e.synthetic)).toBe(true);
    expect(entryById("LEX-0001", true, false)).toBeNull();
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
  it("no workflow turns them on (development only); the layout shows the test-content banner whenever one is visible", () => {
    for (const f of readdirSync(join(root, ".github/workflows"))) expect(read(`.github/workflows/${f}`), f).not.toContain("JACKAL_KNOWLEDGE_FIXTURES");
    expect(read("src/app/gnosi/layout.tsx")).toContain("{anySynthetic && <FixtureBanner s={s} />}");
    expect(SITE.el.knowledge.fixtureBanner).toMatch(/^ΔΟΚΙΜΑΣΤΙΚΟ ΠΕΡΙΕΧΟΜΕΝΟ/);
  });
  it("cover every kind and every topic, so each part of the page can be checked", () => {
    expect(new Set(FIXTURES_FOR_TESTS.map((e) => e.kind))).toEqual(new Set(["term", "article", "faq"]));
    expect(new Set(FIXTURES_FOR_TESTS.map((e) => e.topic)).size).toBe(8);
  });
});

describe("the K1 register as drafts in the private preview (owner, 23 Oct 2026 16:19: «Preview only, marked draft»)", () => {
  const before = process.env.JACKAL_KNOWLEDGE_DRAFTS;
  afterEach(() => { if (before === undefined) delete process.env.JACKAL_KNOWLEDGE_DRAFTS; else process.env.JACKAL_KNOWLEDGE_DRAFTS = before; });
  it("all 221 entries, same IDs, topics and review states as the workbook; every one marked draft, none can pass the gate", () => {
    expect(DRAFTS_FOR_TESTS.map((e) => e.id)).toEqual(REGISTER_FOR_TESTS.map((e) => e.id));
    expect(DRAFTS_FOR_TESTS.map((e) => [e.topic, e.kind, e.verification.status])).toEqual(REGISTER_FOR_TESTS.map((e) => [e.topic, e.kind, e.verification.status]));
    for (const e of DRAFTS_FOR_TESTS) {
      expect(e.draftPreview).toBe(true);
      expect(e.publication.approved).toBe(false);
      expect(e.sources).toEqual([]);
      expect(publicationGate(e).missing).toContain("draft_preview");
    }
  });
  it("the text shown is the workbook's draft text (40 entries); the other 181 show their title only", () => {
    const withText = DRAFTS_FOR_TESTS.filter((e) => e.body);
    expect(withText).toHaveLength(40);
    for (const e of withText) {
      const d = REGISTER_FOR_TESTS.find((x) => x.id === e.id)!.draft as { el: string; en: string };
      expect(e.body).toEqual({ el: d.el.trim(), en: d.en.trim() });
    }
  });
  it("appear only when JACKAL_KNOWLEDGE_DRAFTS=1, set only by the two private preview workflows; never by default", () => {
    delete process.env.JACKAL_KNOWLEDGE_DRAFTS;
    expect(draftsEnabled()).toBe(false);
    expect(visibleEntries(false)).toEqual([]);
    expect(entryById("LEX-0001", false)).toBeNull();
    process.env.JACKAL_KNOWLEDGE_DRAFTS = "1";
    expect(visibleEntries(false)).toHaveLength(221);
    expect(entryById("LEX-0001", false)?.draftPreview).toBe(true);
    for (const f of readdirSync(join(root, ".github/workflows"))) {
      const has = read(`.github/workflows/${f}`).includes("JACKAL_KNOWLEDGE_DRAFTS");
      expect(has, f).toBe(["design-preview.yml", "static-snapshot.yml"].includes(f));
    }
    expect(read(".github/workflows/design-preview.yml")).toContain("JACKAL_KNOWLEDGE_DRAFTS=1 PORT=3000 npm start");
    expect(read(".github/workflows/static-snapshot.yml")).toContain("JACKAL_KNOWLEDGE_DRAFTS=1 PORT=3000 npm start");
  });
  it("search over the real terms: «φορολογια», «ΚΑΔ», «ΕΣΠΑ», «ΙΚΕ» (owner's examples) — accents ignored, exact title first", () => {
    const items = toItems(DRAFTS_FOR_TESTS, "el");
    const ids = (q: string) => filterAndRank(items, q).map((i) => i.id);
    expect(ids("φορολογια")).toEqual(expect.arrayContaining(["LEX-0018", "BAS-0023", "BAS-0170"]));
    expect(ids("φορολογία")).toEqual(ids("φορολογια"));
    expect(ids("ΚΑΔ")[0]).toBe("LEX-0041");
    expect(ids("καδ")).toEqual(ids("ΚΑΔ"));
    expect(ids("ΕΣΠΑ")[0]).toBe("LEX-0116");
    expect(ids("ΕΣΠΑ")).toEqual(expect.arrayContaining(["BAS-0145"]));
    expect(ids("ΙΚΕ")[0]).toBe("LEX-0034");
    expect(ids("ΙΚΕ")[1]).toBe("FAQ-0060"); // «Ποια η διαφορά ΙΚΕ και…», not «…φορολογικές…»
    expect(ids("ΙΚΕ").indexOf("FAQ-0028")).toBeGreaterThan(1);
    expect(filterAndRank(items, "").length).toBe(221);
    expect(filterAndRank(items, "", "forologia").every((i) => i.topic === "forologia")).toBe(true);
  });
  it("every page says so: the banner, an «Υπό επαλήθευση» tag on each item and entry, and the review status", () => {
    expect(read("src/app/gnosi/layout.tsx")).toContain("{anyDraft && <DraftBanner s={s} />}");
    expect(SITE.el.knowledge.draftBanner).toMatch(/^ΥΠΟ ΕΠΑΛΗΘΕΥΣΗ — ΜΟΝΟ ΓΙΑ ΕΣΩΤΕΡΙΚΟ ΕΛΕΓΧΟ/);
    expect(SITE.el.knowledge.draftTag).toBe("Υπό επαλήθευση");
    expect(SITE.en.knowledge.draftBanner).toMatch(/^UNDER VERIFICATION — FOR INTERNAL REVIEW ONLY/);
    expect(read("src/components/knowledge-browser.tsx")).toContain("{i.isDraft && <span className=\"kn-flag\">{labels.reviewFlag}</span>}");
    const entry = read("src/app/gnosi/oros/[id]/page.tsx");
    expect(entry).toContain("{e.draftPreview && <span className=\"kn-flag\">{k.reviewFlag}</span>}");
    expect(entry).toContain("k.draftStates[v.status]");
    expect(SITE.el.knowledge.draftStates).toEqual({ unverified: "Δεν έχει ελεγχθεί", draft: "Προσχέδιο κειμένου", source_located: "Βρέθηκε πιθανή επίσημη πηγή" });
  });
});

describe("UX revision (owner review, 23 Oct 2026 18:07)", () => {
  it("the home page lists entries only when searching; topics come first, as a card grid", () => {
    const hub = read("src/app/gnosi/page.tsx");
    expect(hub).toContain("searchOnly");
    expect(hub.indexOf("k.exploreTopics")).toBeLessThan(hub.indexOf("k.browseSections"));
    expect(read("src/components/knowledge-browser.tsx")).toContain('hidden={searchOnly && !searching}');
    expect(read("src/app/globals.css")).toContain(".kn-chips { display: flex; flex-wrap: wrap;");
    expect(read("src/app/globals.css")).not.toMatch(/\.kn-(chips|tabs) \{[^}]*overflow-x: auto/);
  });
  it("a topic page groups its entries: Μάθε τα βασικά · Συγκρίσεις · Λεξικό · Συχνές Ερωτήσεις (sections, not tabs)", () => {
    const page = read("src/app/gnosi/themata/[topic]/page.tsx");
    const order = ['group("article", "vasika")', 'data-topic-section="sygkriseis"', 'group("term", "lexiko")', 'group("faq", "syxnes-erotiseis")'].map((x) => page.indexOf(x));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("comparisons: the legal-forms table compares six dictionary entries on five rows and holds NO values yet", () => {
    const c = COMPARISONS_FOR_TESTS.find((x) => x.id === "CMP-001")!;
    expect(c.columns).toEqual(["LEX-0031", "LEX-0032", "LEX-0033", "LEX-0034", "LEX-0035", "LEX-0036"]);
    for (const id of c.columns) expect(REGISTER_FOR_TESTS.some((e) => e.id === id && e.topic === "epixeirimatikotita")).toBe(true);
    expect(c.rows.map((r) => r.id)).toEqual(["taxation", "liability", "insurance", "management", "admin"]);
    expect(c.cells).toEqual({});
    expect(c.publication.approved).toBe(false);
    expect(visibleComparisons(false)).toEqual([]);
    expect(visibleComparisons(true).map((x) => x.id)).toEqual(["CMP-001"]);
    expect(read("src/components/knowledge.tsx")).toContain("k.comparisonPending");
  });
  it("missing content is stated, never an empty card; the audit matches the register", () => {
    const audit = JSON.parse(read("data/knowledge/content-audit.json"));
    expect(audit.totals).toMatchObject({ entries: 221, no_text_el: 181, no_text_en: 181, no_title_en: 181, duplicate_ids: 0 });
    expect(DRAFTS_FOR_TESTS.filter((e) => !e.body).length).toBe(audit.totals.no_text_el);
    expect(audit.missing_text.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(["LEX-0003", "LEX-0004"])); // Taxisnet, myAADE
    expect(SITE.el.knowledge.pendingContent).toBe("Περιεχόμενο υπό προετοιμασία");
    expect(read("src/components/knowledge-browser.tsx")).toContain("{i.snippet ? <p>{i.snippet}</p> : <p className=\"kn-pending\" data-pending>{labels.pending}</p>}");
    expect(read("src/app/gnosi/oros/[id]/page.tsx")).toContain("{k.pendingContent}");
  });
});

describe("structure: four sections over one content system, eight topics", () => {
  it("exactly four sections in the owner's order (23 Oct 2026 16:37); «Θέματα» is a view, the other three are kinds of entry", () => {
    expect(SECTIONS.map((s) => s.name.el)).toEqual(["Θέματα", "Λεξικό", "Μάθε τα βασικά", "Συχνές Ερωτήσεις"]);
    expect(SECTIONS.map((s) => s.name.en)).toEqual(["Topics", "Dictionary", "Learn the Basics", "FAQ"]);
    expect(SECTIONS.map((s) => s.kind)).toEqual([null, "term", "article", "faq"]);
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
