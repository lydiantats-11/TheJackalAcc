// Private clickable snapshot of the MVP: crawls the running app (preview database) and saves plain HTML pages
// that link to each other, so the redesign can be clicked through without hosting.
// Usage: node scripts/static-snapshot.mjs <outDir>   (app on http://127.0.0.1:3000)
// Nothing here is deployed. Sign-in, saving, profile editing and search need the real app and are disabled in the copy.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "static-snapshot";
const BASE = "http://127.0.0.1:3000";
const MAX_PAGES = Number(process.env.SNAPSHOT_MAX_PAGES ?? 110); // per language (artifact file limits)
mkdirSync(`${out}/assets`, { recursive: true });

const CATS = ["employment", "entrepreneurship", "business", "agriculture", "education", "housing-energy", "family", "innovation", "environment", "tenders", "tax"];
const SEEDS = [
  "/", "/opportunities", "/categories", "/for-me", "/guides", "/about", "/login", "/register",
  ...CATS.map((c) => `/opportunities?cat=${c}`),
  "/opportunities?scope=gr", "/opportunities?scope=eu", "/opportunities?applicant=organisations", "/opportunities?applicant=individuals", "/opportunities?status=open", "/opportunities?status=upcoming", "/opportunities?status=all",
  "/guides/eligibility-labels", "/guides/applying-officially", "/guides/unemployment-benefit-application", "/lab/espa-example",
  ...["step-by-step", "benefits", "business-grants", "employment-education", "housing-energy", "eu-programmes", "faq-glossary", "news-updates"].map((c) => `/guides?cat=${c}`),
];
const ALLOWED_PATH = /^\/lab\/espa-example$|^\/$|^\/opportunities(\/[0-9a-f-]{36})?$|^\/categories$|^\/guides(\/[\w-]+)?$|^\/about$|^\/for-me$|^\/login$|^\/register$/;
const LIST_PARAMS = new Set(["cat", "status", "scope", "type", "audience", "applicant"]);
const DEFAULTS = { status: "current", page: "1" };

/** Same normalisation as assets/snap.js: drop empty and default params, sort the rest. */
function keyOf(href) {
  const u = new URL(href, BASE);
  const p = [...u.searchParams.entries()].filter(([k, v]) => v !== "" && DEFAULTS[k] !== v).sort(([a], [b]) => a.localeCompare(b));
  return u.pathname + (p.length ? "?" + p.map(([k, v]) => `${k}=${v}`).join("&") : "");
}
function crawlable(key) {
  const u = new URL(key, BASE);
  if (!ALLOWED_PATH.test(u.pathname)) return false;
  const params = [...u.searchParams.keys()];
  if (params.length === 0) return true;
  if (u.pathname === "/guides") return params.length === 1 && params[0] === "cat"; // guide categories
  return u.pathname === "/opportunities" && params.length === 1 && LIST_PARAMS.has(params[0]); // single-filter views only
}
const fileOf = (locale, key) => {
  if (key === "/") return `${locale}--index.html`;
  return `${locale}--${key.slice(1).replace(/[/?=&]+/g, "_").replace(/[^\w.-]/g, "")}.html`;
};

const assets = new Map(); // remote path -> local file name
async function saveCss(ctx, path) {
  if (assets.has(path)) return assets.get(path);
  const name = `assets/${path.split("/").pop().split("?")[0]}`;
  assets.set(path, name);
  let css = await (await ctx.request.get(BASE + path)).text();
  const fonts = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ""));
  for (const f of new Set(fonts)) {
    if (f.startsWith("data:")) continue;
    const abs = new URL(f, BASE + path).pathname;
    const local = abs.split("/").pop();
    writeFileSync(`${out}/assets/${local}`, Buffer.from(await (await ctx.request.get(BASE + abs)).body()));
    css = css.split(f).join(local);
  }
  writeFileSync(`${out}/${name}`, css);
  return name;
}

