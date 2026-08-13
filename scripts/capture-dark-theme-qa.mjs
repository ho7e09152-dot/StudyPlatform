import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/dark-theme-qa/after");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];
const routes = [
  ["settings", "/settings/appearance"],
  ["today", "/today"],
  ["records", "/records"],
];
const results = {
  baseURL,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
};

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });

for (const [viewportName, viewport] of viewports) {
  const folder = path.join(outputRoot, viewportName);
  await fs.mkdir(folder, { recursive: true });
  const context = await browser.newContext({
    viewport,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    colorScheme: "dark",
  });
  for (const [name, route] of routes) {
    process.stdout.write(`Capturing ${viewportName} ${route}\n`);
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
        results.consoleErrors.push({ viewport: viewportName, route, message: message.text() });
      }
    });
    page.on("pageerror", (error) => results.pageErrors.push({ viewport: viewportName, route, message: error.message }));

    await page.goto(`${baseURL}/settings/appearance`, { waitUntil: "networkidle", timeout: 45_000 });
    const darkTheme = page.getByRole("radio", { name: "다크" });
    if ((await darkTheme.getAttribute("aria-checked")) !== "true") await darkTheme.click();
    if (route !== "/settings/appearance") {
      await page.evaluate((nextRoute) => {
        const link = document.querySelector(`a[href="${nextRoute}"]`);
        if (!(link instanceof HTMLAnchorElement)) throw new Error(`Navigation link not found: ${nextRoute}`);
        link.click();
      }, route);
      await page.waitForURL(`**${route}`);
      await page.waitForLoadState("networkidle");
    }
    await page.evaluate(() => {
      const frame = document.querySelector(".app-frame");
      if (!(frame instanceof HTMLElement)) throw new Error("App frame not found");
      frame.dataset.theme = "dark";
      frame.dataset.accent = "purple";
    });
    await page.locator('.app-frame[data-theme="dark"]').waitFor({ timeout: 15_000 });
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}",
    });
    await page.waitForTimeout(150);

    const metrics = await page.evaluate(() => {
      const frame = document.querySelector(".app-frame");
      const sidebar = document.querySelector(".sidebar");
      const surface = document.querySelector(".surface, .records-panel, .repository-status-surface");
      const styles = (element) => element ? getComputedStyle(element) : null;
      return {
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        frameBackground: styles(frame)?.backgroundColor ?? null,
        sidebarBackground: styles(sidebar)?.backgroundColor ?? null,
        surfaceBackground: styles(surface)?.backgroundColor ?? null,
      };
    });
    const file = path.join(folder, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    results.screenshots.push({
      viewport: viewportName,
      route,
      file,
      ...metrics,
      horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1,
    });
    await page.close();
  }
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
