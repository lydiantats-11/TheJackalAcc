// Γνώση (Phase K, 23 Oct 2026): screenshots and checks of the Knowledge pages.
// Usage: node scripts/knowledge-shots.mjs <outDir> <baseUrl> <label>
//   label "preview"    — server with JACKAL_KNOWLEDGE_FIXTURES=1 (synthetic fixtures under the banner)
//   label "production" — server without fixtures: what the public page would show today (no approved content)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [outRoot = "knowledge-shots", BASE = "http://127.0.0.1:3000", label = "preview"] = process.argv.slice(2);
const out = `${outRoot}/knowledge/${label}`;
mkdirSync(out, { recursive: true });
const PAGES = [
  ["hub", "/gnosi"], ["lexiko", "/gnosi/lexiko"], ["vasika", "/gnosi/vasika"], ["faq", "/gnosi/syxnes-erotiseis"],
  ["themata", "/gnosi/themata"], ["topic-forologia", "/gnosi/themata/forologia"], ["entry-dev-001", "/gnosi/oros/DEV-001"],
  ["search", "/gnosi?q=%CE%B4%CE%BF%CE%BA%CE%B9%CE%BC%CE%B1%CF%83%CF%84%CE%B9%CE%BA%CE%BF"],
];
const checks = [];
const ok = (name, cond, detail = "") => checks.push({ name, ok: !!cond, detail });

const browser = await chromium.launch();
for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  for (const lang of vp === "phone" ? ["el"] : ["el", "en"]) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: vp === "phone" ? 2 : 1 });
    await ctx.addCookies([{ name: "lang", value: lang, url: BASE }]);
    const page = await ctx.newPage();
    for (const [name, path] of PAGES) {
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      const status = res?.status() ?? 0;
      await page.screenshot({ path: `${out}/${vp}-${lang}-${name}.jpg`, fullPage: vp === "desktop", type: "jpeg", quality: 80 });
      const f = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        banner: !!document.querySelector("[data-fixture-banner]"),
        tabs: [...document.querySelectorAll(".kn-tabs a")].map((a) => a.textContent?.trim()),
        nav: [...document.querySelectorAll("nav.main a")].map((a) => a.textContent?.trim()),
        items: document.querySelectorAll(".kn-item").length,
        synthetic: document.querySelectorAll("[data-synthetic]").length,
        oppLinks: [...document.querySelectorAll("a[href]")].filter((a) => /\/(politis|epixeiriseis)\/(eukairies\/[0-9a-f-]{36}|nea)/.test(a.getAttribute("href") ?? "")).length,
        notFound: document.body.innerText.includes("Η σελίδα δεν βρέθηκε") || document.body.innerText.includes("Page not found"),
      }));
      ok(`${label}/${vp}/${lang}/${name}: no sideways scroll`, !f.overflow);
      ok(`${label}/${vp}/${lang}/${name}: no opportunity or news links`, f.oppLinks === 0, String(f.oppLinks));
      if (name !== "entry-dev-001" || label === "preview") ok(`${label}/${vp}/${lang}/${name}: page loads`, status === 200 && !f.notFound, String(status));
      if (name === "hub") ok(`${label}/${vp}/${lang}: four section tabs`, f.tabs.length === 5, f.tabs.join(" | "));
      if (label === "production") {
        ok(`${label}/${vp}/${lang}/${name}: no synthetic content and no banner`, f.synthetic === 0 && !f.banner);
        if (name === "entry-dev-001") ok(`${label}: a synthetic entry is not found`, f.notFound || status === 404, String(status));
      } else {
        ok(`${label}/${vp}/${lang}/${name}: test-content banner shown`, f.banner);
        if (name === "lexiko") ok(`${label}/${vp}/${lang}: dictionary lists entries`, f.items > 0, String(f.items));
      }
      checks.push({ name: `${label}/${vp}/${lang}/${name}: nav`, ok: true, detail: f.nav.join(" | ") });
    }
    // a register entry (draft, not approved) is never served
    const r = await page.goto(`${BASE}/gnosi/oros/LEX-0001`, { waitUntil: "networkidle" });
    const nf = await page.evaluate(() => document.body.innerText.includes("Η σελίδα δεν βρέθηκε") || document.body.innerText.includes("Page not found"));
    ok(`${label}/${vp}/${lang}: unapproved register entry LEX-0001 is not served`, nf || r?.status() === 404, String(r?.status()));
    await ctx.close();
  }
}
// interaction: the A–Ω index filters the dictionary (preview only)
if (label === "preview") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "lang", value: "el", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/gnosi/lexiko`, { waitUntil: "networkidle" });
  const all = await page.locator(".kn-item").count();
  await page.locator(".kn-letters button", { hasText: /^Β$/ }).click();
  const b = await page.locator(".kn-item").count();
  ok("preview: letter Β narrows the dictionary", b > 0 && b < all, `${all} → ${b}`);
  await page.locator(".kn-letters button", { hasText: /^Β$/ }).click();
  await page.fill("#kn-q", "γαμμα");
  const g = await page.locator(".kn-item").count();
  ok("preview: accent-free search finds «Γάμμα»", g === 1, String(g));
  await page.screenshot({ path: `${out}/desktop-el-lexiko-search.jpg`, type: "jpeg", quality: 80 });
  await ctx.close();
  // from a path, Γνώση keeps the tabs of that path
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await c2.addCookies([{ name: "lang", value: "el", url: BASE }]);
  const p2 = await c2.newPage();
  await p2.goto(`${BASE}/epixeiriseis/eukairies`, { waitUntil: "networkidle" });
  await Promise.all([p2.waitForURL(/\/gnosi$/), p2.click("nav.main a[href='/gnosi']")]);
  await p2.waitForLoadState("networkidle");
  const hrefs = await p2.evaluate(() => [...document.querySelectorAll("nav.main a")].map((a) => a.getAttribute("href")));
  ok("from /epixeiriseis, Γνώση shows the five tabs of that path", hrefs.length === 5 && hrefs[0] === "/epixeiriseis/eukairies" && hrefs[2] === "/gnosi", hrefs.join(" "));
  await p2.screenshot({ path: `${out}/desktop-el-hub-from-business.jpg`, type: "jpeg", quality: 80 });
  await c2.close();
}
await browser.close();
const failures = checks.filter((c) => !c.ok);
writeFileSync(`${out}/checks.json`, JSON.stringify({ checks, failures }, null, 2));
console.log(JSON.stringify({ label, checks: checks.length, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
