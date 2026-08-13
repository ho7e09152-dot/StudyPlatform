import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const root = path.resolve(process.env.QA_ROOT ?? "artifacts/global-product-qa/source");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });

for (const viewport of ["desktop", "tablet", "mobile"]) {
  const files = (await fs.readdir(path.join(root, viewport))).filter((file) => file.endsWith(".png")).sort();
  const data = await Promise.all(files.map(async (file) => ({ file, image: (await fs.readFile(path.join(root, viewport, file))).toString("base64") })));
  const page = await browser.newPage({ viewport: { width: viewport === "mobile" ? 1000 : 1500, height: 1000 } });
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#ececf0;color:#1b1b24;font:13px system-ui,sans-serif}h1{margin:0 0 18px;font-size:22px}.grid{display:grid;grid-template-columns:repeat(${viewport === "mobile" ? 4 : 3},minmax(0,1fr));gap:16px;align-items:start}figure{margin:0;overflow:hidden;border:1px solid #cacbd4;border-radius:10px;background:white}figcaption{padding:9px 12px;border-bottom:1px solid #e2e2e8;font-weight:750}img{display:block;width:100%;height:${viewport === "mobile" ? 460 : 330}px;object-fit:cover;object-position:top}
    </style>
    <h1>Study-ing Global QA — ${viewport}</h1><div class="grid">${data.map(({ file, image }) => `<figure><figcaption>${file}</figcaption><img src="data:image/png;base64,${image}" /></figure>`).join("")}</div>
  `);
  await page.screenshot({ path: path.join(root, `contact-sheet-${viewport}.png`), fullPage: true });
  await page.close();
}
await browser.close();
