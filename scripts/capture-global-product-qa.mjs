import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/global-product-qa/source");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["tablet", { width: 768, height: 1024 }],
  ["mobile", { width: 390, height: 844 }],
];
const routes = [
  ["01-landing", "/"],
  ["02-login", "/login"],
  ["02a-auth-callback", "/auth/callback"],
  ["02b-onboarding-profile", "/onboarding/profile"],
  ["03-terms", "/terms"],
  ["04-privacy", "/privacy"],
  ["05-workspaces", "/workspaces"],
  ["06-workspace-new", "/workspaces/new"],
  ["07-today", "/today"],
  ["08-schedule", "/schedule"],
  ["09-schedule-detail", "/schedule/2026-07-23"],
  ["10-schedule-edit", "/schedule/2026-07-23/edit"],
  ["11-schedule-new", "/schedule/new"],
  ["12-records", "/records"],
  ["13-library-sessions", "/library"],
  ["14-library-documents", "/library?tab=documents"],
  ["15-library-session", "/library/sessions/2026-07-23"],
  ["16-document-detail", "/library/docs/demo-doc-os"],
  ["17-document-edit", "/library/docs/demo-doc-os/edit"],
  ["18-document-new", "/library/docs/new"],
  ["19-settings-general", "/settings/general"],
  ["20-settings-members", "/settings/members"],
  ["21-settings-repository", "/settings/repository"],
  ["22-settings-profile", "/settings/profile"],
  ["23-settings-accounts", "/settings/accounts"],
  ["24-settings-data", "/settings/data"],
  ["25-settings-migration", "/settings/data/migrate"],
  ["26-settings-danger", "/settings/danger"],
  ["27-not-found", "/definitely-not-a-study-route"],
];

const results = { baseURL, generatedAt: new Date().toISOString(), pages: [], states: [], consoleErrors: [], pageErrors: [] };
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function routeDemoOnlyApis(page) {
  await page.route("**/api/v1/workspaces/deleted", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/v1/gitlab/projects?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
    { id: 3101, name: "Study Platform", pathWithNamespace: "ssafy/study-platform", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/study-platform", visibility: "private", accessLevel: 40 },
    { id: 3104, name: "New Study Repository", pathWithNamespace: "ssafy/new-study", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/new-study", visibility: "public", accessLevel: 30 },
  ]) }));
  await page.route("**/api/v1/workspaces/*/repository-schema/migration", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ready: true,
    treeFingerprint: "global-qa-preview",
    sessionFiles: 4,
    submissionFiles: 9,
    totalMoves: 13,
    moves: [
      { sourcePath: "260723/session.yml", targetPath: ".study-workspace/sessions/2026/2026-07-23/session.yml", type: "SESSION" },
      { sourcePath: "260723/member-a.md", targetPath: ".study-workspace/sessions/2026/2026-07-23/submissions/member-a.md", type: "SUBMISSION" },
    ],
    blockers: [],
  }) }));
}

async function warmPageImages(page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
  await page.waitForTimeout(500);
}

for (const [viewportName, viewport] of viewports) {
  const folder = path.join(outputRoot, viewportName);
  await fs.mkdir(folder, { recursive: true });
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  for (const [name, route] of routes) {
    const page = await context.newPage();
    await routeDemoOnlyApis(page);
    page.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push({ viewport: viewportName, route, text: message.text() }); });
    page.on("pageerror", (error) => results.pageErrors.push({ viewport: viewportName, route, text: error.message }));
    try {
      await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30000 });
      if (route === "/") await warmPageImages(page);
      await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" });
      await page.waitForTimeout(100);
      const metrics = await page.evaluate(() => ({
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        title: document.title,
        h1: Array.from(document.querySelectorAll("h1")).map((node) => node.textContent?.trim()),
      }));
      const file = path.join(folder, `${name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.pages.push({ viewport: viewportName, route, finalUrl: page.url(), file, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1 });
    } catch (error) {
      results.pages.push({ viewport: viewportName, route, finalUrl: page.url(), error: error instanceof Error ? error.message : String(error) });
    } finally {
      await page.close();
    }
  }
  await context.close();
}

async function captureState(viewportName, viewport, name, route, action) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  await routeDemoOnlyApis(page);
  page.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push({ viewport: viewportName, route, state: name, text: message.text() }); });
  page.on("pageerror", (error) => results.pageErrors.push({ viewport: viewportName, route, state: name, text: error.message }));
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await action(page);
  await page.waitForTimeout(100);
  const file = path.join(outputRoot, viewportName, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const metrics = await page.evaluate(() => ({ viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  results.states.push({ viewport: viewportName, route, file, horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1 });
  await context.close();
}

await captureState("desktop", { width: 1440, height: 900 }, "28-activity-drawer", "/today", async (page) => {
  await page.getByRole("button", { name: /활동함 열기/ }).click();
  await page.getByRole("dialog", { name: "활동함" }).waitFor();
});
await captureState("mobile", { width: 390, height: 844 }, "28-activity-sheet", "/today", async (page) => {
  await page.getByRole("button", { name: /활동함 열기/ }).click();
  await page.getByRole("dialog", { name: "활동함" }).waitFor();
});
await captureState("desktop", { width: 1440, height: 900 }, "29-submission-dialog", "/today", async (page) => {
  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await page.getByRole("dialog").waitFor();
});
await captureState("mobile", { width: 390, height: 844 }, "29-submission-sheet", "/today", async (page) => {
  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await page.getByRole("dialog").waitFor();
});
await captureState("desktop", { width: 1440, height: 900 }, "30-member-review", "/library/sessions/2026-07-23", async (page) => {
  await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
  const warning = page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" });
  if (await warning.count()) await warning.getByRole("button", { name: "그래도 보기" }).click();
  await page.getByRole("dialog", { name: /제출/ }).waitFor();
});
await captureState("mobile", { width: 390, height: 844 }, "30-member-review-sheet", "/library/sessions/2026-07-23", async (page) => {
  await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
  const warning = page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" });
  if (await warning.count()) await warning.getByRole("button", { name: "그래도 보기" }).click();
  await page.getByRole("dialog", { name: /제출/ }).waitFor();
});
await captureState("desktop", { width: 1440, height: 900 }, "31-pre-submission-warning", "/library/sessions/2026-07-23", async (page) => {
  await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
  await page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
});
await captureState("mobile", { width: 390, height: 844 }, "31-pre-submission-warning-sheet", "/library/sessions/2026-07-23", async (page) => {
  await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
  await page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
});

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify({ pages: results.pages.length, states: results.states.length, overflow: [...results.pages, ...results.states].filter((item) => item.horizontalOverflow), errors: results.consoleErrors, pageErrors: results.pageErrors }, null, 2)}\n`);
