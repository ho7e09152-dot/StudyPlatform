import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = process.env.CAPTURE_OUTPUT ?? "/home/roro/study_platform/artifacts/records-redesign-qa";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];
const consoleErrors = [];
const checks = [];

async function captureSet(name, viewport) {
  const dir = path.join(outputRoot, name);
  await fs.mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${name}: ${message.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`${name}: ${error.message}`));

  async function stabilize() {
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" }).catch(() => {});
    await page.waitForTimeout(200);
  }
  async function open(route = "/records") {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await stabilize();
  }
  async function snap(slug) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, url: location.pathname + location.search }));
    if (overflow.scrollWidth > overflow.width + 1) failures.push(`${name}/${slug}: horizontal overflow ${overflow.scrollWidth} > ${overflow.width} at ${overflow.url}`);
    await page.screenshot({ path: path.join(dir, `${slug}.png`), fullPage: true });
  }

  await open();
  await page.getByRole("heading", { name: "학습 기록" }).waitFor();
  if (await page.getByText(/session\.yml|멤버 제출 파일/).count()) failures.push(`${name}: technical implementation copy is visible`);
  if (!(await page.getByText("팀 평균 완료율", { exact: true }).count())) failures.push(`${name}: team completion metric copy is missing`);
  if (!(await page.getByText("완료 항목", { exact: true }).count())) failures.push(`${name}: completed item metric copy is missing`);
  if (await page.getByText("총 제출", { exact: true }).count()) failures.push(`${name}: submission object wording remains on completed item metric`);
  if (!(await page.getByRole("button", { name: "다음 주" }).isDisabled())) failures.push(`${name}: future weekly navigation is enabled`);
  const noScheduleBar = page.locator(".records-bar-chart button.no-data").first();
  const zeroCompletionBar = page.locator('.records-bar-chart button[aria-label*="완료율 0%"]');
  if (!(await noScheduleBar.count()) || !(await zeroCompletionBar.count())) failures.push(`${name}: no schedule and 0% completion are not both represented`);
  else {
    const noScheduleLabel = await noScheduleBar.getAttribute("aria-label");
    const zeroLabel = await zeroCompletionBar.getAttribute("aria-label");
    if (!noScheduleLabel?.includes("학습 일정 없음") || !zeroLabel?.includes("완료율 0%")) failures.push(`${name}: weekly no-schedule/zero accessible labels are incomplete`);
    const selectedStyles = await zeroCompletionBar.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, border: getComputedStyle(element).borderColor }));
    if (selectedStyles.background !== "rgba(0, 0, 0, 0)" && selectedStyles.background !== "transparent") failures.push(`${name}: selected 0% chart column still has a filled background (${selectedStyles.background})`);
    if (name === "mobile") {
      const compactVisible = await noScheduleBar.locator(".records-no-data-compact").evaluate((element) => getComputedStyle(element).display !== "none");
      const fullHidden = await noScheduleBar.locator(".records-no-data-full").evaluate((element) => getComputedStyle(element).display === "none");
      if (!compactVisible || !fullHidden) failures.push(`${name}: compact no-schedule marker is not active`);
    }
    checks.push(`${name}: weekly chart distinguishes no schedule from 0% completion without a filled selected column`);
  }
  await snap("01-weekly");

  const scoreTrigger = page.locator(".records-summary-metric--interactive");
  if (await scoreTrigger.count()) {
    await scoreTrigger.click();
    await page.getByRole("heading", { name: "점수 상세" }).waitFor();
    if (!(await page.getByRole("heading", { name: "점수 구성" }).count())) failures.push(`${name}: score breakdown is missing`);
    if (!(await page.getByRole("heading", { name: "팀 점수 현황" }).count())) failures.push(`${name}: fixed ranking policy is not represented`);
    await snap("02-score-detail");
    await page.keyboard.press("Escape");
  }

  await page.getByRole("button", { name: "월간" }).click();
  if (!(await page.getByRole("button", { name: "다음 달" }).isDisabled())) failures.push(`${name}: future monthly navigation is enabled`);
  if (await page.locator(".record-detail__items, .record-detail__members").count()) failures.push(`${name}: Library content or member review detail remains in Records`);
  const zeroCalendarCell = page.locator('.records-calendar-grid button[aria-label*="완료율 0%"]');
  const noScheduleCalendarCell = page.locator(".records-calendar-grid button.no-data").first();
  if (await zeroCalendarCell.count() && await noScheduleCalendarCell.count()) {
    const zeroBackground = await zeroCalendarCell.evaluate((element) => getComputedStyle(element).backgroundColor);
    const noScheduleBackground = await noScheduleCalendarCell.evaluate((element) => getComputedStyle(element).backgroundColor);
    if (zeroBackground === noScheduleBackground) failures.push(`${name}: monthly 0% and no-schedule cells share the same background`);
    else checks.push(`${name}: monthly calendar distinguishes 0% completion from no schedule`);
  } else failures.push(`${name}: monthly 0% or no-schedule state is missing`);
  await snap("03-monthly");

  const selectedCell = page.locator(".records-calendar-grid button.has-data").first();
  if (await selectedCell.count()) {
    await selectedCell.click();
    await snap("04-calendar-selected-date");
    const libraryLink = page.getByRole("link", { name: /학습 세션 보기/ });
    if (!(await libraryLink.count())) failures.push(`${name}: selected date Library link is missing`);
    else {
      const href = await libraryLink.getAttribute("href");
      if (!href?.startsWith("/library/sessions/")) failures.push(`${name}: selected date Library link targets ${href}`);
      else checks.push(`${name}: selected date links to Library session`);
    }
  }

  const emptyCell = page.locator(".records-calendar-grid button.no-data").first();
  if (await emptyCell.count()) {
    await emptyCell.click();
    if (!(await page.getByText("이 날에는 학습 일정이 없어요.").count())) failures.push(`${name}: no-session date state is missing`);
    await snap("05-no-session-date");
  }

  await page.getByRole("button", { name: "이전 달" }).click();
  if (!(await page.getByText("이 기간에는 학습 기록이 없어요.").count())) failures.push(`${name}: empty period state is missing`);
  await snap("06-no-data-period");

  await context.close();
}

await captureSet("desktop", { width: 1440, height: 1050 });
await captureSet("mobile", { width: 390, height: 844 });
await browser.close();

const result = { generatedAt: new Date().toISOString(), baseURL, checks, failures, consoleErrors };
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length || consoleErrors.length) process.exitCode = 1;
