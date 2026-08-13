import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/settings-polish-qa");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const user = { id: 9001, username: "study-user", name: "김서연", avatarUrl: null, webUrl: "https://gitlab.example/study-user", profileCompleted: true, repositoryFileName: "김서연.md", timezone: "Asia/Seoul", termsVersion: "2026-01", termsAcceptedAt: "2026-08-10T09:00:00+09:00", themeMode: "LIGHT", accentColor: "PURPLE" };
const members = [
  { id: "member-a", gitlabUserId: 9001, username: "study-user", displayName: "김서연", avatar: "김", color: "#6750a4", fileName: "김서연.md", role: "OWNER", status: "ACTIVE", accessLevel: 50 },
  { id: "member-b", gitlabUserId: 9002, username: "lee-junho", displayName: "이준호", avatar: "이", color: "#3267a8", fileName: "이준호.md", role: "MANAGER", status: "ACTIVE", accessLevel: 40 },
  { id: "member-c", gitlabUserId: 9003, username: "park-minji", displayName: "박민지", avatar: "박", color: "#a83f5e", fileName: "박민지.md", role: "MEMBER", status: "PROJECT_ACCESS_LOST", accessLevel: 20 },
];
const workspace = { id: "workspace-evening", name: "저녁 스터디", gitlabProjectId: 48213, gitlabProjectPath: "study-team/evening-workspace", defaultBranch: "main", repositoryBasePath: "", repositorySchemaVersion: 1, importMode: "LEGACY", status: "ACTIVE", lastSyncedAt: "2026-08-12T10:32:00+09:00", members, sessions: {}, submissions: {}, settings: { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: { scheduleChanges: true, submissionMismatch: true, syncFailures: false } } };
const secondWorkspace = { ...workspace, id: "workspace-algorithm", name: "알고리즘 스터디", gitlabProjectId: 49321, gitlabProjectPath: "study-team/algorithm-study" };
const connection = { configured: true, status: "CONNECTED", message: "연결됨", checkedAt: "2026-08-12T15:00:00+09:00", user: { id: 9001, username: "study-user", name: "김서연", avatarUrl: null, webUrl: "https://gitlab.example/study-user" }, project: { id: 48213, name: "Evening Workspace", pathWithNamespace: "study-team/evening-workspace", defaultBranch: "main", webUrl: "https://gitlab.example/study-team/evening-workspace", visibility: "private", accessLevel: 50 }, repositoryTree: [] };
const candidates = [{ id: "member-d", gitlabUserId: 9004, username: "choi", displayName: "최현우", avatar: "최", color: "#16836f", fileName: "최현우.md", role: "MEMBER", status: "ACTIVE", accessLevel: 30 }];
const auditEvents = [
  { id: "audit-1", eventType: "WORKSPACE_UPDATED", targetType: "WORKSPACE", targetId: workspace.id, detailsJson: "{}", createdAt: "2026-08-12T09:22:00+09:00" },
  { id: "audit-2", eventType: "MEMBERS_SYNCED", targetType: "WORKSPACE", targetId: workspace.id, detailsJson: "{}", createdAt: "2026-08-11T14:03:00+09:00" },
];
const syncJobs = [
  { id: "sync-1", status: "SUCCESS", jobType: "REPOSITORY_SYNC", startedAt: "2026-08-12T10:32:00+09:00", completedAt: "2026-08-12T10:32:10+09:00" },
  { id: "sync-2", status: "PARTIAL", jobType: "REPOSITORY_SYNC", startedAt: "2026-08-11T18:14:00+09:00", completedAt: "2026-08-11T18:14:10+09:00" },
];
const migration = { sessionFiles: 4, submissionFiles: 9, totalMoves: 13, treeFingerprint: "tree-v1", ready: true, moves: [
  { sourcePath: "2026-07-23/session.yml", targetPath: ".study-workspace/sessions/2026-07-23/session.yml", type: "SESSION" },
  { sourcePath: "2026-07-23/submissions/김서연.md", targetPath: ".study-workspace/sessions/2026-07-23/submissions/김서연.md", type: "SUBMISSION" },
], blockers: [] };

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outputRoot, "desktop"), { recursive: true });
await fs.mkdir(path.join(outputRoot, "mobile"), { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];
const consoleErrors = [];

async function routeApis(page, { workspaceFixture = workspace, connectionFixture = connection, migrationFixture = migration, migrationFailure = false } = {}) {
  const headers = { "Access-Control-Allow-Origin": baseURL, "Access-Control-Allow-Credentials": "true" };
  const fulfill = (route, body) => route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
  await page.route("**/api/v1/auth/csrf", (route) => fulfill(route, { token: "settings-qa-csrf", headerName: "X-CSRF-TOKEN" }));
  await page.route("**/api/v1/auth/me", (route) => fulfill(route, { authenticated: true, mode: "gitlab-oauth", user }));
  await page.route("**/api/v1/auth/profile", async (route) => { await new Promise((resolve) => setTimeout(resolve, 250)); return fulfill(route, { ...user, ...route.request().postDataJSON() }); });
  await page.route("**/api/v1/workspaces", (route) => fulfill(route, [workspaceFixture, secondWorkspace]));
  await page.route("**/api/v1/notifications", (route) => fulfill(route, []));
  await page.route("**/api/v1/gitlab/projects/48213/connection-check", (route) => fulfill(route, connectionFixture));
  await page.route(`**/api/v1/workspaces/${workspace.id}/member-candidates`, (route) => fulfill(route, candidates));
  await page.route(`**/api/v1/workspaces/${workspace.id}/audit-events`, (route) => fulfill(route, auditEvents));
  await page.route(`**/api/v1/workspaces/${workspace.id}/sync-jobs`, (route) => fulfill(route, syncJobs));
  await page.route(`**/api/v1/workspaces/${workspace.id}/repository-schema/migration`, (route) => fulfill(route, migrationFixture));
  await page.route(`**/api/v1/workspaces/${workspace.id}/repository-schema/migrate`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (migrationFailure) return route.fulfill({ status: 409, contentType: "application/json", headers, body: JSON.stringify({ message: "저장소가 변경되어 이전을 중단했습니다." }) });
    return fulfill(route, { workspace: { ...workspaceFixture, repositorySchemaVersion: 2, repositoryBasePath: ".study-workspace" }, commitId: "abc123def456", movedFiles: migrationFixture.totalMoves, failures: [], syncedAt: "2026-08-12T16:00:00+09:00" });
  });
  await page.route(`**/api/v1/workspaces/${workspace.id}/notifications`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return fulfill(route, { ...workspaceFixture, settings: { ...workspaceFixture.settings, notifications: route.request().postDataJSON() } });
  });
  await page.route(`**/api/v1/workspaces/${workspace.id}`, async (route) => {
    if (route.request().method() === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const input = route.request().postDataJSON();
      return fulfill(route, { ...workspaceFixture, ...input });
    }
    return fulfill(route, workspaceFixture);
  });
}

