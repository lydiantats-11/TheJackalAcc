// Before/after screenshots of the eight records checked in Phase 1 of the credibility sprint (owner, 22 Oct 2026).
// Usage: node scripts/record-shots.mjs <outDir>   (app on http://127.0.0.1:3000; RECORD_IDS env = [{key, id, audience}])
// For each record: the detail page (desktop, full page) and the top of the detail page on a phone, plus each path's
// listing. Also writes records.json with what the page shows: status label, whether an application button is offered,
// and the deadline / amount texts, so the before and after runs can be compared without opening the images.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = `${process.argv[2] ?? "record-shots"}/records`;
mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const SLUG = { citizen: "politis", business: "epixeiriseis" };
const records = JSON.parse(process.env.RECORD_IDS ?? "[]");
const name = (k) => k.replace(/^manual:/, "").replace(/[^a-z0-9]+/gi, "-");
const report = [];

const browser = await chromium.launch();
for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: vp === "phone" ? 2 : 1, locale: "el-GR" });
  await ctx.addCookies([{ name: "lang", value: "el", url: BASE }]);
  const page = await ctx.newPage();
  for (const r of records) {
    if (!r.id || !r.audience) { report.push({ key: r.key, vp, error: "no id or path" }); continue; }
    const path = `/${SLUG[r.audience]}/eukairies/${r.id}`;
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${vp}-${name(r.key)}.jpg`, fullPage: vp === "desktop", type: "jpeg", quality: 80 });
    if (vp === "desktop") {
      const facts = await page.evaluate(() => {
        const txt = (sel) => [...document.querySelectorAll(sel)].map((e) => (e.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
        const body = (document.querySelector("main") ?? document.body).innerText;
        return {
          title: txt("h1")[0] ?? null,
          applyButton: !!document.querySelector("#apply a.btn-primary"),
          briefApplyButton: !!document.querySelector(".brief a.btn-primary"),
          applyLinks: [...document.querySelectorAll("#apply a")].map((a) => `${(a.textContent ?? "").trim()} → ${a.getAttribute("href")}`),
          pending: txt("[data-pending]"),
          mentions31March: /31 Μαρτίου|31\/3\/2027|31 Mar/.test(body),
          moveYearTable: !!document.querySelector("[data-move-year]"),
          oldStartWording: /μετά την αίτηση/.test(body),
          eligibleLabel: /Επιλέξιμη δαπάνη|[Εε]πιλέξιμος προϋπολογισμός/.test(body),
          cardDeadline: null,
          deadlineLines: body.split("\n").filter((l) => /Προθεσμία|προθεσμία|έως|Έως/.test(l)).slice(0, 8),
          statusLines: body.split("\n").filter((l) => /Ανοιχτές αιτήσεις|Υπό επιβεβαίωση|Μη επιβεβαιωμένη|Χρειάζεται νέος έλεγχος|έληξε|Κλειστές|Ελέγχθηκε|Τελευταίος έλεγχος/.test(l)).slice(0, 8),
        };
      });
      report.push({ key: r.key, path, status: res?.status() ?? null, ...facts });
    }
  }
  for (const slug of Object.values(SLUG)) {
    await page.goto(`${BASE}/${slug}/eukairies`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${vp}-list-${slug}.jpg`, fullPage: vp === "desktop", type: "jpeg", quality: 80 });
  }
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/records.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map((r) => ({ key: r.key, applyButton: r.applyButton, briefApplyButton: r.briefApplyButton, mentions31March: r.mentions31March, moveYearTable: r.moveYearTable, oldStartWording: r.oldStartWording, eligibleLabel: r.eligibleLabel, pending: r.pending, error: r.error })), null, 2));
