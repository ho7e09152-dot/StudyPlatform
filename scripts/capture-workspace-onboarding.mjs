import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const sandboxURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const productionPreviewURL = process.env.PRODUCTION_PREVIEW_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/workspace-polish-after");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

const projects = [
  { id: 48213, name: "Evening Workspace", pathWithNamespace: "study-team/evening-workspace", defaultBranch: "main", webUrl: "https://gitlab.example/study-team/evening-workspace", visibility: "private", accessLevel: 40 },
  { id: 3101, name: "Study Platform", pathWithNamespace: "ssafy/study-platform", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/study-platform", visibility: "private", accessLevel: 40 },
  { id: 3102, name: "Legacy Study Archive", pathWithNamespace: "ssafy/legacy-study-archive", defaultBranch: "develop", webUrl: "https://gitlab.example/ssafy/legacy-study-archive", visibility: "internal", accessLevel: 40 },
  { id: 3103, name: "Restricted Study", pathWithNamespace: "ssafy/restricted-study", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/restricted-study", visibility: "private", accessLevel: 20 },
  { id: 3104, name: "New Study Repository", pathWithNamespace: "ssafy/new-study", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/new-study", visibility: "public", accessLevel: 30 },
];

const deletedWorkspace = {
  workspace: {
    id: "deleted-workspace-1", name: "알고리즘 스터디", gitlabProjectId: 2901,
    gitlabProjectPath: "ssafy/algorithm-study", defaultBranch: "main", status: "SOFT_DELETED",
    repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, importMode: "COMPATIBLE",
    lastSyncedAt: "2026-08-10T09:30:00+09:00",
    settings: { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: {} },
    members: [{ id: "member-a", gitlabUserId: 101, username: "kim", displayName: "김서연", avatarUrl: null, fileName: "김서연.md", role: "OWNER", status: "ACTIVE", accessLevel: 50 }],
    sessions: {}, submissions: {},
  },
  deletedAt: "2026-08-10T09:30:00+09:00",
  deletionExpiresAt: "2026-08-17T09:30:00+09:00",
};

const analyses = {
  3101: { projectId: 3101, projectPath: "ssafy/study-platform", defaultBranch: "main", classification: "COMPATIBLE", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, treeFingerprint: "tree-compatible", totalFiles: 28, compatibleSessions: 4, compatibleSubmissions: 11, ignoredFiles: 13, issues: [] },
  3102: { projectId: 3102, projectPath: "ssafy/legacy-study-archive", defaultBranch: "develop", classification: "CONFLICTED", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, treeFingerprint: "tree-conflicted", totalFiles: 19, compatibleSessions: 2, compatibleSubmissions: 3, ignoredFiles: 10, issues: [
    { path: ".study-workspace/config.yml", code: "RESERVED_PATH_CONFLICT", message: "서비스 전용 경로에 호환되지 않는 파일이 있습니다." },
    { path: ".study-workspace/sessions/2026-07-23/session.yml", code: "INVALID_SESSION", message: "기존 일정 파일 형식을 확인해 주세요." },
  ] },
  3104: { projectId: 3104, projectPath: "ssafy/new-study", defaultBranch: "main", classification: "EMPTY", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, treeFingerprint: "tree-empty", totalFiles: 0, compatibleSessions: 0, compatibleSubmissions: 0, ignoredFiles: 0, issues: [] },
};

const connected = (project) => ({ configured: true, status: "CONNECTED", message: "연결됨", checkedAt: "2026-08-12T15:00:00+09:00", user: { id: 9001, username: "study-user", name: "김서연", avatarUrl: null, webUrl: null }, project, repositoryTree: [] });
const authUser = (profileCompleted) => ({ id: 9001, username: "study-user", name: "김서연", avatarUrl: null, webUrl: null, profileCompleted, repositoryFileName: profileCompleted ? "김서연.md" : null, timezone: "Asia/Seoul", termsVersion: profileCompleted ? "2026-01" : null, termsAcceptedAt: profileCompleted ? "2026-08-12T09:00:00+09:00" : null, themeMode: "LIGHT", accentColor: "PURPLE" });
const appMember = { id: "member-a", gitlabUserId: 9001, username: "study-user", displayName: "김서연", avatarUrl: null, fileName: "김서연.md", role: "OWNER", status: "ACTIVE", accessLevel: 50 };
const appWorkspaces = [
  { id: "workspace-evening", name: "저녁 스터디", gitlabProjectId: 48213, gitlabProjectPath: "study-team/evening-workspace", defaultBranch: "main", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, importMode: "COMPATIBLE", status: "ACTIVE", lastSyncedAt: "2026-08-12T10:00:00+09:00", members: [appMember], sessions: {}, submissions: {}, settings: { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: { scheduleChanges: true, submissionMismatch: true, syncFailures: true } } },
  { id: "workspace-reading", name: "CS 원서 읽기", gitlabProjectId: 50117, gitlabProjectPath: "study-team/cs-book-club", defaultBranch: "main", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, importMode: "COMPATIBLE", status: "ACTIVE", lastSyncedAt: "2026-08-12T09:00:00+09:00", members: [appMember], sessions: {}, submissions: {}, settings: { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: { scheduleChanges: true, submissionMismatch: true, syncFailures: true } } },
];

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outputRoot, "desktop"), { recursive: true });
await fs.mkdir(path.join(outputRoot, "mobile"), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];
const consoleErrors = [];

async function stable(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" }).catch(() => {});
  await page.waitForTimeout(160);
}

async function snap(page, folder, filename) {
  await stable(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  if (overflow.page > overflow.viewport + 1) failures.push(`${folder}/${filename}: horizontal overflow ${overflow.page} > ${overflow.viewport}`);
  await page.screenshot({ path: path.join(outputRoot, folder, filename), fullPage: true });
}

async function routeApis(page, { delay = false, deleted = [deletedWorkspace], origin } = {}) {
  const headers = origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" } : {};
  await page.route("**/api/v1/workspaces/deleted", (route) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(deleted) }));
  await page.route("**/api/v1/gitlab/projects?*", async (route) => {
    const query = (new URL(route.request().url()).searchParams.get("search") ?? "").toLowerCase();
    const result = projects.filter((project) => `${project.name} ${project.pathWithNamespace}`.toLowerCase().includes(query));
    await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(result) });
  });
  for (const id of [3101, 3102, 3104]) {
    await page.route(`**/api/v1/gitlab/projects/${id}/connection-check`, async (route) => {
      if (delay && id === 3101) await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(connected(projects.find((project) => project.id === id))) });
    });
    await page.route(`**/api/v1/gitlab/projects/${id}/import-analysis`, async (route) => {
      if (delay && id === 3101) await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(analyses[id]) });
    });
  }
}

