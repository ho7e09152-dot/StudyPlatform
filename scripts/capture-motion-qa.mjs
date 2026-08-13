import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/motion-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";
const results = { baseURL, generatedAt: new Date().toISOString(), captures: [], transitions: [], consoleErrors: [], pageErrors: [] };

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

function monitor(page, viewport) {
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push({ viewport, text: message.text() });
  });
  page.on("pageerror", (error) => results.pageErrors.push({ viewport, text: error.message }));
}

async function capture(page, viewport, name, fullPage = false) {
  const folder = path.join(outputRoot, viewport);
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, `${name}.png`);
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    route: location.pathname,
  }));
  await page.screenshot({ path: file, fullPage });
  results.captures.push({ viewport, name, file, ...layout, horizontalOverflow: layout.scrollWidth > layout.width + 1 });
}

async function readMotion(page, viewport, name, selector) {
  const value = await page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationTimingFunction: style.animationTimingFunction,
      transform: style.transform,
      opacity: style.opacity,
    };
  });
  results.transitions.push({ viewport, name, selector, ...value });
}

async function runDesktop() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    recordVideo: { dir: path.join(outputRoot, "video"), size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  monitor(page, "desktop");
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await capture(page, "desktop", "01-today-settled");

  await page.getByRole("link", { name: "일정", exact: true }).click();
  await page.waitForTimeout(60);
  await readMotion(page, "desktop", "route-enter", ".motion-page");
  await capture(page, "desktop", "02-route-enter");
  await page.waitForTimeout(220);
  await capture(page, "desktop", "03-schedule-settled");

  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await page.waitForTimeout(60);
  await readMotion(page, "desktop", "modal-enter", ".modal-panel");
  await capture(page, "desktop", "04-modal-enter");
  await page.waitForTimeout(180);
  await capture(page, "desktop", "05-modal-settled");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.waitForTimeout(45);
  await readMotion(page, "desktop", "modal-exit", ".modal-panel");
  await capture(page, "desktop", "06-modal-exit");
  await page.waitForTimeout(170);

  await page.getByRole("button", { name: /활동함 열기/ }).click();
  await page.waitForTimeout(70);
  await readMotion(page, "desktop", "drawer-enter", ".activity-inbox-panel");
  await capture(page, "desktop", "07-drawer-enter");
  await page.waitForTimeout(240);
  await page.getByRole("tab", { name: "소식" }).click();
  await page.waitForTimeout(45);
  await capture(page, "desktop", "08-tab-transition");
  await page.getByRole("dialog", { name: "활동함" }).getByRole("button", { name: "활동함 닫기" }).click();
  await page.waitForTimeout(55);
  await readMotion(page, "desktop", "drawer-exit", ".activity-inbox-panel");
  await capture(page, "desktop", "09-drawer-exit");
  await page.waitForTimeout(220);

  await page.locator(".workspace-picker__button").click();
  await page.waitForTimeout(45);
  await readMotion(page, "desktop", "workspace-menu", ".workspace-menu");
  await capture(page, "desktop", "10-workspace-menu");
  await page.keyboard.press("Escape");

  await page.goto(`${baseURL}/settings/appearance`, { waitUntil: "networkidle" });
  await page.getByRole("radio", { name: "다크" }).click();
  await page.waitForTimeout(80);
  await capture(page, "desktop", "11-theme-transition");
  await page.waitForTimeout(180);
  await capture(page, "desktop", "12-settings-dark-settled", true);
  await page.close();
  await context.close();
}

async function runMobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    recordVideo: { dir: path.join(outputRoot, "video"), size: { width: 390, height: 844 } },
  });
  const page = await context.newPage();
  monitor(page, "mobile");
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await page.waitForTimeout(65);
  await readMotion(page, "mobile", "mobile-nav-enter", ".mobile-drawer");
  await capture(page, "mobile", "01-mobile-nav-enter");
  await page.getByRole("navigation", { name: "모바일 주요 메뉴" }).getByRole("button", { name: "메뉴 닫기" }).click();
  await page.waitForTimeout(55);
  await readMotion(page, "mobile", "mobile-nav-exit", ".mobile-drawer");
  await capture(page, "mobile", "02-mobile-nav-exit");
  await page.waitForTimeout(220);

  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await page.waitForTimeout(65);
  await readMotion(page, "mobile", "mobile-sheet-enter", ".modal-panel");
  await capture(page, "mobile", "03-mobile-sheet-enter");
  await page.waitForTimeout(220);
  await capture(page, "mobile", "04-mobile-sheet-settled");
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.waitForTimeout(180);

  await page.getByRole("button", { name: /활동함 열기/ }).click();
  await page.waitForTimeout(65);
  await capture(page, "mobile", "05-mobile-activity-enter");
  await page.waitForTimeout(240);
  await capture(page, "mobile", "06-mobile-activity-settled");
  await page.close();
  await context.close();
}

async function runReducedMotion() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  monitor(page, "reduced-motion");
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await readMotion(page, "reduced-motion", "route", ".motion-page");
  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await readMotion(page, "reduced-motion", "modal", ".modal-panel");
  await page.close();
  await context.close();
}

await runDesktop();
await runMobile();
await runReducedMotion();
await browser.close();

await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify({
  captures: results.captures.length,
  videos: 2,
  overflow: results.captures.filter((capture) => capture.horizontalOverflow),
  consoleErrors: results.consoleErrors,
  pageErrors: results.pageErrors,
  transitions: results.transitions,
}, null, 2)}\n`);
