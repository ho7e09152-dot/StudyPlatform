import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "http://127.0.0.1:3210";
const outputRoot = path.resolve(process.env.CAPTURE_OUTPUT ?? "artifacts/auth-flow-captures-20260812");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const apiOrigin = "http://localhost:8080";

const authUser = (profileCompleted) => ({
  id: 9001,
  username: "study-user",
  name: "김서연",
  avatarUrl: null,
  webUrl: "https://gitlab.example/study-user",
  profileCompleted,
  repositoryFileName: profileCompleted ? "김서연.md" : null,
  timezone: "Asia/Seoul",
  termsVersion: profileCompleted ? "2026-01" : null,
  termsAcceptedAt: profileCompleted ? "2026-08-12T09:00:00+09:00" : null,
  themeMode: "LIGHT",
  accentColor: "PURPLE",
});

const projects = [
  { id: 3101, name: "Study Platform", pathWithNamespace: "ssafy/study-platform", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/study-platform", visibility: "private", accessLevel: 40 },
  { id: 3102, name: "Algorithm Study", pathWithNamespace: "ssafy/algorithm-study", defaultBranch: "main", webUrl: "https://gitlab.example/ssafy/algorithm-study", visibility: "internal", accessLevel: 30 },
];

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outputRoot, "desktop"), { recursive: true });
await fs.mkdir(path.join(outputRoot, "mobile"), { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const results = [];

async function stabilize(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" }).catch(() => {});
  await page.waitForTimeout(180);
}

async function snap(page, folder, filename, expectedHeading) {
  if (expectedHeading) await page.getByRole("heading", { name: expectedHeading }).waitFor();
  await stabilize(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  const target = path.join(outputRoot, folder, filename);
  await page.screenshot({ path: target, fullPage: true });
  results.push({ folder, filename, dimensions, overflow: dimensions.page > dimensions.viewport + 1 });
}

async function publicScreens(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();

  for (const [route, file, heading] of [
    ["/login", "01-login-default.png", "Study-ing 시작하기"],
    ["/login?oauthError=session_expired", "02-login-session-expired.png", "Study-ing 시작하기"],
    ["/login?oauthError=reconnect_required", "03-login-reconnect-required.png", "Study-ing 시작하기"],
    ["/login?oauthError=access_denied", "04-login-oauth-cancelled.png", "Study-ing 시작하기"],
    ["/login?oauthError=oauth_failed", "05-login-oauth-failure.png", "Study-ing 시작하기"],
  ]) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await snap(page, folder, file, heading);
  }

  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "capture-token", headerName: "X-CSRF-TOKEN" }) }));
  await page.route("**/api/v1/auth/gitlab/complete", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 15_000));
    await route.abort();
  });
  await page.goto(`${baseURL}/auth/callback`, { waitUntil: "domcontentloaded" });
  await snap(page, folder, "06-oauth-checking.png", "Study-ing");

  await page.goto(`${baseURL}/terms`, { waitUntil: "networkidle" });
  await snap(page, folder, "10-terms.png", "이용약관");
  await page.goto(`${baseURL}/privacy`, { waitUntil: "networkidle" });
  await snap(page, folder, "11-privacy.png", "개인정보 처리 안내");
  await context.close();
}

async function profileScreens(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  const cors = { "Access-Control-Allow-Origin": baseURL, "Access-Control-Allow-Credentials": "true" };
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user: authUser(false) }) }));
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await snap(page, folder, "06-profile-default.png", "STUDY에서 사용할 이름을 알려주세요");
  const submit = page.getByRole("button", { name: "프로필 저장하고 계속하기" });
  const disabledBeforeConsent = await submit.isDisabled();
  await page.getByRole("checkbox").check();
  const enabledAfterConsent = !(await submit.isDisabled());
  await snap(page, folder, "07-profile-terms-agreed.png", "STUDY에서 사용할 이름을 알려주세요");
  await page.locator(".profile-advanced summary").click();
  await page.getByLabel("학습 기록 이름").waitFor();
  await snap(page, folder, "08-profile-advanced.png", "STUDY에서 사용할 이름을 알려주세요");
  results.push({ folder, state: "profile-interaction", disabledBeforeConsent, enabledAfterConsent });
  await context.close();
}

async function firstWorkspaceScreen(folder, viewport) {
  const context = await browser.newContext({ viewport, locale: "ko-KR", timezoneId: "Asia/Seoul", colorScheme: "light" });
  const page = await context.newPage();
  const cors = { "Access-Control-Allow-Origin": baseURL, "Access-Control-Allow-Credentials": "true" };
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ authenticated: true, mode: "gitlab-oauth", user: authUser(true) }) }));
  await page.route("**/api/v1/workspaces", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "[]" }));
  await page.route("**/api/v1/workspaces/deleted", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "[]" }));
  await page.route("**/api/v1/gitlab/projects?*", (route) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(projects) }));
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await snap(page, folder, "09-first-workspace.png", "첫 Workspace를 연결해볼까요?");
  await context.close();
}

for (const [folder, viewport] of [
  ["desktop", { width: 1440, height: 1050 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  await publicScreens(folder, viewport);
  await profileScreens(folder, viewport);
  await firstWorkspaceScreen(folder, viewport);
}

async function makeContactSheet(folder, width) {
  const entries = (await fs.readdir(path.join(outputRoot, folder))).filter((name) => name.endsWith(".png")).sort();
  const images = await Promise.all(entries.map(async (name) => ({ name, data: (await fs.readFile(path.join(outputRoot, folder, name))).toString("base64") })));
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const columns = folder === "desktop" ? 2 : 3;
  await page.setContent(`
    <style>
      *{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f4f7;color:#191725;font:14px system-ui,sans-serif}
      h1{margin:0 0 20px;font-size:24px}main{display:grid;grid-template-columns:repeat(${columns},minmax(0,1fr));gap:20px;align-items:start}
      figure{overflow:hidden;margin:0;border:1px solid #dedde6;border-radius:12px;background:white;box-shadow:0 8px 25px rgba(30,24,50,.06)}
      figcaption{padding:11px 14px;border-bottom:1px solid #dedde6;font-weight:700}img{display:block;width:100%;height:auto}
    </style>
    <h1>Study-ing 인증·가입 Flow — ${folder === "desktop" ? "Desktop" : "Mobile"}</h1>
    <main>${images.map(({ name, data }) => `<figure><figcaption>${name.replace(/\.png$/, "")}</figcaption><img src="data:image/png;base64,${data}" /></figure>`).join("")}</main>
  `);
  await page.screenshot({ path: path.join(outputRoot, `contact-sheet-${folder}.png`), fullPage: true });
  await context.close();
}

await makeContactSheet("desktop", 1520);
await makeContactSheet("mobile", 1180);
await browser.close();

await fs.writeFile(path.join(outputRoot, "capture-results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), baseURL, results }, null, 2));
process.stdout.write(`${JSON.stringify({ captures: results.filter((item) => item.filename).length, overflow: results.filter((item) => item.overflow), interactions: results.filter((item) => item.state) }, null, 2)}\n`);