async function captureAppStates(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(`${folder}: ${message.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`${folder}: ${error.message}`));
  const origin = productionPreviewURL;
  const cors = { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" };
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user: authUser(true) }) }));
  await page.route("**/api/v1/workspaces", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(appWorkspaces) }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "[]" }));
  await page.route("**/api/v1/gitlab/projects/48213/connection-check", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(connected(projects[0])) }));
  await routeApis(page, { delay: true, origin });

  await page.goto(`${origin}/workspaces`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Workspace", exact: true }).waitFor();
  await snap(page, folder, "01-workspace-hub.png");
  await snap(page, folder, "11-restore.png");

  if (viewport.width > 720) {
    await page.locator(".workspace-picker__button").click();
  } else {
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  }
  await snap(page, folder, "02-workspace-switcher.png");

  await page.goto(`${origin}/workspaces/new`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "새 Workspace 연결" }).waitFor();
  await snap(page, folder, "03-repository-search.png");

  await page.getByRole("option", { name: /Evening Workspace/ }).click();
  await page.getByText("이미 Workspace와 연결된 프로젝트입니다.", { exact: true }).waitFor();
  if (await page.getByLabel("Workspace 이름").count()) failures.push(`${folder}: connected repository still exposes Workspace creation form`);
  await snap(page, folder, "15-already-connected.png");
  await page.getByRole("button", { name: "Workspace로 이동" }).click();
  await page.waitForURL("**/today");

  await page.goto(`${origin}/workspaces/new`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "새 Workspace 연결" }).waitFor();

  await page.getByRole("option", { name: /Study Platform/ }).click();
  await page.getByText("프로젝트 권한을 확인하고 있어요", { exact: true }).waitFor();
  await snap(page, folder, "04-repository-selected.png");
  await snap(page, folder, "05-permission-loading.png");
  await page.getByText("프로젝트 권한을 확인했어요", { exact: true }).waitFor();
  await page.getByText("기존 학습 기록을 찾았어요.", { exact: true }).waitFor();
  if (await page.getByText("Maintainer", { exact: true }).isVisible().catch(() => false)) failures.push(`${folder}: raw GitLab permission is visible in the default success UI`);
  await snap(page, folder, "06-permission-success.png");
  await snap(page, folder, "07-existing-study-data.png");

  await page.getByRole("option", { name: /New Study Repository/ }).click();
  await page.getByText("연결할 준비가 되었어요.", { exact: true }).waitFor();
  await snap(page, folder, "08-new-repository.png");

  await page.getByRole("option", { name: /Legacy Study Archive/ }).click();
  await page.getByText("연결하기 전에 확인이 필요해요.", { exact: true }).waitFor();
  if (await page.getByText("연결할 수 있습니다", { exact: true }).isVisible().catch(() => false)) failures.push(`${folder}: conflict state still claims the Workspace can connect`);
  if (!(await page.getByRole("button", { name: "Workspace 연결하기" }).isDisabled())) failures.push(`${folder}: conflict connect CTA is enabled`);
  await snap(page, folder, "09-conflict.png");

  await page.getByRole("option", { name: /Restricted Study/ }).click();
  await page.getByText("이 프로젝트를 연결할 권한이 없습니다.", { exact: true }).waitFor();
  await snap(page, folder, "10-permission-denied.png");
  await context.close();
}

async function captureProductionStates(folder, viewport) {
  const origin = productionPreviewURL;
  const profileContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const profilePage = await profileContext.newPage();
  await profilePage.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user: authUser(false) }) }));
  await profilePage.goto(`${origin}/today`, { waitUntil: "networkidle" });
  await profilePage.getByRole("heading", { name: "STUDY에서 사용할 이름을 알려주세요" }).waitFor();
  if (!new URL(profilePage.url()).pathname.startsWith("/onboarding/profile")) failures.push(`${folder}: incomplete profile did not route through /onboarding/profile`);
  await snap(profilePage, folder, "13-profile-onboarding.png");
  const profileSubmit = profilePage.getByRole("button", { name: "프로필 저장하고 계속하기" });
  if (!(await profileSubmit.isDisabled())) failures.push(`${folder}: profile CTA is enabled before terms consent`);
  await profilePage.getByRole("checkbox").check();
  if (await profileSubmit.isDisabled()) failures.push(`${folder}: profile CTA did not enable after terms consent`);
  await snap(profilePage, folder, "14-profile-terms-active.png");
  await profilePage.locator(".profile-advanced summary").click();
  await profilePage.getByLabel("학습 기록 이름").waitFor();
  await snap(profilePage, folder, "16-profile-advanced-settings.png");
  await profileContext.close();

  const firstContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const firstPage = await firstContext.newPage();
  await firstPage.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user: authUser(true) }) }));
  await firstPage.route("**/api/v1/workspaces", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, body: "[]" }));
  await routeApis(firstPage, { deleted: [], origin });
  await firstPage.goto(`${origin}/today`, { waitUntil: "networkidle" });
  await firstPage.getByRole("heading", { name: "첫 Workspace를 연결해볼까요?" }).waitFor();
  await snap(firstPage, folder, "12-first-workspace.png");
  await firstContext.close();
}

await captureAppStates("desktop", { width: 1440, height: 1050 });
await captureAppStates("mobile", { width: 390, height: 844 });
await captureProductionStates("desktop", { width: 1440, height: 1050 });
await captureProductionStates("mobile", { width: 390, height: 844 });
await browser.close();

const result = { generatedAt: new Date().toISOString(), capturesPerViewport: 16, failures, consoleErrors };
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length || consoleErrors.length) process.exitCode = 1;
