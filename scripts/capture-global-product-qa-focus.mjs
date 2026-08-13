import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/global-product-qa/rendered");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["mobile", { width: 390, height: 844 }],
];

const browser = await chromium.launch({ headless: true, executablePath });

async function warmImages(page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(500);
}

for (const [name, viewport] of viewports) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await warmImages(page);
  await page.screenshot({ path: path.join(outputRoot, name, "01-landing.png"), fullPage: true });
  await context.close();
}

for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  await page.goto(`${baseURL}/library/sessions/2026-07-23`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
  await page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
  await page.screenshot({ path: path.join(outputRoot, name, name === "desktop" ? "31-pre-submission-warning.png" : "31-pre-submission-warning-sheet.png"), fullPage: true });
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outputRoot, "focus-capture.txt"), "Landing images warmed; shared pre-submission warning captured.\n");