const BANNER = {
  el: `<div class="snap-banner">Ιδιωτική προεπισκόπηση — στατικό αντίγραφο της ${new Date().toLocaleDateString("el-GR", { timeZone: "Europe/Athens" })} από βάση δοκιμών. Η σύνδεση, η αποθήκευση, η αναζήτηση και οι αλλαγές προφίλ λειτουργούν μόνο στην πλήρη εφαρμογή. Δεν είναι επίσημη κρατική υπηρεσία. <a href="el--index.html">Αρχική</a></div>`,
  en: `<div class="snap-banner">Private preview — static copy from a test database, ${new Date().toLocaleDateString("en-GB", { timeZone: "Europe/Athens", day: "numeric", month: "short", year: "numeric" })}. Sign-in, saving, search and profile changes only work in the full app. Not an official government service. <a href="en--index.html">Home</a></div>`,
};
const DEMO_BANNER = {
  el: `<div class="snap-banner demo">Επίδειξη: «Για Εμένα» για ένα δοκιμαστικό προφίλ (άνεργος/η, νοικοκυριό, ενδιαφέροντα: εργασία, οικογένεια). Ενδεικτικό — όχι πραγματικό πρόσωπο.</div>`,
  en: `<div class="snap-banner demo">Demo: "For Me" for a made-up test profile (unemployed, household; interests: work, family). Illustration — not a real person.</div>`,
};

const pages = { el: new Map(), en: new Map() }; // key -> { html, file }
const browser = await chromium.launch();

const ONB_NAV = (l) => `<div class="snap-banner demo">${l === "el" ? "Διαδρομή «Για Εμένα»:" : "«For Me» journey:"} <a href="${l}--for-me-onboarding-1.html">${l === "el" ? "1. Περιγραφές" : "1. Descriptions"}</a> · <a href="${l}--for-me-onboarding-2.html">${l === "el" ? "2. Ερωτήσεις" : "2. Questions"}</a> · <a href="${l}--for-me-demo.html">${l === "el" ? "3. Αποτελέσματα" : "3. Results"}</a></div>`;

async function capture(page, ctx, locale) {
  // Plain HTML: drop Next's scripts and preloads; keep server-rendered markup and stylesheets.
  const raw = await page.evaluate(() => {
    document.querySelectorAll("script, link[rel=preload], link[rel=modulepreload], next-route-announcer, nextjs-portal").forEach((n) => n.remove());
    // Keep what the visitor chose: live checkbox and select state becomes markup.
    document.querySelectorAll("input[type=checkbox], input[type=radio]").forEach((i) => (i.checked ? i.setAttribute("checked", "") : i.removeAttribute("checked")));
    document.querySelectorAll("select option").forEach((o) => (o.selected ? o.setAttribute("selected", "") : o.removeAttribute("selected")));
    return { html: "<!doctype html>\n" + document.documentElement.outerHTML, css: [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => new URL(l.href).pathname), links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")) };
  });
  for (const c of raw.css) raw.html = raw.html.split(`"${c}"`).join(`"${await saveCss(ctx, c)}"`).split(`"${c}?`).join(`"${await saveCss(ctx, c)}?`);
  return raw;
}

for (const locale of ["el", "en"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "lang", value: locale, url: BASE }]);
  const page = await ctx.newPage();
  const queue = [...SEEDS];
  const seen = new Set(queue.map(keyOf));
  while (queue.length && pages[locale].size < MAX_PAGES) {
    const key = keyOf(queue.shift());
    const res = await page.goto(BASE + key, { waitUntil: "networkidle" });
    if (!res || res.status() >= 400) { console.log(`skip ${locale} ${key} (${res?.status()})`); continue; }
    const { html, links } = await capture(page, ctx, locale);
    pages[locale].set(key, { html, file: fileOf(locale, key) });
    for (const l of links) {
      if (!l || !l.startsWith("/") || l.startsWith("/_next")) continue;
      const k = keyOf(l);
      if (!seen.has(k) && crawlable(k)) { seen.add(k); queue.push(k); }
    }
  }
  console.log(`${locale}: ${pages[locale].size} pages, ${queue.length} more not captured`);

  // Demo user "For Me" (made-up profile, preview database only)
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.fill("#email", `snapshot-${locale}-${Date.now()}@preview.example`);
  await page.fill("#password", "preview demo password");
  await Promise.all([page.waitForURL(/\/profile/), page.click("form button.btn-primary")]);
  // Step-by-step onboarding (17 Oct 2026): who → interests → work. Two of its screens are kept as demo pages.
  for (const v of ["employee_jobseeker", "household"]) await page.check(`input[name="personas"][value="${v}"]`);
  const who = await capture(page, ctx, locale);
  pages[locale].set("#onb-who", { html: who.html.replace(/<body([^>]*)>/, `<body$1>${DEMO_BANNER[locale]}${ONB_NAV(locale)}`), file: `${locale}--for-me-onboarding-1.html` });
  await page.click('[data-step="interests"]');
  for (const v of ["employment", "family"]) await page.check(`input[name="interests"][value="${v}"]`);
  await page.click('[data-step="work"]');
  await page.selectOption('select[name="employment_status"]', "unemployed").catch(() => {});
  const work = await capture(page, ctx, locale);
  pages[locale].set("#onb-work", { html: work.html.replace(/<body([^>]*)>/, `<body$1>${DEMO_BANNER[locale]}${ONB_NAV(locale)}`), file: `${locale}--for-me-onboarding-2.html` });
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.locator("form button.btn-primary").last().click()]);
  await page.waitForLoadState("networkidle");
  await page.goto(BASE + "/for-me", { waitUntil: "networkidle" });
  if (await page.locator(".empty").count()) throw new Error(`${locale}: demo profile did not save — For Me is empty`);
  const demo = await capture(page, ctx, locale);
  pages[locale].set("#demo", { html: demo.html.replace(/<body([^>]*)>/, `<body$1>${DEMO_BANNER[locale]}${ONB_NAV(locale)}`), file: `${locale}--for-me-demo.html` });
  await ctx.close();
}
await browser.close();

