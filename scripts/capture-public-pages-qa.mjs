import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/landing-redesign-qa/rendered");
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

  async function snapPage(route, filename, heading) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: heading }).waitFor();
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" });
    const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
    const file = path.join(outputRoot, folder, filename);
    await page.screenshot({ path: file, fullPage: true });
    results.captures.push({ folder, route, file, dimensions });
    results.checks.push({ folder, route, horizontalOverflow: dimensions.scrollWidth > dimensions.viewportWidth + 1 });
  }

  async function snapSection(selector, filename) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    const file = path.join(outputRoot, folder, filename);
    await target.screenshot({ path: file });
    results.captures.push({ folder, selector, file });
  }

  await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}.public-header{position:relative!important}" });
  const heroCta = page.getByRole("link", { name: "GitLab로 시작하기" }).first();
  const heroBox = await heroCta.boundingBox();
  const landingDimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, viewportHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }));
  const fullFile = path.join(outputRoot, folder, "02-full-landing.png");
  await page.screenshot({ path: fullFile, fullPage: true });
  results.captures.push({ folder, route: "/", file: fullFile, dimensions: landingDimensions });
  results.checks.push({ folder, route: "/", horizontalOverflow: landingDimensions.scrollWidth > landingDimensions.viewportWidth + 1, heroCtaInFirstViewport: !!heroBox && heroBox.y + heroBox.height <= viewport.height });
  await snapSection(".public-hero", "01-landing-hero.png");
  await snapSection("#product-showcase", "03-product-showcase.png");
  await snapSection(".public-final-cta", "04-final-cta.png");

  await snapPage("/terms", "05-terms.png", "이용약관");
  await snapPage("/privacy", "06-privacy.png", "개인정보 처리 안내");
  await context.close();
}

await captureSet("desktop", { width: 1440, height: 1050 });
await captureSet("mobile", { width: 390, height: 844 });
await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
