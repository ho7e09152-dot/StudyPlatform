import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = process.env.CAPTURE_OUTPUT ?? "/home/roro/study_platform/artifacts/library-redesign-qa";
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];
const consoleErrors = [];
const checks = [];

async function captureSet(name, viewport) {
  const dir = path.join(outputRoot, name);
  await fs.mkdir(dir, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: "light", locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${name}: ${message.text()}`); });
  page.on("pageerror", (error) => consoleErrors.push(`${name}: ${error.message}`));

  async function stabilize() {
    await page.addStyleTag({ content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}html{scroll-behavior:auto!important}" }).catch(() => {});
    await page.waitForTimeout(250);
  }
  async function open(route) {
    await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
    await stabilize();
  }
  async function snap(slug) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, url: location.pathname + location.search }));
    if (overflow.scrollWidth > overflow.width + 1) failures.push(`${name}/${slug}: horizontal overflow ${overflow.scrollWidth} > ${overflow.width} at ${overflow.url}`);
    await page.screenshot({ path: path.join(dir, `${slug}.png`), fullPage: true });
  }
  async function closeDialog() {
    const dialog = page.getByRole("dialog").last();
    if (await dialog.count()) await dialog.getByRole("button", { name: "닫기" }).click().catch(() => page.keyboard.press("Escape"));
  }

  await open("/library");
  await page.getByRole("heading", { name: "학습 라이브러리" }).waitFor();
  await snap("01-session-list");
  const sessionSearch = page.getByPlaceholder("세션, 학습 항목, 제출 내용 검색");
  await sessionSearch.fill("rotation");
  await page.waitForTimeout(100);
  if (await page.locator(".library-session-row").count() !== 1) failures.push(`${name}: submission body search did not narrow the session list`);
  else checks.push(`${name}: session title/item/submission payload search`);
  await sessionSearch.fill("검색되지않는문구");
  if (!(await page.getByText("조건에 맞는 학습 세션이 없어요.").count())) failures.push(`${name}: session search empty state missing`);
  await page.getByRole("button", { name: "검색 초기화" }).click();

  await open("/library/sessions/2026-07-23");
  await page.getByRole("heading", { name: /.+/ }).first().waitFor();
  await snap("02-session-detail");

  const teamRow = page.locator(".library-submission-list button:not([disabled])").filter({ hasNotText: "(나)" }).first();
  await teamRow.click();
  const warning = page.getByRole("heading", { name: "아직 내 학습을 완료하지 않았어요" });
  if (await warning.count()) {
    await warning.waitFor();
    await snap("03-pre-submission-warning");
    await page.getByRole("button", { name: "그래도 보기" }).click();
  } else {
    failures.push(`${name}: expected pre-submission warning did not open`);
  }
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  await snap("04-team-submission-review");
  await closeDialog();

  await open("/library?tab=documents");
  await page.getByRole("heading", { name: "팀 문서" }).waitFor();
  await snap("05-team-document-list");
  const documentSearch = page.getByPlaceholder("제목, 내용, 작성자 검색");
  await documentSearch.fill("이준호");
  await page.waitForTimeout(350);
  if (await page.locator(".team-document-list > a").count() !== 1) failures.push(`${name}: author search did not narrow the document list`);
  else checks.push(`${name}: document title/body/author search`);
  await documentSearch.fill("");
  await page.waitForTimeout(350);

  await open("/library/docs/new");
  await page.getByRole("heading", { name: "새 문서" }).waitFor();
  await page.getByPlaceholder("문서 제목").fill("라이브러리 QA 학습 노트");
  await page.getByPlaceholder("Markdown으로 학습 내용을 작성하세요.").fill("## 오늘의 핵심\n\n- 큐의 동작 원리\n- 시간 복잡도 비교\n\n> 팀과 함께 보완할 내용을 기록합니다.\n\n| 주제 | 핵심 |\n| --- | --- |\n| Queue | FIFO |\n\n```ts\nconst queue = [];\n```");
  await snap("06-document-new-edit");
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await snap("07-document-preview");

  await open("/library/docs/demo-doc-os");
  await page.getByRole("heading", { name: "운영체제 스케줄링 핵심 정리" }).waitFor();
  await snap("08-document-detail");
  await page.getByRole("link", { name: "편집" }).click();
  await page.getByRole("heading", { name: "문서 편집" }).waitFor();
  await snap("06b-document-edit");
  await open("/library/docs/demo-doc-os");
  await page.getByRole("button", { name: "문서 삭제" }).click();
  await page.getByRole("heading", { name: "이 문서를 삭제할까요?" }).waitFor();
  await snap("09-delete-dialog");
  await closeDialog();

  await open("/library/docs/demo-doc-algorithm");
  if (await page.getByRole("link", { name: "편집" }).count() || await page.getByRole("button", { name: "문서 삭제" }).count()) failures.push(`${name}: non-author document actions are visible`);
  else checks.push(`${name}: non-author actions hidden`);
  await open("/library/docs/demo-doc-algorithm/edit");
  if (!(await page.getByText("문서를 편집할 수 없어요.").count())) failures.push(`${name}: direct non-author edit route was not denied`);

  await open("/repository?document=demo-doc-os");
  await page.waitForURL("**/library/docs/demo-doc-os");
  if (!page.url().includes("/library/docs/demo-doc-os")) failures.push(`${name}: legacy document deep-link did not migrate`);

  await open("/schedule/2026-07-22");
  const libraryLink = page.getByRole("link", { name: /학습 결과 보기/ });
  if (!(await libraryLink.count())) failures.push(`${name}: completed schedule library link is missing`);
  else {
    await libraryLink.click();
    await page.waitForURL("**/library/sessions/2026-07-22");
    checks.push(`${name}: completed schedule opens the Library session route`);
  }

  await context.close();
}

await captureSet("desktop", { width: 1440, height: 1050 });
await captureSet("mobile", { width: 390, height: 844 });
await browser.close();

const result = { generatedAt: new Date().toISOString(), baseURL, screenshots: 20, checks, failures, consoleErrors };
await fs.writeFile(path.join(outputRoot, "qa-results.json"), JSON.stringify(result, null, 2));
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (failures.length || consoleErrors.length) process.exitCode = 1;
