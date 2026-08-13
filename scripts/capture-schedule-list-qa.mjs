import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/schedule-list-redesign/after");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];
const themes = ["light", "dark"];

const results = {
  baseURL,
  generatedAt: new Date().toISOString(),
  captures: [],
  checks: [],
  consoleErrors: [],
  pageErrors: [],
};

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function openList(page, theme) {
  await page.goto(`${baseURL}/schedule`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.getByRole("button", { name: "목록" }).click();
  await page.getByRole("region", { name: "일정 목록" }).waitFor();
  await page.locator(".app-frame").evaluate((frame, nextTheme) => {
    frame.setAttribute("data-theme", nextTheme);
    frame.setAttribute("data-accent", "purple");
  }, theme);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}",
  });
  await page.waitForTimeout(120);
}

async function save(page, viewportName, theme, state) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    groupCount: document.querySelectorAll(".schedule-date-group").length,
    rowCount: document.querySelectorAll(".schedule-list-row").length,
  }));
  const folder = path.join(outputRoot, `${viewportName}-${theme}`);
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, `${state}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.captures.push({
    viewport: viewportName,
    theme,
    state,
    file,
    ...metrics,
    horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1,
  });
}

for (const [viewportName, viewport] of viewports) {
  for (const theme of themes) {
    const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: theme });
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") results.consoleErrors.push({ viewport: viewportName, theme, text: message.text() });
    });
    page.on("pageerror", (error) => results.pageErrors.push({ viewport: viewportName, theme, text: error.message }));

    await openList(page, theme);
    await save(page, viewportName, theme, "default");

    const firstRow = page.locator(".schedule-list-row").first();
    const title = firstRow.locator(".schedule-list-row__primary > strong");
    const originalTitle = await title.textContent();
    await title.evaluate((element) => {
      element.textContent = "긴 일정 제목이 여러 줄로 이어져도 진행 상태와 상세 이동 영역을 침범하지 않는 학습 일정";
    });
    const longTitleCheck = await firstRow.evaluate((element) => ({
      rowWidth: element.getBoundingClientRect().width,
      titleWidth: element.querySelector(".schedule-list-row__primary > strong")?.getBoundingClientRect().width ?? 0,
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    results.checks.push({ viewport: viewportName, theme, check: "long-title", passed: !longTitleCheck.pageOverflow, detail: longTitleCheck });
    await save(page, viewportName, theme, "long-title");
    await title.evaluate((element, value) => { element.textContent = value; }, originalTitle);

    if (viewportName === "desktop") {
      const restingBackground = await firstRow.evaluate((element) => getComputedStyle(element).backgroundColor);
      await firstRow.hover();
      const hoverBackground = await firstRow.evaluate((element) => getComputedStyle(element).backgroundColor);
      results.checks.push({ viewport: viewportName, theme, check: "hover", passed: hoverBackground !== restingBackground, detail: { restingBackground, hoverBackground } });
      await save(page, viewportName, theme, "hover");

      await page.mouse.down();
      const activeBackground = await firstRow.evaluate((element) => getComputedStyle(element).backgroundColor);
      results.checks.push({ viewport: viewportName, theme, check: "active", passed: activeBackground !== hoverBackground, detail: { hoverBackground, activeBackground } });
      await save(page, viewportName, theme, "active");
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }

    await firstRow.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    const focusCheck = await firstRow.evaluate((element) => ({
      focused: document.activeElement === element,
      outlineStyle: getComputedStyle(element).outlineStyle,
      outlineWidth: getComputedStyle(element).outlineWidth,
    }));
    results.checks.push({ viewport: viewportName, theme, check: "keyboard-focus", passed: focusCheck.focused && focusCheck.outlineStyle !== "none", detail: focusCheck });
    await save(page, viewportName, theme, "focus");

    await page.evaluate(() => {
      const list = document.querySelector(".schedule-date-group > div");
      const source = list?.querySelector(".schedule-list-row");
      if (!(list instanceof HTMLElement) || !(source instanceof HTMLElement)) return;
      for (const [index, label] of ["추가 학습 일정", "상태와 메타데이터가 함께 있는 두 번째 일정"].entries()) {
        const clone = source.cloneNode(true);
        if (!(clone instanceof HTMLElement)) continue;
        clone.removeAttribute("title");
        clone.setAttribute("href", `#layout-test-${index}`);
        const cloneTitle = clone.querySelector(".schedule-list-row__primary > strong");
        if (cloneTitle) cloneTitle.textContent = label;
        list.append(clone);
      }
      window.scrollTo(0, 0);
    });
    await save(page, viewportName, theme, "multiple-rows");

    await context.close();
  }
}

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));

const failed = results.captures.some((capture) => capture.horizontalOverflow)
  || results.checks.some((check) => !check.passed)
  || results.consoleErrors.length
  || results.pageErrors.length;

process.stdout.write(`${JSON.stringify({
  captures: results.captures.length,
  failedChecks: results.checks.filter((check) => !check.passed),
  overflow: results.captures.filter((capture) => capture.horizontalOverflow),
  consoleErrors: results.consoleErrors,
  pageErrors: results.pageErrors,
}, null, 2)}\n`);

if (failed) process.exitCode = 2;
