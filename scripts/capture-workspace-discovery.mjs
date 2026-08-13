import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const output = path.resolve("artifacts/workspace-discovery-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

const user = { id: 101, username: "study-user", name: "김서연", avatarUrl: null, webUrl: null, profileCompleted: true, repositoryFileName: "kim.md", timezone: "Asia/Seoul", termsVersion: "2026-08-10", termsAcceptedAt: "2026-08-12T09:00:00Z", themeMode: "LIGHT", accentColor: "PURPLE" };
const member = { id: "member-a", gitlabUserId: 101, username: "study-user", displayName: "김서연", avatar: "김", color: "#6d52b5", fileName: "kim.md", role: "MEMBER", status: "ACTIVE", accessLevel: 30 };
const settings = { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: { scheduleChanges: true, submissionMismatch: true, syncFailures: true } };
const currentWorkspace = { id: "workspace-current", name: "저녁 스터디", gitlabProjectId: 7001, gitlabProjectPath: "team/evening-study", defaultBranch: "main", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, importMode: "COMPATIBLE", status: "ACTIVE", lastSyncedAt: "2026-08-12T09:00:00Z", members: [{ ...member, role: "OWNER" }], sessions: {}, submissions: {}, settings };
const joinedWorkspace = { id: "workspace-algorithm", name: "알고리즘 스터디", gitlabProjectId: 7002, gitlabProjectPath: "team/algorithm-study", defaultBranch: "main", repositoryBasePath: ".study-workspace", repositorySchemaVersion: 2, importMode: "COMPATIBLE", status: "ACTIVE", lastSyncedAt: "2026-08-12T09:00:00Z", members: [member], sessions: {}, submissions: {}, settings };
const discoverable = [{ workspaceId: joinedWorkspace.id, workspaceName: joinedWorkspace.name, provider: "GITLAB", repositoryId: "7002", repositoryPath: joinedWorkspace.gitlabProjectPath, defaultBranch: "main", eligibility: "REPOSITORY_WRITE_CONFIRMED" }];
const projects = [
  { id: 7001, name: "Evening Study", pathWithNamespace: "team/evening-study", defaultBranch: "main", webUrl: "https://gitlab.example/team/evening-study", visibility: "private", accessLevel: 40 },
  { id: 7002, name: "Algorithm Study", pathWithNamespace: "team/algorithm-study", defaultBranch: "main", webUrl: "https://gitlab.example/team/algorithm-study", visibility: "private", accessLevel: 30 },
];

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(path.join(output, "desktop"), { recursive: true });
await fs.mkdir(path.join(output, "mobile"), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const results = { failures: [], consoleErrors: [], captures: [] };

async function mock(page, workspaces) {
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user }) }));
  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "qa-token", headerName: "X-CSRF-TOKEN" }) }));
  await page.route("**/api/v1/workspaces/discoverable", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(discoverable) }));
  await page.route("**/api/v1/workspaces/*/join", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ workspace: joinedWorkspace, joined: true }) }));
  await page.route("**/api/v1/workspaces/deleted", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/v1/workspaces", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(workspaces) }));
  await page.route("**/api/v1/notifications", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/v1/gitlab/projects?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(projects) }));
  await page.route("**/api/v1/gitlab/projects/7001/connection-check", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ code: "GITLAB_UPSTREAM_ERROR", message: "GitLab이 프로젝트 요청을 처리하지 못했습니다." }) }));
  await page.route("**/api/v1/gitlab/projects/7002/connection-check", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: true, status: "CONNECTED", message: "연결됨", checkedAt: "2026-08-13T10:00:00Z", user, project: projects[1], repositoryTree: [] }) }));
}

async function shot(page, folder, name) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}" }).catch(() => {});
  await page.waitForTimeout(120);
  const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  if (overflow.scrollWidth > overflow.width + 1) results.failures.push(`${folder}/${name}: overflow ${overflow.scrollWidth} > ${overflow.width}`);
  const target = path.join(output, folder, name);
  await page.screenshot({ path: target, fullPage: true });
  results.captures.push(target);
}

for (const [folder, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.on("pageerror", (error) => results.consoleErrors.push(`${folder}: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) results.consoleErrors.push(`${folder}: ${message.text()}`); });
  await mock(page, [currentWorkspace]);

  await page.goto(`${baseURL}/workspaces`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "참여 가능한 Workspace" }).waitFor();
  await shot(page, folder, "01-workspace-discovery.png");

  await page.goto(`${baseURL}/workspaces/new`, { waitUntil: "networkidle" });
  await page.getByRole("option", { name: /Algorithm Study/ }).click();
  await page.getByText("이미 Study-ing Workspace가 있는 프로젝트입니다.", { exact: true }).waitFor();
  if (await page.getByLabel("Workspace 이름").count()) results.failures.push(`${folder}: joinable repository exposed create form`);
  await shot(page, folder, "02-repository-join.png");

  await page.getByRole("button", { name: "Workspace 참여하기" }).click();
	await page.waitForTimeout(800);
	if (!page.url().endsWith("/today")) {
		results.failures.push(`${folder}: join did not navigate to /today (${page.url()})`);
	}
	await page.waitForFunction(() => document.querySelector(".sync-card")?.textContent?.includes("GitLab 연결됨"), undefined, { timeout: 3000 }).catch(() => {
		results.failures.push(`${folder}: joined Workspace provider status did not become connected`);
	});
	const providerStatus = await page.locator(".sync-card").textContent();
	if (/GitLab 연결 (실패|확인 필요)/.test(providerStatus ?? "")) {
		results.failures.push(`${folder}: previous Workspace provider error remained after join`);
	}
  await shot(page, folder, "03-join-success-today.png");
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(output, "qa-results.json"), JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
if (results.failures.length || results.consoleErrors.length) process.exitCode = 1;
