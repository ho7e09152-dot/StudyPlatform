import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputDir = process.env.CAPTURE_OUTPUT ?? path.resolve("artifacts/activity-polish-after");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const results = [];

async function inspect(viewport, label, triggerName) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}" });

  const trigger = page.locator('.activity-inbox-trigger[aria-label^="활동함 열기"]:visible').first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "활동함" });
  await dialog.waitFor();
  const bounds = await dialog.boundingBox();
  const todoCount = await dialog.getByRole("tab", { name: /해야 할 일/ }).textContent();
  const newsCount = await dialog.getByRole("tab", { name: /새 소식/ }).textContent();
  const todoShot = path.join(outputDir, `${label}-todo.png`);
  await page.screenshot({ path: todoShot });

  await dialog.getByRole("tab", { name: /새 소식/ }).click();
  const timestamps = await dialog.locator(".activity-inbox-item small").allTextContents();
  const newsShot = path.join(outputDir, `${label}-news.png`);
  await page.screenshot({ path: newsShot });

  const bodyOverflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    panelWidth: document.querySelector(".activity-inbox-panel")?.getBoundingClientRect().width ?? 0,
  }));
  await dialog.getByRole("button", { name: "활동함 닫기" }).focus();
  await page.keyboard.press("Shift+Tab");
  const trapped = await page.evaluate(() => Boolean(document.activeElement?.closest("[role=dialog]")));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  const restored = await trigger.evaluate((element) => document.activeElement === element);

  await trigger.click();
  const reopened = page.getByRole("dialog", { name: "활동함" });
  await reopened.getByRole("tab", { name: /새 소식/ }).click();
  await reopened.getByRole("link", { name: /새 리뷰가 도착했어요/ }).click();
  await page.waitForURL(/\/library\/sessions\/2026-07-23$/);
  const deepLink = new URL(page.url()).pathname;
  const postReadBadge = await page.locator('.activity-inbox-trigger[aria-label^="활동함 열기"]:visible').first().getAttribute("aria-label");
  await page.locator(".library-submission-list button:not(:disabled)").filter({ hasNotText: "(나)" }).first().click();
  const warning = page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" });
  await warning.waitFor();
  const warningPreserved = await warning.isVisible();

  results.push({ label, triggerName, bounds, todoCount, newsCount, timestamps, bodyOverflow, trapped, restored, deepLink, postReadBadge, warningPreserved, errors });
  await context.close();
}

await inspect({ width: 1440, height: 1050 }, "desktop", "sidebar");
await inspect({ width: 390, height: 844 }, "mobile", "header");

const beforePath = path.resolve("artifacts/design-system-qa/activity-inbox-v2.png");
const afterPath = path.join(outputDir, "desktop-todo.png");
const [before, after] = await Promise.all([fs.readFile(beforePath), fs.readFile(afterPath)]);
const comparisonContext = await browser.newContext({ viewport: { width: 1520, height: 690 }, deviceScaleFactor: 1 });
const comparisonPage = await comparisonContext.newPage();
await comparisonPage.setContent(`
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px; background: #f4f4f7; color: #191725; font: 14px system-ui, sans-serif; }
    main { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    figure { overflow: hidden; margin: 0; border: 1px solid #dedde6; border-radius: 12px; background: white; }
    figcaption { padding: 12px 16px; border-bottom: 1px solid #dedde6; font-weight: 700; }
    img { display: block; width: 100%; height: auto; }
  </style>
  <main>
    <figure><figcaption>변경 전</figcaption><img src="data:image/png;base64,${before.toString("base64")}" /></figure>
    <figure><figcaption>변경 후</figcaption><img src="data:image/png;base64,${after.toString("base64")}" /></figure>
  </main>
`);
await comparisonPage.screenshot({ path: path.join(outputDir, "comparison-desktop.png") });
await comparisonContext.close();
await browser.close();

await fs.writeFile(path.join(outputDir, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
