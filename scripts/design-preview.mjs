// Design preview: screenshots of the redesigned MVP (desktop + phone, Greek + English), as a guest and as a demo user.
// Usage: node scripts/design-preview.mjs <outDir>   (app running on http://127.0.0.1:3000 with a seeded preview database)
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const out = process.argv[2] ?? "design-preview";
mkdirSync(out, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const ids = JSON.parse(process.env.PREVIEW_IDS ?? "{}"); // { a21: uuid, eu: uuid }
const shots = [];
const errors = [];

async function shoot(page, name, path, opts = {}) {
  const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
  if (opts.before) await opts.before(page);
  const file = `${name}.jpg`;
  await page.screenshot({ path: `${out}/${file}`, fullPage: opts.full !== false, type: "jpeg", quality: 82 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  shots.push({ name, path, file, status: res?.status() ?? 0, overflow });
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
    // guest screens
    await shoot(page, `${p}-01-home`, "/");
    await shoot(page, `${p}-02-opportunities`, "/opportunities");
    if (lang === "el") {
      await shoot(page, `${p}-03-category-family`, "/opportunities?cat=family");
      await shoot(page, `${p}-04-category-empty`, "/opportunities?cat=tenders");
      await shoot(page, `${p}-05-categories`, "/categories");
    }
    if (ids.a21) await shoot(page, `${p}-06-detail-greek`, `/opportunities/${ids.a21}`);
    if (lang === "el" && ids.eu) await shoot(page, `${p}-07-detail-eu`, `/opportunities/${ids.eu}`);
    if (lang === "el") {
      await shoot(page, `${p}-08-guides`, "/guides");
      await shoot(page, `${p}-09-guide`, "/guides/a21");
      await shoot(page, `${p}-10-about`, "/about");
      await shoot(page, `${p}-11-for-me-guest`, "/for-me");
      await shoot(page, `${p}-12-login`, "/login", { full: false });
      await shoot(page, `${p}-13-not-found`, "/this-page-does-not-exist", { full: false });
    }
    if (lang === "en") { await shoot(page, `${p}-08-guides`, "/guides"); await shoot(page, `${p}-09-guide`, "/guides/a21"); }
    if (lang === "el") {
      await shoot(page, `${p}-18-guides-search`, "/guides?q=" + encodeURIComponent("επιδομα") + "#results");
      await shoot(page, `${p}-19-guides-category`, "/guides?cat=housing-energy#results");
      await shoot(page, `${p}-20-guides-empty`, "/guides?cat=news-updates#results");
      await shoot(page, `${p}-21-guide-draft`, "/guides/eic");
      await shoot(page, `${p}-22-guide-explainer`, "/guides/applying-officially");
      await shoot(page, `${p}-23-guide-unemployment-draft`, "/guides/unemployment-benefit-application");
    }
    if (vp === "phone") await shoot(page, `${p}-14-menu-open`, "/", { full: false, before: async (pg) => { await pg.click("details.mobile-nav > summary"); } });
    // demo user: register, answer a few questions as "User A" (unemployed, looking for benefits), view For Me
    if (vp === "desktop" || lang === "el") {
      const email = `demo-${vp}-${lang}-${Date.now()}@preview.example`;
      await page.goto(BASE + "/register", { waitUntil: "networkidle" });
      await page.fill("#email", email);
      await page.fill("#password", "preview demo password");
      await Promise.all([page.waitForURL(/\/profile/), page.click("form button.btn-primary")]);
      await page.check('input[name="personas"][value="employee_jobseeker"]');
      await page.check('input[name="personas"][value="household"]');
      await page.check('input[name="interests"][value="employment"]');
      await page.check('input[name="interests"][value="family"]');
      await page.check('input[name="industries"][value="tourism_hospitality"]');
      await page.selectOption('select[name="employment_status"]', "unemployed").catch(() => errors.push("employment_status select missing"));
      await Promise.all([page.waitForLoadState("networkidle"), page.locator("form button.btn-primary").last().click()]);
      await shoot(page, `${p}-15-profile`, "/profile");
      await shoot(page, `${p}-16-for-me`, "/for-me");
      if (ids.a21) await shoot(page, `${p}-17-detail-logged-in`, `/opportunities/${ids.a21}`);
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${out}/shots.json`, JSON.stringify({ shots, errors }, null, 2));
console.log(JSON.stringify({ shots: shots.length, errors }, null, 2));
