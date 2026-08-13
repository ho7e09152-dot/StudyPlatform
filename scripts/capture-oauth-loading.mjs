import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/oauth-loading-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";
const results = { baseURL, generatedAt: new Date().toISOString(), captures: [], consoleErrors: [], pageErrors: [] };

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function capture(name, viewport, colorScheme, reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion, locale: "ko-KR" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push({ name, text: message.text() });
  });
  page.on("pageerror", (error) => results.pageErrors.push({ name, text: error.message }));
  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ token: "capture-token", headerName: "X-CSRF-TOKEN" }),
  }));
  await page.route("**/api/v1/auth/gitlab/complete", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort().catch(() => {});
  });
  await page.goto(`${baseURL}/auth/callback`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Study-ing" }).waitFor();
  await page.getByText("로그인하고 있어요", { exact: true }).waitFor();

  const metrics = await page.evaluate(() => {
    const spinner = document.querySelector(".oauth-checking-spinner");
    const pageStyle = getComputedStyle(document.querySelector(".oauth-checking-page"));
    return {
      viewportWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      background: pageStyle.backgroundColor,
      spinnerAnimation: spinner ? getComputedStyle(spinner).animationName : null,
      hasLegacySteps: Boolean(document.querySelector(".oauth-checking-steps")),
      text: document.querySelector(".oauth-checking-surface")?.textContent?.replace(/\s+/g, " ").trim(),
    };
  });
  const file = path.join(outputRoot, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.captures.push({ name, file, colorScheme, reducedMotion, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1 });
  await context.close();
}

await capture("desktop-light", { width: 1440, height: 900 }, "light");
await capture("mobile-light", { width: 390, height: 844 }, "light");
await capture("desktop-dark", { width: 1440, height: 900 }, "dark");
await capture("desktop-reduced-motion", { width: 1440, height: 900 }, "light", "reduce");
await browser.close();

await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