async function stable(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" }).catch(() => {});
  await page.waitForTimeout(120);
}

async function snap(page, folder, name) {
  await stable(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  if (overflow.page > overflow.viewport + 1) failures.push(`${folder}/${name}: horizontal overflow ${overflow.page} > ${overflow.viewport}`);
  await page.screenshot({ path: path.join(outputRoot, folder, name), fullPage: true });
}

async function open(page, route, heading) {
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}

async function capture(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("Failed to load resource")) consoleErrors.push(`${folder}: ${message.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`${folder}: ${error.message}`));
  await routeApis(page);

  const states = [
    ["/settings", "Workspace 일반", "01-general.png"],
    ["/settings/study-rules", "학습 규칙", "02-study-rules.png"],
    ["/settings/members", "Workspace 멤버", "03-members.png"],
    ["/settings/notifications", "Workspace 알림", "04-notifications.png"],
    ["/settings/repository", "저장소 연결", "05-repository.png"],
    ["/settings/data", "데이터 및 동기화", "06-data-sync.png"],
    ["/settings/profile", "프로필", "07-profile.png"],
    ["/settings/accounts", "연결된 계정", "08-connected-account.png"],
    ["/settings/appearance", "화면 설정", "09-appearance.png"],
    ["/settings/security", "보안 및 감사", "10-security.png"],
    ["/settings/danger", "위험 영역", "11-workspace-danger.png"],
    ["/settings/account", "계정 관리", "13-account.png"],
    ["/settings/data/migrate", "저장 구조 이전", "15-migration.png"],
  ];
  for (const [route, heading, name] of states) { await open(page, route, heading); await snap(page, folder, name); }

  await open(page, "/settings", "Workspace 일반");
  const generalSave = page.getByRole("button", { name: "저장", exact: true });
  if (!(await generalSave.isDisabled())) failures.push(`${folder}: unchanged General save is enabled`);
  if ((await page.getByLabel("Workspace 시간대").evaluate((element) => element.tagName)) !== "SELECT") failures.push(`${folder}: Workspace timezone is not a select`);
  await page.getByLabel("Workspace 이름").fill("저녁 집중 스터디");
  if (await generalSave.isDisabled()) failures.push(`${folder}: dirty General save is disabled`);
  await snap(page, folder, "19-general-dirty.png");
  page.once("dialog", (dialog) => dialog.dismiss());
  if (viewport.width <= 720) await page.getByLabel("설정 항목 선택").selectOption("study-rules");
  else await page.getByRole("link", { name: "학습 규칙", exact: true }).click();
  if (!page.url().endsWith("/settings")) failures.push(`${folder}: dismissed unsaved navigation still left General`);
  const savePromise = generalSave.click();
  await page.getByRole("button", { name: "저장 중…" }).waitFor();
  await snap(page, folder, "20-general-saving.png");
  await savePromise;
  await page.getByText("Workspace 정보를 저장했습니다", { exact: true }).waitFor();
  if (!(await generalSave.isDisabled())) failures.push(`${folder}: saved General remains dirty`);
  if (viewport.width <= 720) {
    await page.getByLabel("설정 항목 선택").selectOption("study-rules");
    await page.waitForURL("**/settings/study-rules");
    await page.getByLabel("설정 항목 선택").selectOption("general");
  } else {
    await page.getByRole("link", { name: "학습 규칙", exact: true }).click();
    await page.waitForURL("**/settings/study-rules");
    await page.getByRole("link", { name: "일반", exact: true }).click();
  }
  await page.waitForURL(/\/settings(?:\/general)?$/);
  const savedName = await page.getByLabel("Workspace 이름").inputValue();
  await page.getByLabel("Workspace 이름").fill(`${savedName} 수정`);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.goBack({ waitUntil: "commit" }).catch(() => null);
  await page.waitForTimeout(250);
  if (!/\/settings(?:\/general)?$/.test(new URL(page.url()).pathname)) failures.push(`${folder}: dismissed browser-back guard left General`);
  await page.getByLabel("Workspace 이름").fill(savedName);

  await open(page, "/settings/danger", "위험 영역");
  await page.getByRole("button", { name: "Workspace 삭제", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await snap(page, folder, "12-workspace-delete-dialog.png");
  await page.getByRole("button", { name: "취소" }).click();

  await open(page, "/settings/account", "계정 관리");
  await page.getByRole("button", { name: "계정 탈퇴", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await snap(page, folder, "14-account-delete-dialog.png");

  await open(page, "/settings/repository", "저장소 연결");
  if (await page.getByText("Project ID", { exact: true }).isVisible().catch(() => false)) failures.push(`${folder}: repository technical details visible by default`);
  await page.getByText("저장소 세부 정보", { exact: true }).click();
  if (!(await page.getByText("Project ID", { exact: true }).isVisible())) failures.push(`${folder}: repository details do not disclose Project ID`);
  if (await page.getByText("Owner", { exact: true }).isVisible().catch(() => false)) failures.push(`${folder}: raw App Role visible`);

  await open(page, "/settings/notifications", "Workspace 알림");
  const toggle = page.getByRole("switch", { name: "저장소 동기화 오류" });
  if (await toggle.isChecked()) failures.push(`${folder}: notification fixture state mismatch`);
  await toggle.click();
  if (!(await toggle.isDisabled())) failures.push(`${folder}: notification toggle has no saving state`);
  await page.getByText("알림 설정을 저장했습니다", { exact: true }).waitFor();
  if (!(await toggle.isChecked())) failures.push(`${folder}: notification toggle failed`);

  await open(page, "/settings/accounts", "연결된 계정");
  const reauthorize = page.getByRole("link", { name: /GitLab 다시 승인/ });
  if (!((await reauthorize.getAttribute("href")) ?? "").includes("returnUrl=%2Fsettings%2Faccounts")) failures.push(`${folder}: connected-account reauthorize does not return to account settings`);

  if (viewport.width <= 720) {
    await open(page, "/settings", "Workspace 일반");
    const selector = page.getByLabel("설정 항목 선택");
    await selector.selectOption("members");
    await page.waitForURL("**/settings/members");
    if (!(await selector.isVisible())) failures.push(`${folder}: mobile settings selector missing`);
  } else {
    await page.locator(".account-row").click();
    await page.getByRole("menuitem", { name: /프로필 설정/ }).click();
    await page.waitForURL("**/settings/profile");
  }

  await context.close();

  const errorContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const errorPage = await errorContext.newPage();
  const expiredConnection = { configured: true, status: "NOT_CONFIGURED", message: "GitLab 연결이 만료되었습니다.", checkedAt: "2026-08-12T15:00:00+09:00", user: null, project: null, repositoryTree: [] };
  await routeApis(errorPage, { connectionFixture: expiredConnection });
  await open(errorPage, "/settings/repository", "저장소 연결");
  await errorPage.getByText("GitLab 연결을 다시 확인해주세요", { exact: true }).waitFor();
  await snap(errorPage, folder, "16-repository-reauthorize.png");
  await errorContext.close();

  const blockedContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const blockedPage = await blockedContext.newPage();
  const blockedMigration = { ...migration, ready: false, blockers: [{ code: "TARGET_EXISTS", path: ".study-workspace/sessions/2026-07-23/session.yml", message: "이동할 위치에 다른 일정 파일이 있습니다." }] };
  await routeApis(blockedPage, { migrationFixture: blockedMigration });
  await open(blockedPage, "/settings/data/migrate", "저장 구조 이전");
  await blockedPage.getByText("이전하기 전에 확인이 필요해요", { exact: true }).waitFor();
  if (!(await blockedPage.getByRole("button", { name: "이전 실행" }).isDisabled())) failures.push(`${folder}: blocked migration CTA is enabled`);
  await snap(blockedPage, folder, "17-migration-blocked.png");
  await blockedContext.close();

  const emptyMigrationContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const emptyMigrationPage = await emptyMigrationContext.newPage();
  await routeApis(emptyMigrationPage, { migrationFixture: { ...migration, sessionFiles: 0, submissionFiles: 0, totalMoves: 0, ready: false, moves: [] } });
  await open(emptyMigrationPage, "/settings/data/migrate", "저장 구조 이전");
  await emptyMigrationPage.getByText("이전할 파일이 없어요", { exact: true }).waitFor();
  await snap(emptyMigrationPage, folder, "21-migration-empty.png");
  await emptyMigrationContext.close();

  const migrationContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const migrationPage = await migrationContext.newPage();
  await routeApis(migrationPage);
  await open(migrationPage, "/settings/data/migrate", "저장 구조 이전");
  await migrationPage.getByRole("button", { name: "이전 실행", exact: true }).click();
  await migrationPage.getByRole("dialog").waitFor();
  await snap(migrationPage, folder, "22-migration-confirm.png");
  await migrationPage.getByRole("dialog").getByRole("button", { name: "이전 실행", exact: true }).click();
  await migrationPage.getByRole("button", { name: "GitLab에 반영 중…", exact: true }).waitFor();
  await snap(migrationPage, folder, "23-migration-saving.png");
  await migrationPage.getByText("저장 구조 이전을 완료했어요", { exact: true }).waitFor();
  await snap(migrationPage, folder, "24-migration-success.png");
  await migrationContext.close();

  const migrationFailureContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const migrationFailurePage = await migrationFailureContext.newPage();
  await routeApis(migrationFailurePage, { migrationFailure: true });
  await open(migrationFailurePage, "/settings/data/migrate", "저장 구조 이전");
  await migrationFailurePage.getByRole("button", { name: "이전 실행", exact: true }).click();
  await migrationFailurePage.getByRole("dialog").getByRole("button", { name: "이전 실행", exact: true }).click();
  await migrationFailurePage.getByText("저장소가 변경되어 이전을 중단했습니다.", { exact: true }).waitFor();
  await snap(migrationFailurePage, folder, "25-migration-failure.png");
  await migrationFailureContext.close();

  const memberContext = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const memberPage = await memberContext.newPage();
  const memberWorkspace = { ...workspace, members: members.map((member) => member.id === "member-a" ? { ...member, role: "MEMBER" } : member) };
  await routeApis(memberPage, { workspaceFixture: memberWorkspace });
  await open(memberPage, "/settings/danger", "위험 영역");
  if (await memberPage.getByRole("button", { name: "Workspace 삭제", exact: true }).count()) failures.push(`${folder}: non-owner can see Workspace delete button`);
  await snap(memberPage, folder, "18-member-danger-permission.png");
  await open(memberPage, "/settings/data/migrate", "저장 구조 이전");
  await memberPage.getByText("소유자만 저장 구조를 이전할 수 있어요", { exact: true }).waitFor();
  await snap(memberPage, folder, "26-member-migration-restricted.png");
  await open(memberPage, "/settings/members", "Workspace 멤버");
  if (await memberPage.getByRole("button", { name: /GitLab 멤버 동기화/ }).count()) failures.push(`${folder}: Member can see member sync`);
  if (await memberPage.locator(".settings-member-scope select").count()) failures.push(`${folder}: Member can see role controls`);
  await open(memberPage, "/settings/data", "데이터 및 동기화");
  if (await memberPage.getByRole("button", { name: "지금 동기화" }).count()) failures.push(`${folder}: Member can see repository sync`);
  await memberContext.close();
}

await capture("desktop", { width: 1440, height: 1050 });
await capture("mobile", { width: 390, height: 844 });
await browser.close();
const result = { generatedAt: new Date().toISOString(), capturesPerViewport: 26, failures, consoleErrors };
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length || consoleErrors.length) process.exitCode = 1;