// Rewrite internal links to the saved files; anything not captured goes to a short explanation page.
const manifest = { el: {}, en: {} };
for (const l of ["el", "en"]) for (const [k, p] of pages[l]) if (!k.startsWith("#")) manifest[l][k] = p.file;
for (const l of ["el", "en"]) {
  for (const [, p] of pages[l]) {
    let html = p.html.replace(/href="(\/[^"]*)"/g, (m, href) => {
      const h = href.replace(/&amp;/g, "&");
      if (h.startsWith("/_next") || h.startsWith("assets/")) return m;
      const [path, hash] = h.split("#");
      const file = manifest[l][keyOf(path || "/")] ?? `${l}--missing.html`;
      return `href="${file}${hash ? "#" + hash : ""}"`;
    });
    html = html.replace(/<\/head>/, `<link rel="stylesheet" href="assets/snap.css"><script src="assets/manifest.js"></script><script src="assets/snap.js" defer></script></head>`)
      .replace(/<body([^>]*)>/, `<body$1 data-snap-locale="${l}">${BANNER[l]}`);
    writeFileSync(`${out}/${p.file}`, html);
  }
}
writeFileSync(`${out}/assets/manifest.js`, `window.SNAP_MANIFEST=${JSON.stringify(manifest)};`);

const missing = {
  el: ["Δεν περιλαμβάνεται στην προεπισκόπηση", "Αυτή η σελίδα ή ο συνδυασμός φίλτρων δεν αποθηκεύτηκε σε αυτό το στατικό αντίγραφο. Η αναζήτηση, οι συνδυασμοί φίλτρων, οι επόμενες σελίδες της λίστας, η σύνδεση και το προφίλ λειτουργούν στην πλήρη εφαρμογή.", "Πίσω", "el--index.html", "Αρχική"],
  en: ["Not included in this preview", "This page or filter combination was not saved in this static copy. Search, filter combinations, later list pages, sign-in and profile work in the full app.", "Back", "en--index.html", "Home"],
};
for (const l of ["el", "en"]) {
  const [h, p, back, home, homeLabel] = missing[l];
  const css = [...assets.values()].map((c) => `<link rel="stylesheet" href="${c}">`).join("");
  writeFileSync(`${out}/${l}--missing.html`, `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h}</title>${css}<link rel="stylesheet" href="assets/snap.css"></head><body>${BANNER[l]}<main class="container" style="padding:64px 16px;max-width:640px"><h1>${h}</h1><p>${p}</p><p><a class="btn btn-primary" href="javascript:history.back()">${back}</a> <a class="btn btn-ghost" href="${home}">${homeLabel}</a></p></main></body></html>`);
}
writeFileSync(`${out}/snapshot.json`, JSON.stringify({ el: pages.el.size, en: pages.en.size, assets: [...assets.values()] }, null, 2));
console.log("done");
