import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const phase = process.env.CAPTURE_PHASE ?? "before";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? `artifacts/information-density-audit/${phase}`);
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";

const routes = [
  ["01-today", "/today"],
  ["02-schedule", "/schedule"],
  ["03-schedule-detail", "/schedule/2026-07-23"],
  ["04-library", "/library"],
  ["05-library-documents", "/library?tab=documents"],
  ["06-library-session", "/library/sessions/2026-07-23"],
  ["07-document-detail", "/library/docs/demo-doc-os"],
  ["08-records", "/records"],
  ["09-workspaces", "/workspaces"],
  ["10-workspace-connect", "/workspaces/new"],
  ["11-settings-general", "/settings/general"],
  ["12-settings-repository", "/settings/repository"],
  ["13-settings-accounts", "/settings/accounts"],
];

const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const results = { phase, baseURL, generatedAt: new Date().toISOString(), captures: [], consoleErrors: [], pageErrors: [] };
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });

async function installBackendFixtures(context) {
  const discoverable = [{
    workspaceId: "demo-discoverable-workspace",
    workspaceName: "알고리즘 스터디",
    provider: "GITLAB",
    repositoryId: "7002",
    repositoryPath: "team/algorithm-study",
    defaultBranch: "main",
    eligibility: "REPOSITORY_WRITE_CONFIRMED",
  }];
  const projects = [{
    id: 7001,
    name: "frontend-study",
    pathWithNamespace: "study-ing/frontend-study",
    visibility: "private",
    defaultBranch: "main",
    webUrl: "https://gitlab.com/study-ing/frontend-study",
    accessLevel: 30,
  }];
  const repositories = projects.map((project) => ({
    provider: "GITLAB",
    externalId: String(project.id),
    name: project.name,
    fullName: project.pathWithNamespace,
    visibility: project.visibility.toUpperCase(),
    defaultBranch: project.defaultBranch,
    webUrl: project.webUrl,
    capabilities: { canRead: true, canWrite: true, canManage: false },
    providerPermission: "30",
    connectionState: "AVAILABLE",
  }));

  await context.route("**/api/v1/workspaces/discoverable", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(discoverable) }));
  await context.route("**/api/v1/workspaces/deleted", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await context.route("**/api/v1/gitlab/projects?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects) }));
  await context.route("**/api/v1/repositories?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(repositories) }));
}

function monitor(page, viewportName, route) {
  page.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push({ viewport: viewportName, route, text: message.text() }); });
  page.on("pageerror", (error) => results.pageErrors.push({ viewport: viewportName, route, text: error.message }));
}

async function stabilize(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" });
  await page.waitForTimeout(120);
}

async function save(page, viewportName, name, route, state = "page") {
  await stabilize(page);
  const metrics = await page.evaluate(() => ({
    viewportWidth: innerWidth,
    viewportHeight: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyTextLength: document.body.innerText.length,
  }));
  const folder = path.join(outputRoot, viewportName);
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.captures.push({ viewport: viewportName, route, state, file, ...metrics, horizontalOverflow: metrics.scrollWidth > metrics.viewportWidth + 1 });
}

for (const [viewportName, viewport] of viewports) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  await installBackendFixtures(context);
  for (const [name, route] of routes) {
    const page = await context.newPage();
    monitor(page, viewportName, route);
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
    await save(page, viewportName, name, route);
    await page.close();
  }

  const activityPage = await context.newPage();
  monitor(activityPage, viewportName, "/today#activity");
  await activityPage.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await activityPage.locator('button[aria-label^="활동함 열기"]:visible').click();
  await activityPage.getByRole("dialog", { name: "활동함" }).waitFor();
  await save(activityPage, viewportName, "14-activity", "/today", "activity");
  await activityPage.close();

  const submissionPage = await context.newPage();
  monitor(submissionPage, viewportName, "/today#submission");
  await submissionPage.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await submissionPage.getByRole("button", { name: /계속 학습하기|학습 시작하기|제출하기/ }).first().click();
  await submissionPage.getByRole("dialog").waitFor();
  await save(submissionPage, viewportName, "15-submission", "/today", "submission");
  await submissionPage.close();

  await context.close();
}

const darkContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "dark" });
await installBackendFixtures(darkContext);
for (const [name, route] of [["16-today-dark", "/today"], ["17-settings-dark", "/settings/general"]]) {
  const page = await darkContext.newPage();
  monitor(page, "desktop-dark", route);
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await page.locator(".app-frame").evaluate((frame) => {
    frame.setAttribute("data-theme", "dark");
    frame.setAttribute("data-accent", "purple");
  });
  await save(page, "desktop-dark", name, route);
  await page.close();
}
await darkContext.close();

await browser.close();
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify({ captures: results.captures.length, overflow: results.captures.filter((item) => item.horizontalOverflow), consoleErrors: results.consoleErrors, pageErrors: results.pageErrors }, null, 2)}\n`);
