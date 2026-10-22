// Two-path leak check and user journey (owner request, 22 Oct 2026), against the running preview app.
// Usage: node scripts/audience-check.mjs <outDir>   (app on http://127.0.0.1:3000; PREVIEW_IDS and CLASSIFICATION env set)
//  1. No programme is listed in both paths (listing with every status, all pages).
//  2. A record opened under the wrong path redirects to its own path; an unclassified (HOLD) record is 404 everywhere.
//  3. Search in one path never returns the other path's records.
//  4. News and guides of one path carry only that path's items; a guide under the wrong path redirects.
//  5. Journey for each path: home → choice → opportunities → details → official application link.
//  6. Database: every record's audience (the 56-record classification table).
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "audience-check";
mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const ids = JSON.parse(process.env.PREVIEW_IDS ?? "{}");
const classification = JSON.parse(process.env.CLASSIFICATION ?? "[]");
const PATHS = { citizen: "politis", business: "epixeiriseis" };
const failures = [];
const checks = [];
const ok = (name, cond, detail = "") => { checks.push({ name, ok: !!cond, detail }); if (!cond) failures.push(`${name}${detail ? ` — ${detail}` : ""}`); };

const get = (path) => fetch(BASE + path, { redirect: "manual", headers: { cookie: "lang=el" } });
// With streaming (root loading.tsx) Next may answer a redirect or a 404 with status 200 plus a refresh tag / the
// not-found page, so both helpers accept either form, and say which one they saw.
async function redirectOf(path) {
  const r = await get(path);
  if (r.status >= 300 && r.status < 400) return { status: r.status, to: r.headers.get("location") ?? "" };
  const text = await r.text();
  const m = text.match(/http-equiv="refresh" content="\d+;\s*url=([^"]+)"/i) ?? text.match(/NEXT_REDIRECT;[a-z]+;([^;"\\]+);/);
  return { status: r.status, to: m ? m[1].replace(/&amp;/g, "&") : "" };
}
async function isNotFound(path) {
  const r = await get(path);
  if (r.status === 404) return true;
  if (r.status !== 200) return false;
  const text = await r.text();
  return text.includes("Η σελίδα δεν βρέθηκε") && !/\/(politis|epixeiriseis)\/eukairies\/[0-9a-f-]{36}/.test(text.replace(/<head>[\s\S]*?<\/head>/, ""));
}
const html = async (path) => { const r = await fetch(BASE + path, { headers: { cookie: "lang=el" } }); return { status: r.status, url: r.url, text: await r.text() }; };
const detailIds = (text, slug) => [...new Set([...text.matchAll(new RegExp(`/${slug}/eukairies/([0-9a-f-]{36})`, "g"))].map((m) => m[1]))];

async function listedIds(slug, query = "status=all") {
  const found = new Set();
  for (let page = 1; page <= 50; page++) {
    const { text } = await html(`/${slug}/eukairies?${query}&page=${page}`);
    const got = detailIds(text, slug);
    const before = found.size;
    got.forEach((x) => found.add(x));
    if (got.length === 0 || found.size === before) break;
  }
  return [...found];
}

// 1 — disjoint listings, and every listed record is classified for that path in the database
const listed = { citizen: await listedIds(PATHS.citizen), business: await listedIds(PATHS.business) };
const both = listed.citizen.filter((x) => listed.business.includes(x));
ok("no programme appears in both paths", both.length === 0, both.join(", "));
const audienceById = Object.fromEntries(classification.map((r) => [r.id, r.audience]));
for (const a of ["citizen", "business"]) {
  const wrong = listed[a].filter((x) => audienceById[x] !== a);
  ok(`${a}: every listed programme is classified ${a}`, wrong.length === 0, wrong.join(", "));
  const expected = classification.filter((r) => r.audience === a && r.review_status === "approved").map((r) => r.id);
  const missing = expected.filter((x) => !listed[a].includes(x));
  ok(`${a}: every ${a} programme is listed (any status)`, missing.length === 0, missing.join(", "));
}
const hold = classification.filter((r) => r.audience === null && r.review_status === "approved");
for (const a of ["citizen", "business"]) ok(`${a}: no unclassified (HOLD) programme is listed`, !hold.some((r) => listed[a].includes(r.id)));

// 2 — direct addresses
for (const [a, other] of [["citizen", "business"], ["business", "citizen"]]) {
  const sample = listed[a].slice(0, 5);
  for (const id of sample) {
    const r = await redirectOf(`/${PATHS[other]}/eukairies/${id}`);
    ok(`${a} record under /${PATHS[other]} redirects to /${PATHS[a]}`, r.to.includes(`/${PATHS[a]}/eukairies/${id}`), `${r.status} ${r.to}`);
  }
  if (sample[0]) {
    const old = await redirectOf(`/opportunities/${sample[0]}`);
    ok(`old address /opportunities/<${a} id> leads to its path`, old.to.includes(`/${PATHS[a]}/eukairies/${sample[0]}`), `${old.status} ${old.to}`);
  }
}
for (const r of hold.slice(0, 5)) {
  for (const slug of Object.values(PATHS)) ok(`HOLD record is not found under /${slug}`, await isNotFound(`/${slug}/eukairies/${r.id}`), r.id);
  ok("HOLD record is not found at the old address", await isNotFound(`/opportunities/${r.id}`), r.id);
}
for (const p of ["/opportunities", "/for-me", "/guides", "/categories", "/dashboard"]) {
  const r = await redirectOf(p);
  ok(`old mixed page ${p} leads to the home page`, !!r.to && new URL(r.to, BASE).pathname === "/", `${r.status} ${r.to}`);
}
ok("unknown path is not found", await isNotFound("/idiotes/eukairies"));

