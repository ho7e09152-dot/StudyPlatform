import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/records-responsive-qa");
const executablePath = process.env.CHROMIUM_PATH;
const widths = [1600, 1440, 1366, 1280, 1180, 1100, 1024, 961, 900, 821, 768, 390];

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const results = [];

for (const width of widths) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/records`, { waitUntil: "networkidle" });

  const metrics = await page.evaluate(() => {
    const selectors = [
      ".app-main",
      ".records-workspace",
      ".records-controls",
      ".records-summary-grid",
      ".records-weekly-layout",
      ".records-weekly-chart",
      ".records-team-status",
    ];
    const boxes = Object.fromEntries(selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return [selector, null];
      const rect = element.getBoundingClientRect();
      return [selector, {
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        scrollWidth: element.scrollWidth,
      }];
    }));
    const overflowing = [...document.querySelectorAll("body *")]
      .filter((element) => element instanceof HTMLElement)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, rect };
      })
      .filter(({ rect }) => rect.right > innerWidth + 1 || rect.left < -1)
      .slice(0, 12)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      }));
    return {
      viewportWidth: innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      boxes,
      overflowing,
    };
  });

  if ([1280, 1100, 1024, 961, 900, 821, 768, 390].includes(width)) {
    await page.screenshot({ path: path.join(outputRoot, `${width}.png`), fullPage: true });
  }
  results.push({ width, errors, ...metrics });
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outputRoot, "results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
