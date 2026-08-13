import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const root = path.resolve("artifacts/landing-redesign-qa");
const pairs = [
  ["comparison-desktop-landing.png", 1600, "source/desktop/02-full-landing.png", "rendered/desktop/02-full-landing.png", "Desktop Landing"],
  ["comparison-mobile-landing.png", 900, "source/mobile/02-full-landing.png", "rendered/mobile/02-full-landing.png", "Mobile Landing"],
  ["comparison-desktop-legal.png", 1600, "source/desktop/05-terms.png", "rendered/desktop/05-terms.png", "Desktop Terms"],
  ["comparison-mobile-legal.png", 900, "source/mobile/06-privacy.png", "rendered/mobile/06-privacy.png", "Mobile Privacy"],
];

const browser = await chromium.launch({ headless: true, executablePath });
for (const [name, width, beforeFile, afterFile, title] of pairs) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const images = await Promise.all([beforeFile, afterFile].map(async (file) => (await fs.readFile(path.join(root, file))).toString("base64")));
  await page.setContent(`
    <style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f4f6;color:#1b1b24;font:14px system-ui,sans-serif}h1{margin:0 0 18px;font-size:22px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}figure{margin:0;overflow:hidden;border:1px solid #dedee5;border-radius:12px;background:white}figcaption{padding:10px 14px;border-bottom:1px solid #dedee5;font-weight:750}img{display:block;width:100%;height:auto}</style>
    <h1>Study-ing ${title} — 변경 전 / 변경 후</h1><div class="grid"><figure><figcaption>변경 전</figcaption><img src="data:image/png;base64,${images[0]}" /></figure><figure><figcaption>변경 후</figcaption><img src="data:image/png;base64,${images[1]}" /></figure></div>
  `);
  await page.screenshot({ path: path.join(root, name), fullPage: true });
  await page.close();
}
await browser.close();
