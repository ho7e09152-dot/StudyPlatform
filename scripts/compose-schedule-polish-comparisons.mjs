import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const root = path.resolve("artifacts/schedule-polish-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1520, height: 1000 }, deviceScaleFactor: 1 });

async function dataUrl(relativePath) {
  const data = await fs.readFile(path.join(root, relativePath));
  return `data:image/png;base64,${data.toString("base64")}`;
}

async function compose(filename, title, pairs) {
  const rows = [];
  for (const pair of pairs) {
    rows.push(`<section><h2>${pair.label}</h2><div><figure><figcaption>Before polish</figcaption><img src="${await dataUrl(pair.before)}"></figure><figure><figcaption>After polish</figcaption><img src="${await dataUrl(pair.after)}"></figure></div></section>`);
  }
  await page.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{width:1520px;margin:0;padding:32px;background:#e9e9ee;color:#1b1b24;font-family:Arial,"Noto Sans KR",sans-serif}header{margin-bottom:24px;padding:22px 26px;border-radius:14px;background:#1b1b24;color:#fff}h1{margin:0;font-size:26px}section{overflow:hidden;margin:0 0 24px;border:1px solid #cacbd4;border-radius:14px;background:#fff}h2{margin:0;padding:14px 18px;border-bottom:1px solid #e2e2e8;font-size:17px}section>div{display:grid;grid-template-columns:1fr 1fr;gap:1px;align-items:start;background:#cacbd4}figure{margin:0;background:#fff}figcaption{padding:10px 14px;background:#f4f4f6;color:#5f606d;font-size:12px;font-weight:700}img{display:block;width:100%;height:auto}
  </style></head><body><header><h1>${title}</h1></header>${rows.join("")}</body></html>`, { waitUntil: "load" });
  await page.screenshot({ path: path.join(root, filename), fullPage: true });
}

await compose("comparison-desktop.png", "Schedule desktop polish comparison", [
  { label: "List surface", before: "before/desktop-list.png", after: "after/desktop-list.png" },
  { label: "Create form surface and Stepper", before: "before/desktop-create.png", after: "after/desktop-create.png" },
  { label: "Detail progress hierarchy", before: "before/desktop-detail.png", after: "after/desktop-detail.png" },
]);

await compose("comparison-mobile.png", "Schedule mobile polish comparison", [
  { label: "List grouping", before: "before/mobile-list.png", after: "after/mobile-list.png" },
  { label: "Create form surface and Stepper", before: "before/mobile-create.png", after: "after/mobile-create.png" },
  { label: "Detail progress hierarchy", before: "before/mobile-detail.png", after: "after/mobile-detail.png" },
]);

await compose("comparison-focused.png", "Schedule focused state comparison", [
  { label: "Calendar emphasis", before: "before/desktop-calendar.png", after: "after/desktop-calendar.png" },
  { label: "Edit warning and Stepper", before: "before/desktop-edit.png", after: "after/desktop-edit.png" },
  { label: "Review empty state and disabled action", before: "before/desktop-team-review.png", after: "after/desktop-team-review.png" },
]);

await browser.close();
