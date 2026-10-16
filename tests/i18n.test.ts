/**
 * Language checks for every interface string, Greek and English (16 Oct 2026).
 * House rules: Greek addresses the reader formally (εσείς) everywhere; English never contains Greek except official
 * Greek names and acronyms; both languages have exactly the same keys; no IANA time-zone codes in visible text.
 */
import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { SITE } from "@/lib/site/copy";
import { CATEGORIES } from "@/lib/site/taxonomy";
import { GENERAL_GUIDES } from "@/lib/site/guides";
import { GUIDE_CATEGORIES } from "@/lib/site/guide-catalog";

type Flat = Map<string, string>;
function flat(o: unknown, p = "", out: Flat = new Map()): Flat {
  if (typeof o === "string") out.set(p, o);
  else if (typeof o === "function") { const v = (o as (n: number, m?: number) => unknown)(3, 5); if (typeof v === "string") out.set(`${p}()`, v); }
  else if (Array.isArray(o)) o.forEach((v, i) => flat(v, `${p}[${i}]`, out));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) flat(v, p ? `${p}.${k}` : k, out);
  return out;
}
const word = (w: string) => new RegExp(`(?<!\\p{L})(${w})(?!\\p{L})`, "u");
const INFORMAL_EL = word("σου|είσαι|έχεις|μπορείς|θέλεις|ξέρεις|Δες|δεις|Διάβασε|Έλεγξε|Συμπλήρωσε|Απάντησε|Συνδέσου|Ανακάλυψε|Ξεκίνα|Πάτα|Δοκίμασε|βρεις");
const GREEK = /[Ͱ-Ͽἀ-῿]/;
const GREEK_ALLOWED_IN_EN = /ΚΑΔ|ΦΕΚ|ΔΥΠΑ|ΟΠΕΚΑ|ΑΑΔΕ|Α21|ΕΣΠΑ|ΑΦΜ|ΑΜΚΑ|Διαύγεια|Σπίτι μου|Για Εμένα/g;

const guidesEl = new Map(GENERAL_GUIDES.flatMap((g) => [g.title.el, g.summary.el, ...g.sections.flatMap((s) => [s.h.el, ...s.items.map((i) => i.el)])].map((v, i) => [`${g.slug}.${i}`, v] as [string, string])));
const guidesEn = new Map(GENERAL_GUIDES.flatMap((g) => [g.title.en, g.summary.en, ...g.sections.flatMap((s) => [s.h.en, ...s.items.map((i) => i.en)])].map((v, i) => [`${g.slug}.${i}`, v] as [string, string])));
const catsEl = new Map(CATEGORIES.flatMap((c) => [c.name.el, c.description.el, ...c.subcategories.map((x) => x.el)].map((v, i) => [`${c.slug}.${i}`, v] as [string, string])));
const catsEn = new Map(CATEGORIES.flatMap((c) => [c.name.en, c.description.en, ...c.subcategories.map((x) => x.en)].map((v, i) => [`${c.slug}.${i}`, v] as [string, string])));

const gcatsEl = new Map(GUIDE_CATEGORIES.flatMap((c) => [c.name.el, c.desc.el].map((v, i) => [`${c.slug}.${i}`, v] as [string, string])));
const gcatsEn = new Map(GUIDE_CATEGORIES.flatMap((c) => [c.name.en, c.desc.en].map((v, i) => [`${c.slug}.${i}`, v] as [string, string])));

const SETS: Array<[string, Flat, Flat]> = [
  ["guide categories", gcatsEl, gcatsEn],
  ["dictionary", flat(dictionaries.el), flat(dictionaries.en)],
  ["site copy", flat(SITE.el), flat(SITE.en)],
  ["guides", guidesEl, guidesEn],
  ["categories", catsEl, catsEn],
];

describe("interface language (EL + EN)", () => {
  for (const [name, el, en] of SETS) {
    it(`${name}: same keys in both languages`, () => {
      expect([...el.keys()].filter((k) => !en.has(k))).toEqual([]);
      expect([...en.keys()].filter((k) => !el.has(k))).toEqual([]);
    });
    it(`${name}: Greek addresses the reader formally (εσείς), never informally`, () => {
      expect([...el].filter(([, v]) => INFORMAL_EL.test(v)).map(([k, v]) => `${k}: ${v}`)).toEqual([]);
    });
    it(`${name}: English contains no Greek except official names and acronyms`, () => {
      expect([...en].filter(([, v]) => GREEK.test(v.replace(GREEK_ALLOWED_IN_EN, ""))).map(([k, v]) => `${k}: ${v}`)).toEqual([]);
    });
    it(`${name}: no empty strings, doubled spaces or stray spaces before punctuation`, () => {
      const bad = (v: string) => v.trim() === "" || / {2,}/.test(v) || / [,.;:!?]/.test(v);
      expect([...el, ...en].filter(([, v]) => bad(v)).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)).toEqual([]);
    });
    it(`${name}: no time-zone codes in visible text`, () => {
      expect([...el, ...en].filter(([, v]) => /Europe\/[A-Z]/.test(v)).map(([k]) => k)).toEqual([]);
    });
  }

  it("Greek category names use sentence case (Greek does not capitalise every word)", () => {
    for (const c of CATEGORIES) {
      const words = c.name.el.split(" ").slice(1).filter((w) => w !== "&" && !/^[Α-ΩA-Z]{2,}$/.test(w) && w !== "Ελλάδα");
      expect(words.filter((w) => /^[Α-ΩΆ-Ώ]/.test(w)), c.slug).toEqual([]);
    }
  });
});
