import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const beforeRoot = path.resolve("artifacts/information-density-audit/before");
const afterRoot = path.resolve("artifacts/information-density-audit/after");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

async function dataUrl(root, relativePath) {
  const data = await fs.readFile(path.join(root, relativePath));
  return `data:image/png;base64,${data.toString("base64")}`;
}

const comparisons = [
  ["Today", "01-today.png"],
  ["Schedule detail", "03-schedule-detail.png"],
  ["Library", "04-library.png"],
  ["Library session", "06-library-session.png"],
  ["Records", "08-records.png"],
  ["Settings repository", "12-settings-repository.png"],
];

async function compose(device) {
  const rows = await Promise.all(comparisons.map(async ([label, file]) => `
    <section>
      <h2>${label}</h2>
      <div class="pair">
        <figure><figcaption>Before</figcaption><img src="${await dataUrl(beforeRoot, `${device}/${file}`)}"></figure>
        <figure><figcaption>After</figcaption><img src="${await dataUrl(afterRoot, `${device}/${file}`)}"></figure>
      </div>
    </section>`));

  await page.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{width:1600px;margin:0;padding:28px;background:#e9e9ee;color:#1b1b24;font-family:Arial,"Noto Sans KR",sans-serif}header{margin-bottom:20px;padding:20px 24px;border-radius:14px;background:#1b1b24;color:#fff}h1{margin:0;font-size:26px}header p{margin:6px 0 0;color:#c9cad2;font-size:13px}section{overflow:hidden;margin:0 0 22px;border:1px solid #cacbd4;border-radius:14px;background:#fff}h2{margin:0;padding:13px 16px;border-bottom:1px solid #e2e2e8;font-size:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:1px;align-items:start;background:#cacbd4}figure{margin:0;background:#fff}figcaption{padding:9px 13px;background:#f4f4f6;color:#5f606d;font-size:12px;font-weight:700}img{display:block;width:100%;height:auto}
  </style></head><body><header><h1>Study-ing information density audit · ${device}</h1><p>동일 viewport와 demo state에서 비교</p></header>${rows.join("")}</body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: path.join(afterRoot, `comparison-${device}.png`), fullPage: true });
}

await compose("desktop");
await compose("mobile");
await browser.close();
