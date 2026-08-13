import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/login-redesign-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const results = { baseURL, generatedAt: new Date().toISOString(), captures: [], checks: [], consoleErrors: [], pageErrors: [] };

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outputRoot, "desktop"), { recursive: true });
await fs.mkdir(path.join(outputRoot, "mobile"), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });

async function captureSet(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push({ folder, text: message.text() });
  });
  page.on("pageerror", (error) => results.pageErrors.push({ folder, text: error.message }));

  async function snap(route, filename, expectedHeading) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: expectedHeading }).waitFor();
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" });
    await page.evaluate(() => window.scrollTo(0, 0));
    const dimensions = await page.evaluate(() => ({
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      primaryTop: document.querySelector(".auth-provider-button")?.getBoundingClientRect().top ?? null,
      primaryBottom: document.querySelector(".auth-provider-button")?.getBoundingClientRect().bottom ?? null,
    }));
    const file = path.join(outputRoot, folder, filename);
    await page.screenshot({ path: file, fullPage: true });
    results.captures.push({ folder, route, file, dimensions });
    results.checks.push({
      folder,
      route,
      horizontalOverflow: dimensions.scrollWidth > dimensions.viewportWidth + 1,
      loginActionInFirstViewport: dimensions.primaryBottom === null || dimensions.primaryBottom <= dimensions.viewportHeight,
    });
  }

  await snap("/login", "01-default-login.png", "Study-ing 시작하기");
  await snap("/login?oauthError=session_expired", "02-session-expired.png", "Study-ing 시작하기");
  await snap("/login?oauthError=reconnect_required", "03-reconnect-required.png", "Study-ing 시작하기");
  await snap("/login?oauthError=access_denied", "04-oauth-cancelled.png", "Study-ing 시작하기");
  await snap("/login?oauthError=oauth_failed", "05-oauth-failure.png", "Study-ing 시작하기");

  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "capture-token", headerName: "X-CSRF-TOKEN" }) }));
  await page.route("**/api/v1/auth/gitlab/complete", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort();
  });
  await page.goto(`${baseURL}/auth/callback`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Study-ing" }).waitFor();
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}" });
  const checkingFile = path.join(outputRoot, folder, "06-oauth-checking.png");
  await page.screenshot({ path: checkingFile, fullPage: true });
  const checkingDimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  results.captures.push({ folder, route: "/auth/callback", file: checkingFile, dimensions: checkingDimensions });
  results.checks.push({ folder, route: "/auth/callback", horizontalOverflow: checkingDimensions.scrollWidth > checkingDimensions.viewportWidth + 1 });

  const keyboardPage = await context.newPage();
  await keyboardPage.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  await keyboardPage.keyboard.press("Tab");
  const firstFocus = await keyboardPage.evaluate(() => document.activeElement?.textContent?.trim());
  await keyboardPage.keyboard.press("Tab");
  const secondFocus = await keyboardPage.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent?.trim());
  results.checks.push({ folder, keyboard: { firstFocus, secondFocus } });
  await context.close();
}

await captureSet("desktop", { width: 1440, height: 1050 });
await captureSet("mobile", { width: 390, height: 844 });
await browser.close();

await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
