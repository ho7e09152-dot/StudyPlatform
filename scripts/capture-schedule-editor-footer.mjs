import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/schedule-editor-footer-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const results = { baseURL, captures: [], consoleErrors: [], pageErrors: [] };

for (const [name, viewport] of viewports) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push({ viewport: name, text: message.text() });
  });
  page.on("pageerror", (error) => results.pageErrors.push({ viewport: name, text: error.message }));

  await page.goto(`${baseURL}/schedule/2026-07-23/edit`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByRole("button", { name: /다음 단계/ }).click();
  await page.locator("#editor-items-title").waitFor();

  const headingMetrics = await page.locator(".editor-items__heading > .editor-step__heading").evaluate((heading) => {
    const icon = heading.querySelector(":scope > span");
    const copy = heading.querySelector(":scope > div");
    if (!(icon instanceof HTMLElement) || !(copy instanceof HTMLElement)) throw new Error("Item heading not found");
    const iconRect = icon.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    return {
      flexDirection: getComputedStyle(heading).flexDirection,
      horizontalGap: Math.round(copyRect.left - iconRect.right),
      centerDelta: Math.round(Math.abs(
        (iconRect.top + iconRect.bottom) / 2 - (copyRect.top + copyRect.bottom) / 2,
      )),
    };
  });
  const headingFile = path.join(outputRoot, `${name}-heading.png`);
  await page.screenshot({ path: headingFile });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);

  const metrics = await page.evaluate(() => {
    const footer = document.querySelector(".schedule-editor-page .session-editor__footer");
    const main = document.querySelector(".app-main");
    if (!(footer instanceof HTMLElement) || !(main instanceof HTMLElement)) throw new Error("Schedule editor footer not found");
    const footerRect = footer.getBoundingClientRect();
    return {
      viewportHeight: innerHeight,
      footerTop: footerRect.top,
      footerBottom: footerRect.bottom,
      bottomGap: Math.round(innerHeight - footerRect.bottom),
      mainPaddingBottom: getComputedStyle(main).paddingBottom,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  const bottomFile = path.join(outputRoot, `${name}-bottom.png`);
  await page.screenshot({ path: bottomFile });
  results.captures.push({ viewport: name, headingFile, bottomFile, headingMetrics, ...metrics });
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
