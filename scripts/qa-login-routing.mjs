import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.QA_BASE_URL ?? "http://127.0.0.1:3210";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
const results = [];

const user = (profileCompleted) => ({
  id: 9001,
  username: "study-user",
  name: "김서연",
  avatarUrl: null,
  webUrl: null,
  profileCompleted,
  repositoryFileName: profileCompleted ? "김서연.md" : null,
  timezone: "Asia/Seoul",
  termsVersion: profileCompleted ? "2026-08-10" : null,
  termsAcceptedAt: profileCompleted ? "2026-08-12T09:00:00Z" : null,
  themeMode: "LIGHT",
  accentColor: "PURPLE",
});

async function contextWithSession(session) {
  const context = await browser.newContext();
  await context.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "Access-Control-Allow-Origin": baseURL, "Access-Control-Allow-Credentials": "true" },
    body: JSON.stringify(session),
  }));
  return context;
}

{
  const context = await contextWithSession({ authenticated: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login`, { waitUntil: "networkidle" });
  results.push({ name: "unauthenticated login remains available", pass: new URL(page.url()).pathname === "/login" });
  await context.close();
}

{
  const context = await contextWithSession({ authenticated: true, user: user(true) });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login?returnUrl=${encodeURIComponent("/library/sessions/2026-07-23")}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/library/sessions/2026-07-23", { timeout: 5000 });
  results.push({ name: "authenticated deep link return", pass: new URL(page.url()).pathname === "/library/sessions/2026-07-23" });
  await context.close();
}

{
  const context = await contextWithSession({ authenticated: true, user: user(false) });
  const page = await context.newPage();
  await page.goto(`${baseURL}/login?returnUrl=${encodeURIComponent("/schedule/2026-07-23")}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/onboarding/profile?returnTo=%2Fschedule%2F2026-07-23", { timeout: 5000 });
  const current = new URL(page.url());
  results.push({
    name: "incomplete profile preserves returnTo",
    pass: current.pathname === "/onboarding/profile" && current.searchParams.get("returnTo") === "/schedule/2026-07-23",
  });
  await context.close();
}

{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: "qa", headerName: "X-CSRF-TOKEN" }) }));
  await page.route("**/api/v1/auth/gitlab/complete", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ returnUrl: "/library/sessions/2026-07-23" }) }));
  await page.goto(`${baseURL}/auth/callback`, { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/library/sessions/2026-07-23", { timeout: 5000 });
  results.push({ name: "OAuth callback restores deep link", pass: new URL(page.url()).pathname === "/library/sessions/2026-07-23" });
  await context.close();
}

await browser.close();
if (results.some((result) => !result.pass)) {
  process.stderr.write(`${JSON.stringify(results, null, 2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
