import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const root = path.resolve("artifacts/global-product-qa");
const output = path.join(root, "comparisons");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

const comparisons = [
  ["terms-desktop", "desktop", "03-terms.png"],
  ["privacy-desktop", "desktop", "04-privacy.png"],
  ["settings-repository-desktop", "desktop", "21-settings-repository.png"],
  ["not-found-desktop", "desktop", "27-not-found.png"],
  ["terms-mobile", "mobile", "03-terms.png"],
  ["privacy-mobile", "mobile", "04-privacy.png"],
  ["settings-repository-mobile", "mobile", "21-settings-repository.png"],
  ["not-found-mobile", "mobile", "27-not-found.png"],
];

for (const [name, viewport, file] of comparisons) {
  const before = (await fs.readFile(path.join(root, "source", viewport, file))).toString("base64");
  const after = (await fs.readFile(path.join(root, "rendered", viewport, file))).toString("base64");
  const mobile = viewport === "mobile";
  const page = await browser.newPage({ viewport: { width: mobile ? 860 : 1500, height: 920 } });
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;padding:20px;background:#ececf0;color:#1b1b24;font:14px system-ui,sans-serif}
      h1{margin:0 0 14px;font-size:20px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
      figure{margin:0;overflow:hidden;border:1px solid #cacbd4;border-radius:10px;background:white}
      figcaption{padding:10px 12px;border-bottom:1px solid #e2e2e8;font-weight:750}
      img{display:block;width:100%;height:${mobile ? 844 : 820}px;object-fit:cover;object-position:top}
    </style>
    <h1>Study-ing Global QA — ${name}</h1>
    <div class="compare">
      <figure><figcaption>수정 전</figcaption><img src="data:image/png;base64,${before}" /></figure>
      <figure><figcaption>수정 후</figcaption><img src="data:image/png;base64,${after}" /></figure>
    </div>
  `);
  await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
  await page.close();
}

await browser.close();
