import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
const browser = await chromium.launch({ headless: true, executablePath });
const results = { baseURL, checks: [], consoleErrors: [], pageErrors: [] };

async function check(name, run) {
  try {
    await run();
    results.checks.push({ name, passed: true });
  } catch (error) {
    results.checks.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1050 }, locale: "ko-KR", colorScheme: "light" });
const page = await desktop.newPage();
page.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push(message.text()); });
page.on("pageerror", (error) => results.pageErrors.push(error.message));
await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });

await check("header anchors target existing sections", async () => {
  for (const name of ["작동 방식", "주요 기능", "화면 미리보기"]) {
    const href = await page.getByRole("link", { name, exact: true }).getAttribute("href");
    if (!href || !(await page.locator(href).count())) throw new Error(`${name}: missing ${href}`);
  }
});

await check("showcase tabs support keyboard selection", async () => {
  const today = page.getByRole("tab", { name: "오늘" });
  await today.focus();
  await today.press("ArrowRight");
  const schedule = page.getByRole("tab", { name: "일정" });
  if ((await schedule.getAttribute("aria-selected")) !== "true") throw new Error("일정 탭이 선택되지 않음");
  await page.getByRole("heading", { name: "팀의 계획과 마감을 한눈에." }).waitFor();
});

await check("primary and demo CTAs use real routes", async () => {
  if ((await page.getByRole("link", { name: /GitLab로 시작하기/ }).first().getAttribute("href")) !== "/login") throw new Error("login route mismatch");
  const demo = page.getByRole("link", { name: "데모 둘러보기" }).first();
  if ((await demo.count()) && (await demo.getAttribute("href")) !== "/today") throw new Error("demo route mismatch");
});

await check("legal returnTo rejects external destinations", async () => {
  await page.goto(`${baseURL}/terms?returnTo=https://evil.example`, { waitUntil: "networkidle" });
  if ((await page.getByRole("link", { name: "돌아가기" }).getAttribute("href")) !== "/") throw new Error("unsafe legal returnTo accepted");
});

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR", colorScheme: "light" });
const mobilePage = await mobile.newPage();
mobilePage.on("console", (message) => { if (message.type() === "error") results.consoleErrors.push(message.text()); });
mobilePage.on("pageerror", (error) => results.pageErrors.push(error.message));
await mobilePage.goto(`${baseURL}/`, { waitUntil: "networkidle" });

await check("mobile menu opens and closes after navigation", async () => {
  const menu = mobilePage.locator(".public-menu-button");
  if ((await menu.getAttribute("aria-label")) !== "메뉴 열기") throw new Error("menu label mismatch");
  await menu.click();
  if ((await menu.getAttribute("aria-expanded")) !== "true") throw new Error("menu did not open");
  await mobilePage.getByRole("link", { name: "주요 기능" }).click();
  if ((await mobilePage.locator(".public-menu-button").getAttribute("aria-expanded")) !== "false") throw new Error("menu did not close");
});

await check("mobile uses the mobile product preview", async () => {
  const currentSrc = await mobilePage.locator(".public-hero-preview img").evaluate((image) => image.currentSrc);
  if (!currentSrc.includes("today-mobile.webp")) throw new Error(`unexpected source: ${currentSrc}`);
});

await browser.close();
await fs.mkdir(path.resolve("artifacts/landing-redesign-qa"), { recursive: true });
await fs.writeFile(path.resolve("artifacts/landing-redesign-qa/interaction-results.json"), JSON.stringify(results, null, 2));
if (results.consoleErrors.length || results.pageErrors.length || results.checks.some((item) => !item.passed)) {
  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  process.exit(1);
}
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
