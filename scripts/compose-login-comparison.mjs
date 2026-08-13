import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const outputRoot = path.resolve("artifacts/login-redesign-qa");
const comparisons = [
  {
    name: "comparison-desktop.png",
    width: 1500,
    images: [
      ["변경 전", "artifacts/auth-flow-captures-20260812/desktop/01-login-default.png"],
      ["변경 후", "artifacts/login-redesign-qa/desktop/01-default-login.png"],
    ],
  },
  {
    name: "comparison-mobile.png",
    width: 900,
    images: [
      ["변경 전", "artifacts/auth-flow-captures-20260812/mobile/01-login-default.png"],
      ["변경 후", "artifacts/login-redesign-qa/mobile/01-default-login.png"],
    ],
  },
];

const browser = await chromium.launch({ headless: true, executablePath });
for (const comparison of comparisons) {
  const page = await browser.newPage({ viewport: { width: comparison.width, height: 900 } });
  const images = await Promise.all(comparison.images.map(async ([label, file]) => ({
    label,
    data: (await fs.readFile(path.resolve(file))).toString("base64"),
  })));
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f4f6;color:#1b1b24;font:14px system-ui,sans-serif}
      h1{margin:0 0 18px;font-size:22px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;align-items:start}
      figure{margin:0;overflow:hidden;border:1px solid #dedee5;border-radius:12px;background:white}figcaption{padding:10px 14px;border-bottom:1px solid #dedee5;font-weight:750}img{display:block;width:100%;height:auto}
    </style>
    <h1>Study-ing Login — 변경 전 / 변경 후</h1>
    <div class="grid">${images.map(({ label, data }) => `<figure><figcaption>${label}</figcaption><img src="data:image/png;base64,${data}" /></figure>`).join("")}</div>
  `);
  await page.screenshot({ path: path.join(outputRoot, comparison.name), fullPage: true });
  await page.close();
}
await browser.close();
