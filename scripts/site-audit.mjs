// Functional audit of the running app (design & functionality sprint, 17 Oct 2026). Read-only: it clicks and reads,
// registers one made-up test account on the throwaway CI database, and writes <outDir>/audit.json.
// Usage: node scripts/site-audit.mjs <outDir>   (app on http://127.0.0.1:3000)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "audit";
mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const MAX_PAGES = 70; // per pass
const report = { pages: {}, broken_links: [], issues: [], journey: [], interactions: [] };
const issue = (severity, where, what) => report.issues.push({ severity, where, what });

/** Checks run on every page: structure, accessibility basics, dead controls, overflow. */
async function inspect(page) {
  return page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
    const nameOf = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim() || (el.querySelector("img[alt],svg title") ? "x" : "");
    const h1 = [...document.querySelectorAll("h1")].filter(vis).length;
    const deadLinks = [...document.querySelectorAll("a")].filter(vis).filter((a) => { const h = a.getAttribute("href"); return h === null || h === "" || h === "#" || h.startsWith("javascript:"); }).map((a) => a.textContent.trim().slice(0, 40));
    const missingAnchors = [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href").slice(1)).filter((id) => id && !document.getElementById(id));
    const unnamedButtons = [...document.querySelectorAll("button, a")].filter(vis).filter((b) => !nameOf(b)).map((b) => b.outerHTML.slice(0, 80));
    const unlabeled = [...document.querySelectorAll("input:not([type=hidden]):not([type=submit]), select, textarea")].filter(vis).filter((i) => {
      if (i.getAttribute("aria-label") || i.getAttribute("aria-labelledby") || i.closest("label")) return false;
      return !(i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`));
    }).map((i) => `${i.tagName.toLowerCase()}[name=${i.getAttribute("name")}]`);
    const imgsNoAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
    const fakeClickable = [...document.querySelectorAll("div, span, li, article")].filter(vis).filter((el) => getComputedStyle(el).cursor === "pointer" && !el.closest("a, button, label, summary")).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`).slice(0, 5);
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    const external = [...document.querySelectorAll('a[href^="http"]')].map((a) => ({ href: a.getAttribute("href"), newTab: a.target === "_blank", rel: a.rel }));
    // Official text quoted as published (scope excerpts, call conditions) is the source's own wording, not ours.
    const ours = document.body.cloneNode(true);
    ours.querySelectorAll(".official-text, .official-block").forEach((n) => n.remove());
    const text = ours.innerText ?? ours.textContent ?? "";
    const placeholders = (text.match(/lorem ipsum|\bTODO\b|coming soon|\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date/g) ?? []).slice(0, 5);
    return { title: document.title, lang: document.documentElement.lang, h1, deadLinks, missingAnchors, unnamedButtons, unlabeled, imgsNoAlt, fakeClickable, overflow, links, external, placeholders };
  });
}

async function crawl(ctx, label, seeds) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  const seen = new Set(); const queue = [...seeds]; const linkTargets = new Set();
  while (queue.length && seen.size < MAX_PAGES) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    errs.length = 0;
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" }).catch((e) => ({ status: () => 0, err: e.message }));
    const info = await inspect(page);
    const key = `${label} ${path}`;
    report.pages[key] = { status: res.status(), title: info.title, lang: info.lang, errors: [...errs] };
    const where = key;
    if (res.status() >= 400 && !path.includes("does-not-exist")) issue("critical", where, `HTTP ${res.status()}`);
    if (errs.length) issue("high", where, `browser errors: ${errs.slice(0, 2).join(" | ")}`);
    if (info.h1 !== 1) issue("low", where, `${info.h1} visible h1 headings (expected 1)`);
    if (info.deadLinks.length) issue("high", where, `links that go nowhere: ${info.deadLinks.join(", ")}`);
    if (info.missingAnchors.length) issue("medium", where, `in-page links to missing sections: #${info.missingAnchors.join(", #")}`);
    if (info.unnamedButtons.length) issue("medium", where, `controls without an accessible name: ${info.unnamedButtons.slice(0, 2).join(" ")}`);
    if (info.unlabeled.length) issue("medium", where, `form fields without a label: ${info.unlabeled.slice(0, 4).join(", ")}`);
    if (info.imgsNoAlt) issue("low", where, `${info.imgsNoAlt} images without alt text`);
    if (info.fakeClickable.length) issue("medium", where, `looks clickable but is not a link/button: ${info.fakeClickable.join(", ")}`);
    if (info.overflow) issue("high", where, "page scrolls sideways");
    if (info.placeholders.length) issue("high", where, `placeholder or broken text on screen: ${info.placeholders.join(", ")}`);
    for (const x of info.external) if (!x.newTab || !/noopener/.test(x.rel)) issue("low", where, `external link without new tab/noopener: ${x.href.slice(0, 60)}`);
    for (const href of info.links) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const clean = href.split("#")[0];
      if (!clean) continue;
      linkTargets.add(clean);
      const u = new URL(clean, BASE);
      // crawl app pages, at most a few list-filter variants and detail pages
      const isDetail = /^\/opportunities\/[0-9a-f-]{36}$/.test(u.pathname);
      const crawlable = !u.pathname.startsWith("/api") && !u.pathname.startsWith("/admin") && !u.pathname.endsWith("/decision") && (u.search === "" || u.pathname === "/guides" || /^\?(cat|status|scope|type|audience)=[\w-]+$/.test(u.search));
      if (crawlable && !seen.has(clean) && (!isDetail || [...seen].filter((s) => s.startsWith("/opportunities/")).length < 6)) queue.push(clean);
    }
  }
  // every internal link target must answer
  for (const t of linkTargets) {
    if (t.startsWith("/api/me/export") || t.startsWith("/admin")) continue;
    const r = await ctx.request.get(BASE + t, { maxRedirects: 5 }).catch(() => null);
    const s = r ? r.status() : 0;
    if (s >= 400 || s === 0) report.broken_links.push({ pass: label, target: t, status: s });
  }
  await page.close();
  return seen.size;
}

