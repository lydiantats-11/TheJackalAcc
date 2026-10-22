// Design preview: screenshots of both paths (Πολίτες, Επιχειρήσεις & Επαγγελματίες), desktop + phone, Greek + English, as a guest and as a demo user.
// Usage: node scripts/design-preview.mjs <outDir>   (app running on http://127.0.0.1:3000 with a seeded preview database)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "design-preview";
mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const ids = JSON.parse(process.env.PREVIEW_IDS ?? "{}"); // { a21, eu, dam22, epiro, crete: uuid }
const shots = [];
const errors = [];

async function shoot(page, name, path, opts = {}) {
  const res = path === null ? null : await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (opts.before) await opts.before(page);
  const file = `${name}.jpg`;
  await page.screenshot({ path: `${out}/${file}`, fullPage: opts.full !== false, type: "jpeg", quality: 82 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  shots.push({ name, path: path ?? page.url().replace(BASE, ""), file, status: res ? res.status() : 200, overflow });
  if (overflow) {
    const culprits = await page.evaluate(() => [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.children.length === 0)
      .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}: ${(el.textContent ?? "").trim().slice(0, 40)} (${Math.round(el.getBoundingClientRect().right)}px)`));
    errors.push(`${name}: horizontal scroll — ${culprits.join(" | ")}`);
  }
}

const browser = await chromium.launch();
for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  for (const lang of ["el", "en"]) {
    if (vp === "phone" && lang === "en") continue;
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: vp === "phone" ? 2 : 1, locale: lang === "el" ? "el-GR" : "en-GB" });
    await ctx.addCookies([{ name: "lang", value: lang, url: BASE }]);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${vp}/${lang} pageerror: ${e.message}`));
    const p = `${vp}-${lang}`;
    // guest screens — the two paths (owner decision, 22 Oct 2026): home chooser, then each path from list to official application
    await shoot(page, `${p}-01-home`, "/");
    for (const [k, slug] of [["c", "politis"], ["b", "epixeiriseis"]]) {
      const P = `/${slug}`;
      await shoot(page, `${p}-${k}1-opportunities`, `${P}/eukairies`);
      const detail = k === "c" ? ids.a21 : ids.crete;
      if (detail) await shoot(page, `${p}-${k}2-detail`, `${P}/eukairies/${detail}`);
      await shoot(page, `${p}-${k}3-news`, `${P}/nea`);
      await shoot(page, `${p}-${k}4-guides`, `${P}/odigoi`);
      if (lang === "el" && vp === "desktop") {
        await shoot(page, `${p}-${k}5-about`, `${P}/jackal`);
        await shoot(page, `${p}-${k}6-account-guest`, `${P}/logariasmos`);
        await shoot(page, `${p}-${k}7-search`, `${P}/eukairies?q=` + encodeURIComponent(k === "c" ? "επίδομα" : "επενδυτικ"));
      }
    }
    if (lang === "el") {
      await shoot(page, `${p}-c8-guide`, "/politis/odigoi/a21");
      if (ids.epiro) await shoot(page, `${p}-c9-detail-nea-eykairia`, `/politis/eukairies/${ids.epiro}`);
      if (ids.dam22) await shoot(page, `${p}-b8-detail-dam22`, `/epixeiriseis/eukairies/${ids.dam22}`);
      // a citizen record opened under the business path is moved to its own path, with a notice
      if (ids.a21 && vp === "desktop") await shoot(page, `${p}-x1-wrong-path-redirect`, `/epixeiriseis/eukairies/${ids.a21}`, { full: false });
      if (vp === "desktop") {
        await shoot(page, `${p}-x2-about-shared`, "/about");
        await shoot(page, `${p}-x3-login`, "/login", { full: false });
        await shoot(page, `${p}-x4-not-found`, "/this-page-does-not-exist", { full: false });
      }
    }
    // demo user: register, answer a few questions as "User A" (unemployed, looking for benefits), view For Me
    if (vp === "desktop" || lang === "el") {
      const email = `demo-${vp}-${lang}-${Date.now()}@preview.example`;
      await page.goto(BASE + "/register", { waitUntil: "networkidle" });
      await page.fill("#email", email);
      await page.fill("#password", "preview demo password");
      await Promise.all([page.waitForURL(/\/profile/), page.click("form button.btn-primary")]);
      await page.check('input[name="personas"][value="employee_jobseeker"]');
      await page.check('input[name="personas"][value="household"]');
      if (vp === "desktop" && lang === "el") await shoot(page, `${p}-24-onboarding-who`, null).catch(() => {});
      await page.click('[data-step="interests"]');
      await page.check('input[name="interests"][value="employment"]');
      await page.check('input[name="interests"][value="family"]');
      await page.check('input[name="industries"][value="tourism_hospitality"]');
      await page.click('[data-step="work"]').catch(() => errors.push("work step missing"));
      if (lang === "el") await shoot(page, `${p}-25-onboarding-work`, null).catch(() => {});
      await page.selectOption('select[name="employment_status"]', "unemployed").catch(() => errors.push("employment_status select missing"));
      await Promise.all([page.waitForLoadState("networkidle"), page.locator("form button.btn-primary").last().click()]);
      await shoot(page, `${p}-15-profile`, "/profile?path=politis");
      await shoot(page, `${p}-16-account-citizen`, "/politis/logariasmos");
      if (vp === "desktop") await shoot(page, `${p}-16b-account-business`, "/epixeiriseis/logariasmos");
      if (ids.a21) await shoot(page, `${p}-17-detail-logged-in`, `/politis/eukairies/${ids.a21}`);
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${out}/shots.json`, JSON.stringify({ shots, errors }, null, 2));
console.log(JSON.stringify({ shots: shots.length, errors }, null, 2));
