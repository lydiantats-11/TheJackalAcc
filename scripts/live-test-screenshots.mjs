// Screenshots for live-test step 6: the Ευκαιρίες list and one EU record. Usage: node scripts/live-test-screenshots.mjs <outDir> <opportunityId>
import { chromium } from "playwright";

const [out, id] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 }, locale: "el-GR" });
await page.goto("http://127.0.0.1:3000/opportunities", { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}/screenshot-1-opportunities.png`, fullPage: false });
await page.goto(`http://127.0.0.1:3000/opportunities/${id}`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${out}/screenshot-2-eu-record.png`, fullPage: true });
await browser.close();
console.log("screenshots saved");