const browser = await chromium.launch();
const SEEDS = ["/", "/opportunities", "/categories", "/for-me", "/guides", "/about", "/login", "/register", "/profile", "/dashboard"];

// 1. Guest crawls (Greek desktop, English desktop, Greek phone)
for (const [label, lang, viewport] of [["el-desktop", "el", { width: 1440, height: 900 }], ["en-desktop", "en", { width: 1440, height: 900 }], ["el-phone", "el", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport, locale: lang === "el" ? "el-GR" : "en-GB" });
  await ctx.addCookies([{ name: "lang", value: lang, url: BASE }]);
  const n = await crawl(ctx, label, SEEDS);
  report.interactions.push({ check: `crawl ${label}`, pages: n });
  await ctx.close();
}

// 2. Interactions and the visitor-to-match journey (Greek, desktop)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "el-GR" });
await ctx.addCookies([{ name: "lang", value: "el", url: BASE }]);
const page = await ctx.newPage();
const step = (name, ok, detail = "") => { report.journey.push({ step: name, ok, detail }); if (!ok) issue("critical", "journey", `${name}: ${detail}`); };
const count = async () => page.locator(".opp-card").count();
try {
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  step("1 homepage loads with a call to action", (await page.locator("main a.btn-primary, main a.btn").count()) > 0);
  const ctas = await page.locator("main a.btn").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  report.interactions.push({ check: "homepage buttons", targets: ctas });

  // language switch
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST").catch(() => null), page.locator('form.lang button[value="en"]').first().click()]);
  await page.waitForTimeout(1500);
  const navText = (await page.locator("nav.main").first().textContent()) ?? "";
  const langAttr = await page.evaluate(() => document.documentElement.lang);
  await page.reload({ waitUntil: "networkidle" });
  const langReload = await page.evaluate(() => document.documentElement.lang);
  report.interactions.push({ check: "language switch to EN", nav: navText.trim().slice(0, 60), htmlLangBeforeReload: langAttr, htmlLangAfterReload: langReload });
  if (!/Opportunities/.test(navText)) issue("high", "language switch", "clicking EN did not change the visible text to English");
  else if (langAttr !== "en") issue("medium", "language switch", "text switches to English but <html lang> stays 'el' until the page is reloaded (screen readers read English with Greek pronunciation)");
  await ctx.addCookies([{ name: "lang", value: "el", url: BASE }]);

  // home category counts vs the category list
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const homeCats = await page.locator('a[href^="/opportunities?cat="]').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute("href"), text: a.textContent.replace(/\s+/g, " ").trim().slice(-40) })));
  for (const c of homeCats.slice(0, 12)) {
    await page.goto(BASE + c.href, { waitUntil: "networkidle" });
    const n = await count();
    const m = c.text.match(/(\d+)/);
    report.interactions.push({ check: `home card ${c.href}`, home: c.text, list: n });
    if (m && Number(m[1]) > 0 && n === 0) issue("critical", c.href, `homepage says "${c.text}" but the category list shows 0 opportunities`);
  }

  // Milestone 1 regression: A21 (open, re-check due) stays visible in its category with the re-check label
  await page.goto(BASE + "/opportunities?cat=family", { waitUntil: "networkidle" });
  const familyCards = await count();
  const recheckLabels = await page.getByText("Χρειάζεται νέος έλεγχος").count();
  step("2b open records due for re-check stay listed (A21 in «Οικογένεια»)", familyCards > 0, `${familyCards} cards, ${recheckLabels} «Χρειάζεται νέος έλεγχος» labels`);

  // opportunities: search and filters
  await page.goto(BASE + "/opportunities", { waitUntil: "networkidle" });
  const all = await count();
  step("2 opportunities list shows cards", all > 0, `${all} cards`);
  await page.goto(BASE + "/opportunities?q=" + encodeURIComponent("επίδομα"), { waitUntil: "networkidle" });
  const searched = await count();
  report.interactions.push({ check: "search «επίδομα»", cards: searched });
  if (searched === 0) issue("high", "opportunities search", "searching «επίδομα» (accented Greek) finds nothing");
  await page.goto(BASE + "/opportunities?q=" + encodeURIComponent("επιδομα"), { waitUntil: "networkidle" });
  const searchedNoAccent = await count();
  report.interactions.push({ check: "search «επιδομα» (no accents)", cards: searchedNoAccent });
  if (searchedNoAccent === 0 && searched > 0) issue("medium", "opportunities search", "search without accents («επιδομα») finds nothing, unlike the guides search");
  for (const f of ["cat=family", "cat=employment", "scope=gr", "status=open", "type=benefit", "audience=employee_jobseeker"]) {
    await page.goto(BASE + "/opportunities?" + f, { waitUntil: "networkidle" });
    report.interactions.push({ check: `filter ${f}`, cards: await count() });
  }

  // detail page from the list
  await page.goto(BASE + "/opportunities?scope=gr", { waitUntil: "networkidle" });
  const firstHref = await page.locator(".opp-card h3 a").first().getAttribute("href");
  await page.goto(BASE + firstHref, { waitUntil: "networkidle" });
  const officialLinks = await page.locator('a[href^="https://"]').count();
  step("3 opportunity detail opens with official links", officialLinks > 0, `${firstHref}, ${officialLinks} official links`);

  // register → profile → save → For Me
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.fill("#email", `audit-${Date.now()}@preview.example`);
  await page.fill("#password", "made-up audit password");
  await Promise.all([page.waitForURL(/\/profile/), page.click("form button.btn-primary")]);
  step("4 register leads to the profile", page.url().includes("/profile"));
  const fields = await page.locator("form input, form select").count();
  report.interactions.push({ check: "profile form fields visible", fields });
  // step-by-step onboarding: who → interests → work
  await page.check('input[name="personas"][value="employee_jobseeker"]');
  await page.click('[data-step="interests"]');
  await page.check('input[name="interests"][value="employment"]');
  await page.click('[data-step="work"]').catch(() => issue("high", "profile", "work step missing after choosing the job-seeker group"));
  await page.selectOption('select[name="employment_status"]', "unemployed").catch(() => issue("high", "profile", "employment status question not found after choosing the job-seeker group"));
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.locator("form button.btn-primary").last().click()]);
  await page.waitForTimeout(1500);
  const feedback = (await page.locator('[role=status], .notice').allTextContents()).join(" | ").slice(0, 120);
  report.interactions.push({ check: "profile save feedback", text: feedback });
  await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
  const saved = await page.locator('select[name="employment_status"]').inputValue().catch(() => "");
  step("5 profile answers are saved", saved === "unemployed", `employment_status after reload = ${saved || "(empty)"}`);

  await page.goto(BASE + "/for-me", { waitUntil: "networkidle" });
  const matches = await count();
  const badges = await page.locator(".opp-card .badge").allTextContents();
  step("6 For Me shows personalised results", matches > 0, `${matches} cards; labels: ${[...new Set(badges)].slice(0, 6).join(" / ")}`);
  const euInPersonal = await page.locator(".opp-grid .opp-card .authority").evaluateAll((els) => els.filter((e) => /Ευρωπαϊκή Ένωση/.test(e.textContent)).length);
  step("6b no EU call of unconfirmed applicant type among an individual's personal matches", euInPersonal === 0, `${euInPersonal} EU cards in the personal results`);
  const separated = await page.locator("details.applicant-note").count();
  report.interactions.push({ check: "programmes not confirmed for individuals listed apart", present: separated > 0 });
  const missingInfo = await page.getByText(/χρειάζ|λείπ|ερωτ/i).count();
  report.interactions.push({ check: "For Me mentions missing information / questions", hits: missingInfo });

  if (matches > 0) {
    const h = await page.locator(".opp-card h3 a").first().getAttribute("href");
    await page.goto(BASE + h, { waitUntil: "networkidle" });
    const elig = await page.locator("#eligibility").count();
    const record = await page.locator("details.audit").count();
    const apply = await page.locator('a[href^="https://"]').first().getAttribute("href").catch(() => null);
    step("7 opened match explains eligibility", elig > 0, `${h}; decision record: ${record > 0}`);
    step("8 official source link present", !!apply, apply ?? "none");
  }

  // guides interactions
  await page.goto(BASE + "/guides?q=" + encodeURIComponent("ανεργια") + "#results", { waitUntil: "networkidle" });
  report.interactions.push({ check: "guides search «ανεργια»", cards: await page.locator(".guide-card").count() });
  await page.goto(BASE + "/guides?cat=benefits#results", { waitUntil: "networkidle" });
  report.interactions.push({ check: "guides category benefits", cards: await page.locator(".guide-card").count() });

  // logged-in crawl of account pages
  const n = await crawl(ctx, "el-signed-in", ["/profile", "/for-me", "/dashboard", "/opportunities"]);
  report.interactions.push({ check: "crawl el-signed-in", pages: n });
} catch (e) {
  issue("critical", "journey", `stopped: ${e.message.split("\n")[0]}`);
}
await browser.close();

const order = { critical: 0, high: 1, medium: 2, low: 3 };
report.issues.sort((a, b) => order[a.severity] - order[b.severity]);
report.summary = Object.fromEntries(Object.keys(order).map((k) => [k, report.issues.filter((i) => i.severity === k).length]));
writeFileSync(`${out}/audit.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary), `broken links: ${report.broken_links.length}`);