// 3 — search stays inside the path
for (const [a, other, q] of [["citizen", "business", "ενίσχυση"], ["citizen", "business", "ΔΑΜ"], ["business", "citizen", "επίδομα"], ["business", "citizen", "Νέα Ευκαιρία"]]) {
  const hits = await listedIds(PATHS[a], `status=all&q=${encodeURIComponent(q)}`);
  const leak = hits.filter((x) => audienceById[x] !== a);
  ok(`search «${q}» in /${PATHS[a]} returns only ${a} programmes`, leak.length === 0, `${hits.length} hits; leaks: ${leak.join(", ")}`);
}

// 4 — news and guides
for (const a of ["citizen", "business"]) {
  const { text } = await html(`/${PATHS[a]}/nea`);
  const auds = [...text.matchAll(/data-audience="(citizen|business)"/g)].map((m) => m[1]);
  ok(`${a}: news page shows only ${a} articles`, auds.length > 0 && auds.every((x) => x === a), auds.join(","));
  const otherIds = detailIds(text, PATHS[a === "citizen" ? "business" : "citizen"]);
  ok(`${a}: news page links no other-path programme`, otherIds.length === 0);
}
{
  const r = await redirectOf("/epixeiriseis/odigoi/a21");
  ok("citizen guide under /epixeiriseis redirects to /politis", r.to.includes("/politis/odigoi/a21"), `${r.status} ${r.to}`);
  const g = await html("/epixeiriseis/odigoi");
  ok("business guides list has no citizen guide", !/\/epixeiriseis\/odigoi\/(a21|spiti2|unemployment|discovereu|studenthousing|art5[abc])\b/.test(g.text));
  const c = await html("/politis/odigoi");
  ok("citizen guides list has no business guide", !/\/politis\/odigoi\/eic\b/.test(c.text));
}
{
  const home = await html("/");
  ok("home page lists no programme", detailIds(home.text, "politis").length + detailIds(home.text, "epixeiriseis").length === 0);
  ok("home page offers both paths", home.text.includes('href="/politis/eukairies"') && home.text.includes('href="/epixeiriseis/eukairies"'));
}

// 5 — journey, clicked in a real browser: home → choice → opportunities → details → official application
const journey = [];
const browser = await chromium.launch();
for (const [a, slug] of Object.entries(PATHS)) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "lang", value: "el", url: BASE }]);
  const page = await ctx.newPage();
  const steps = [];
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  steps.push({ step: "home", url: page.url() });
  await Promise.all([page.waitForURL(new RegExp(`/${slug}/eukairies`)), page.click(`a.path-choice[data-path="${a}"]`)]);
  steps.push({ step: "choice", url: page.url() });
  const first = page.locator(".opp-card h3 a").first();
  const hasCard = (await first.count()) > 0;
  ok(`${a} journey: opportunities page lists programmes`, hasCard);
  if (hasCard) {
    await Promise.all([page.waitForURL(new RegExp(`/${slug}/eukairies/[0-9a-f-]{36}`)), first.click()]);
    steps.push({ step: "details", url: page.url(), title: (await page.locator("h1").first().textContent())?.trim() });
    const apply = page.locator("#apply a.btn-primary").first();
    const href = (await apply.count()) ? await apply.getAttribute("href") : null;
    ok(`${a} journey: details page has the official application link`, !!href && /^https:\/\//.test(href), href ?? "none");
    steps.push({ step: "official application", url: href });
    const sw = page.locator(".path-switch a");
    ok(`${a} journey: «Ψάχνω ως» switch is shown`, (await sw.count()) > 0);
    if (await sw.count()) {
      await Promise.all([page.waitForLoadState("networkidle"), sw.first().click()]);
      ok(`${a} journey: «Αλλαγή» opens the other path's opportunities, no filters`, new URL(page.url()).pathname === `/${PATHS[a === "citizen" ? "business" : "citizen"]}/eukairies` && !page.url().includes("?"), page.url());
    }
  }
  journey.push({ path: a, steps });
  await ctx.close();
}
await browser.close();

// 6 — classification table (from the database, passed in by the workflow)
const counts = classification.reduce((m, r) => { const k = r.audience ?? "hold"; m[k] = (m[k] ?? 0) + 1; return m; }, {});
writeFileSync(`${out}/audience-check.json`, JSON.stringify({ counts, listed: { citizen: listed.citizen.length, business: listed.business.length }, checks, failures, journey, classification }, null, 2));
console.log(JSON.stringify({ counts, checks: checks.length, failed: failures.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
