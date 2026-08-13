import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputDir = process.env.CAPTURE_OUTPUT ?? path.resolve("artifacts/schedule-redesign-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const results = { baseURL, capturedAt: new Date().toISOString(), captures: [], consoleErrors: [], pageErrors: [], overflow: [], interactions: [] };

async function runViewport(name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push({ viewport: name, text: message.text() }); });
  page.on("pageerror", (error) => results.pageErrors.push({ viewport: name, text: error.message }));

  async function open(route) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}" }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
  }

  async function capture(slug, state, fullPage = true) {
    const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }));
    results.overflow.push({ viewport: name, state, ...overflow });
    const filename = `${name}-${slug}.png`;
    await page.screenshot({ path: path.join(outputDir, filename), fullPage });
    results.captures.push({ viewport: name, state, file: filename });
  }

  await open("/schedule");
  const createCta = page.getByRole("link", { name: "새 일정", exact: true });
  results.interactions.push({ viewport: name, action: "Owner schedule-create CTA visible", passed: await createCta.isVisible() });
  await capture("calendar", "Schedule Calendar");
  const longTitleTarget = name === "desktop"
    ? page.locator(".schedule-calendar__events a").first()
    : page.locator(".schedule-mobile-agenda .schedule-row__main strong").first();
  const originalCalendarTitle = await longTitleTarget.textContent();
  await longTitleTarget.evaluate((element) => { element.textContent = "긴 일정 제목이 캘린더 셀의 너비를 넘어가더라도 안전하게 줄임표로 표시되는 학습 일정"; });
  const titleLayout = await longTitleTarget.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, title: element.closest("a")?.getAttribute("title") }));
  results.interactions.push({ viewport: name, action: "Long calendar title truncation", passed: name === "desktop" ? titleLayout.scrollWidth > titleLayout.clientWidth : !titleLayout.pageOverflow, detail: titleLayout });
  await capture("calendar-long-title", "Schedule Calendar Long Title");
  await longTitleTarget.evaluate((element, title) => { element.textContent = title; }, originalCalendarTitle);
  const keyboardTarget = name === "desktop"
    ? page.locator(".schedule-calendar__events a").first()
    : page.locator(".schedule-mobile-agenda .schedule-row").first();
  await keyboardTarget.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/schedule\/\d{4}-\d{2}-\d{2}$/);
  results.interactions.push({ viewport: name, action: "Calendar event keyboard navigation", passed: true });
  await open("/schedule");
  await page.getByRole("button", { name: "목록" }).click();
  await page.getByRole("region", { name: "일정 목록" }).waitFor();
  results.interactions.push({ viewport: name, action: "Calendar/List toggle", passed: true });
  await capture("list", "Schedule List");

  await open("/schedule/new");
  await page.getByRole("heading", { name: "새 학습 일정" }).waitFor();
  results.interactions.push({ viewport: name, action: "Stepper marks current basic-information step", passed: await page.locator('.editor-progress [aria-current="step"]').getAttribute("class") === "is-active" });
  await capture("create", "Schedule Create");

  await open("/schedule/2026-07-23/edit");
  await page.getByRole("heading", { name: "학습 일정 편집" }).waitFor();
  await capture("edit", "Schedule Edit");
  await page.getByRole("button", { name: /다음 단계/ }).click();
  await page.locator("#editor-items-title").waitFor();
  const completedStep = page.locator(".editor-progress button.is-complete");
  results.interactions.push({ viewport: name, action: "Stepper distinguishes completed/current/upcoming", passed: await completedStep.count() === 1 && await page.locator('.editor-progress [aria-current="step"]').textContent().then((text) => text?.includes("학습 항목") ?? false) });
  await capture("edit-step2", "Schedule Edit Step 2");

  await open("/schedule/2026-07-23");
  await page.getByRole("heading", { name: "큐와 배열 집중 학습" }).waitFor();
  await capture("detail", "Schedule Detail");

  await page.getByRole("button", { name: "일정 관리 메뉴" }).click();
  await page.getByRole("menuitem", { name: "일정 취소" }).click();
  await page.getByRole("heading", { name: "이 일정을 취소할까요?" }).waitFor();
  results.interactions.push({ viewport: name, action: "Owner/Manager cancel confirmation", passed: true });
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  const submitButton = page.getByRole("button", { name: /학습하기|제출 보기/ }).first();
  await submitButton.click();
  await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
  results.interactions.push({ viewport: name, action: "Detail to shared Submission", passed: true });
  await capture("submission", "Submission", false);
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  const reviewTarget = page.locator(".schedule-team-progress .today-team-list button:not([disabled])").filter({ hasNotText: "(나)" }).first();
  await reviewTarget.click();
  const warning = page.getByRole("heading", { name: "아직 내 학습을 완료하지 않았어요" });
  if (await warning.count()) await page.getByRole("button", { name: "그래도 보기" }).click();
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  results.interactions.push({ viewport: name, action: "Team row to shared Review", passed: true });
  await capture("team-review", "Team Review", false);
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor({ state: "hidden" });
  results.interactions.push({ viewport: name, action: "Review closes with Escape", passed: true });

  await context.close();
}

for (const [name, viewport] of [["desktop", { width: 1440, height: 1100 }], ["mobile", { width: 390, height: 844 }]]) {
  try {
    await runViewport(name, viewport);
  } catch (error) {
    results.pageErrors.push({ viewport: name, text: error instanceof Error ? error.stack ?? error.message : String(error) });
  }
}

await fs.writeFile(path.join(outputDir, "browser-results.json"), JSON.stringify(results, null, 2));
await browser.close();

if (results.pageErrors.length || results.consoleErrors.length || results.overflow.some((entry) => entry.overflow)) {
  process.exitCode = 2;
}
