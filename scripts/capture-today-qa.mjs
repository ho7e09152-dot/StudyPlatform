import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputDir = process.env.CAPTURE_OUTPUT ?? "/home/roro/study_platform/artifacts/today-redesign-qa";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const page = await context.newPage();
page.setDefaultTimeout(12_000);

const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));

async function stabilize() {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}",
  });
  await page.waitForTimeout(250);
}

async function openToday() {
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "오늘 함께 공부하기" }).waitFor();
  await stabilize();
}

async function screenshot(name, fullPage = false) {
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage });
}

async function closeDialogWithEscape() {
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}

await openToday();
await screenshot("today-desktop", true);
const desktopMetrics = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  primaryButtons: Array.from(document.querySelectorAll("main .button--primary"))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((element) => element.textContent?.trim()),
}));

const changeNotice = page.locator(".today-change-notice");
if (await changeNotice.count()) {
  await changeNotice.locator("summary").click();
  await screenshot("today-desktop-change-open");
  await changeNotice.locator("summary").click();
}

await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|내 제출 보기/ }).click();
await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
await screenshot("submission-desktop");
await page.getByText("GitLab 저장 정보", { exact: true }).click();
await screenshot("submission-desktop-storage-open");
await closeDialogWithEscape();

await page.locator(".today-team-list button:not([disabled])").filter({ hasNotText: "(나)" }).first().click();
await page.getByRole("heading", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
await screenshot("pre-submit-warning-desktop");
await page.getByRole("button", { name: "내 학습 계속하기" }).click();
await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
await closeDialogWithEscape();

await page.locator(".today-team-list button:not([disabled])").filter({ hasNotText: "(나)" }).first().click();
await page.getByRole("heading", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
await page.getByRole("button", { name: "그래도 보기" }).click();
await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
await screenshot("member-review-desktop");
await page.getByText("저장소 원본 정보", { exact: true }).click();
await screenshot("member-review-storage-open");
await closeDialogWithEscape();

await page.setViewportSize({ width: 390, height: 844 });
await openToday();
await screenshot("today-mobile", true);
const mobileMetrics = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  primaryButtons: Array.from(document.querySelectorAll("main .button--primary"))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .map((element) => element.textContent?.trim()),
}));

await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|내 제출 보기/ }).click();
await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
await screenshot("submission-mobile");
const mobileDialogMetrics = await page.getByRole("dialog").evaluate((dialog) => {
  const rect = dialog.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    selectorVisible: Boolean(dialog.querySelector(".submission-mobile-selector"))
      && getComputedStyle(dialog.querySelector(".submission-mobile-selector")).display !== "none",
  };
});
await closeDialogWithEscape();

await fs.writeFile(
  path.join(outputDir, "browser-results.json"),
  JSON.stringify({
    baseURL,
    capturedAt: new Date().toISOString(),
    desktopMetrics,
    mobileMetrics,
    mobileDialogMetrics,
    consoleErrors,
    pageErrors,
  }, null, 2),
);

await browser.close();
