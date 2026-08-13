import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "../frontend/node_modules/playwright/index.mjs";

const baseURL = process.env.CAPTURE_BASE_URL ?? "https://sandbox.withroro.com";
const outputRoot = process.env.CAPTURE_OUTPUT ?? "/home/roro/devai/data/generated/study-platform-feedback-20260811";
const rawDir = path.join(outputRoot, "raw");
const boardDir = path.join(outputRoot, "boards");
const executablePath = process.env.CHROMIUM_PATH ?? "/home/roro/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell";

await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(boardDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
});
const page = await context.newPage();
page.setDefaultTimeout(10_000);

const boards = new Map();
const failures = [];

function addBoard(board, label, filename) {
  const entries = boards.get(board) ?? [];
  entries.push({ label, filename });
  boards.set(board, entries);
}

async function stabilize() {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  }).catch(() => {});
  await page.evaluate(async () => {
    const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    for (let y = 0; y < max; y += 700) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    window.scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForTimeout(250);
}

async function open(route) {
  await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  await stabilize();
}

async function snap(board, label, slug, fullPage = false) {
  const filename = `${slug}.png`;
  await page.screenshot({ path: path.join(rawDir, filename), fullPage });
  addBoard(board, label, filename);
  process.stdout.write(`captured ${board}: ${label}\n`);
}

async function step(name, run) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, message });
    process.stderr.write(`skipped ${name}: ${message.split("\n")[0]}\n`);
  }
}

async function closeDialog() {
  const dialog = page.getByRole("dialog").last();
  if (await dialog.count()) {
    await dialog.getByRole("button", { name: "닫기", exact: true }).click().catch(async () => {
      await page.keyboard.press("Escape");
    });
    await page.waitForTimeout(150);
  }
}

// Public routes.
for (const [route, label, slug] of [
  ["/", "랜딩 페이지", "public-01-landing"],
  ["/login", "로그인", "public-02-login"],
  ["/terms", "이용약관", "public-03-terms"],
  ["/privacy", "개인정보 처리 안내", "public-04-privacy"],
]) {
  await step(label, async () => {
    await open(route);
    await snap("01-public", label, slug, true);
  });
}

// Today page and its dialogs.
await open("/today");
await snap("02-today", "오늘 — 기본 화면", "today-01-default", true);
await step("오늘 제출 모달", async () => {
  await page.getByRole("button", { name: /계속 학습하기|학습 시작하기|내 제출 보기/ }).click();
  await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
  await snap("02-today", "학습 항목 제출 모달", "today-02-submission");
  await closeDialog();
});
await step("오늘 열람 경고와 멤버 상세", async () => {
  await page.locator(".today-team-list button").filter({ hasNotText: "(나)" }).first().click();
  await page.getByRole("heading", { name: "아직 내 학습을 완료하지 않았어요" }).waitFor();
  await snap("02-today", "팀원 답안 열람 경고", "today-03-warning");
  await page.getByRole("button", { name: "그래도 보기" }).click();
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  await snap("02-today", "팀원 제출 상세·리뷰 모달", "today-04-member-detail");
  await closeDialog();
});

// Schedule page, editor, detail, submission and nested member review.
await open("/schedule");
await snap("03-schedule", "일정 — 기본 화면", "schedule-01-default", true);
await step("새 일정 모달", async () => {
  await page.getByRole("button", { name: "새 일정" }).click();
  await page.getByRole("heading", { name: "새 학습 일정 만들기" }).waitFor();
  await snap("03-schedule", "새 학습 일정 — 기본 정보", "schedule-02-create");
  await closeDialog();
});
await step("일정 편집 모달", async () => {
  await page.getByRole("button", { name: "편집", exact: true }).nth(1).click();
  await page.getByRole("heading", { name: "학습 일정 편집" }).waitFor();
  await snap("03-schedule", "학습 일정 편집", "schedule-03-edit");
  await closeDialog();
});
await step("일정 상세와 제출 모달", async () => {
  await page.getByRole("button", { name: "상세", exact: true }).first().click();
  await page.getByRole("dialog").waitFor();
  await snap("03-schedule", "일정 상세", "schedule-04-detail");
  const submission = page.getByRole("dialog").getByRole("button", { name: /제출하기|제출 수정/ }).first();
  if (await submission.count()) {
    await submission.click();
    await page.getByRole("heading", { name: "학습 항목 제출" }).waitFor();
    await snap("03-schedule", "일정 상세에서 제출", "schedule-05-submission");
    await closeDialog();
  } else {
    await closeDialog();
  }
});
await step("일정 상세 멤버 리뷰", async () => {
  await page.getByRole("button", { name: "상세", exact: true }).nth(1).click();
  const review = page.getByRole("dialog").getByRole("button").filter({ hasText: "리뷰 보기" }).first();
  await review.click();
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  await snap("03-schedule", "일정 상세의 팀 제출 리뷰", "schedule-06-member-review");
  await closeDialog();
  await closeDialog();
});

// Records page, score and member details.
await open("/records");
await snap("04-records", "기록 — 기본 화면", "records-01-default", true);
await step("점수 상세 모달", async () => {
  await page.getByRole("button", { name: /내 점수와 멤버 순위 보기/ }).click();
  await page.getByRole("heading", { name: "점수 상세" }).waitFor();
  await snap("04-records", "점수 상세·멤버 순위", "records-02-score");
  await closeDialog();
});
await step("기록 멤버 상세", async () => {
  await page.getByRole("button", { name: /2026년 7월 23일.*83%/ }).first().click();
  await page.locator(".record-detail__members button:not([disabled])").first().click();
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  await snap("04-records", "날짜별 멤버 제출·리뷰", "records-03-member-detail");
  await closeDialog();
});

// Repository session archive and team documents.
await open("/repository");
await snap("05-repository", "라이브러리 — 세션 아카이브", "repository-01-sessions", true);
await step("세션 문서와 열람 경고", async () => {
  await page.locator(".library-session-card").nth(1).click();
  await snap("05-repository", "세션 학습 문서", "repository-02-session-document", true);
  await page.locator(".library-member-notes button:not([disabled])").filter({ hasNotText: "(나)" }).first().click();
  await page.getByRole("heading", { name: "내 제출 전에 팀원의 답을 볼까요?" }).waitFor();
  await snap("05-repository", "팀원 답안 열람 경고", "repository-03-warning");
  await page.getByRole("button", { name: "그래도 보기" }).click();
  await page.getByRole("heading", { name: /의 제출$/ }).waitFor();
  await snap("05-repository", "팀원 제출 상세·리뷰", "repository-04-member-detail");
  await closeDialog();
});
await open("/repository");
await step("팀 문서 목록과 작성 화면", async () => {
  await page.getByRole("button", { name: "팀 문서", exact: true }).click();
  await page.getByRole("region", { name: "팀 문서" }).waitFor();
  await page.waitForTimeout(500);
  await snap("05-repository", "팀 문서 목록", "repository-05-documents", true);
  await page.getByRole("button", { name: "새 문서" }).click();
  await page.getByPlaceholder("문서 제목", { exact: true }).fill("피드백용 학습 노트");
  await page.getByPlaceholder("Markdown으로 학습 내용을 작성하세요.").fill("## 오늘의 핵심\n\n- 큐의 동작 원리\n- 복잡도 비교\n\n> 팀과 함께 보완할 내용을 기록합니다.");
  await snap("05-repository", "새 팀 문서 작성", "repository-06-create-document");
  await page.getByRole("button", { name: "미리보기" }).click();
  await snap("05-repository", "팀 문서 Markdown 미리보기", "repository-07-preview-document");
  await page.getByRole("button", { name: /문서 만들기 취소/ }).click();
});
await step("팀 문서 상세와 삭제 확인", async () => {
  const owned = page.getByRole("button", { name: /내가 만든 문서/ }).first();
  if (!(await owned.count())) throw new Error("작성자가 현재 사용자인 기존 팀 문서가 없습니다.");
  await owned.click();
  await snap("05-repository", "내가 만든 팀 문서 상세", "repository-08-owned-document", true);
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page.getByRole("heading", { name: "팀 문서를 삭제할까요?" }).waitFor();
  await snap("05-repository", "팀 문서 삭제 확인", "repository-09-delete-document");
  await closeDialog();
});

// Settings and destructive/migration confirmations.
await page.route("**/api/v1/workspaces/*/repository-schema/migration", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      currentSchemaVersion: 1,
      targetSchemaVersion: 2,
      currentBasePath: "",
      targetBasePath: ".study-workspace/sessions",
      treeFingerprint: "capture-only-preview",
      sessionFiles: 4,
      submissionFiles: 9,
      totalMoves: 13,
      ready: true,
      moves: [
        { sourcePath: "260721/session.json", targetPath: ".study-workspace/sessions/260721/session.json", type: "SESSION" },
        { sourcePath: "260721/member-a.md", targetPath: ".study-workspace/sessions/260721/submissions/member-a.md", type: "SUBMISSION" },
        { sourcePath: "260722/session.json", targetPath: ".study-workspace/sessions/260722/session.json", type: "SESSION" },
        { sourcePath: "260722/member-b.md", targetPath: ".study-workspace/sessions/260722/submissions/member-b.md", type: "SUBMISSION" },
        { sourcePath: "260723/session.json", targetPath: ".study-workspace/sessions/260723/session.json", type: "SESSION" },
        { sourcePath: "260723/member-c.md", targetPath: ".study-workspace/sessions/260723/submissions/member-c.md", type: "SUBMISSION" },
      ],
      blockers: [],
    }),
  });
});
await open("/settings");
await snap("06-settings", "설정 — 전체 화면", "settings-01-default", true);
await step("저장 구조 정리 모달", async () => {
  await page.getByRole("button", { name: "저장 구조 정리" }).click();
  await page.getByRole("heading", { name: "GitLab 저장 구조를 정리할까요?" }).waitFor({ timeout: 15_000 });
  await snap("06-settings", "GitLab 저장 구조 정리 확인", "settings-02-migration");
  await closeDialog();
});
await step("계정 탈퇴 모달", async () => {
  await page.getByRole("button", { name: "계정 탈퇴", exact: true }).click();
  await page.getByRole("heading", { name: "Study-ing 계정을 탈퇴할까요?" }).waitFor();
  await snap("06-settings", "계정 탈퇴 확인", "settings-03-account-delete");
  await closeDialog();
});
await step("Workspace 삭제 모달", async () => {
  await page.getByRole("button", { name: "소프트 삭제" }).click();
  await page.getByRole("heading", { name: "Workspace를 삭제할까요?" }).waitFor();
  await snap("06-settings", "Workspace 소프트 삭제 확인", "settings-04-workspace-delete");
  await closeDialog();
});

// Shared shell overlays.
await open("/today");
await step("Workspace 선택 메뉴", async () => {
  await page.locator(".workspace-picker__button").click();
  await snap("07-common", "Workspace 선택 메뉴", "common-01-workspace-menu");
  await page.locator(".workspace-picker__button").click();
});
await step("활동함", async () => {
  await page.getByRole("button", { name: /활동함 열기/ }).click();
  await page.getByRole("dialog", { name: "활동함" }).waitFor();
  await snap("07-common", "활동함 패널", "common-02-activity-inbox");
  await page.getByRole("dialog", { name: "활동함" }).getByRole("button", { name: "활동함 닫기" }).click();
});
await step("계정 메뉴와 프로필 설정", async () => {
  await page.locator(".account-row").click();
  await snap("07-common", "계정·테마 메뉴", "common-03-account-menu");
  await page.getByRole("menuitem", { name: /프로필 설정/ }).click();
  await page.getByRole("heading", { name: "프로필 설정" }).waitFor();
  await snap("07-common", "프로필 설정 모달", "common-04-profile-settings");
  await closeDialog();
});
await step("모바일 메뉴", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/today`, { waitUntil: "networkidle" });
  await page.locator('.mobile-header button[aria-label="메뉴 열기"]').click();
  await snap("07-common", "모바일 내비게이션", "common-05-mobile-drawer");
  await page.setViewportSize({ width: 1440, height: 1100 });
});

// Render exact screenshot contact sheets in the browser so no visual content is regenerated.
const boardPage = await context.newPage();
await boardPage.setViewportSize({ width: 1520, height: 1000 });
const boardNames = {
  "01-public": "공개 페이지 — 랜딩·로그인·정책",
  "02-today": "오늘 — 학습·제출·팀 리뷰",
  "03-schedule": "일정 — 생성·편집·상세·제출",
  "04-records": "기록 — 현황·점수·멤버 상세",
  "05-repository": "학습 라이브러리 — 세션·팀 문서",
  "06-settings": "설정 — 저장소·계정·삭제 확인",
  "07-common": "공통 UI — Workspace·활동함·계정·모바일",
};

for (const [board, entries] of boards) {
  const sections = [];
  for (const entry of entries) {
    const bytes = await fs.readFile(path.join(rawDir, entry.filename));
    sections.push(`<section><h2>${entry.label}</h2><img src="data:image/png;base64,${bytes.toString("base64")}" /></section>`);
  }
  await boardPage.setContent(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} html,body{margin:0;background:#e9edf4;color:#172033;font-family:"Noto Sans CJK KR",sans-serif}
    body{width:1520px;padding:40px} header{padding:30px 34px;margin-bottom:28px;border-radius:20px;background:#111a2e;color:white}
    header p{margin:0 0 8px;color:#aebbd4;font-size:16px;font-weight:700;letter-spacing:.12em} header h1{margin:0;font-size:32px}
    section{margin:0 0 32px;border:1px solid #cbd3df;border-radius:18px;background:white;overflow:hidden;box-shadow:0 8px 28px rgba(31,44,72,.10)}
    h2{margin:0;padding:17px 24px;border-bottom:1px solid #dce2eb;background:#f8fafc;font-size:21px}
    img{display:block;width:1440px;height:auto}
  </style></head><body><header><p>STUDY-ING PLATFORM · FEEDBACK CAPTURE</p><h1>${boardNames[board]}</h1></header>${sections.join("")}</body></html>`, { waitUntil: "load" });
  await boardPage.screenshot({ path: path.join(boardDir, `${board}.png`), fullPage: true });
  process.stdout.write(`board ${boardDir}/${board}.png\n`);
}

await fs.writeFile(path.join(outputRoot, "manifest.json"), JSON.stringify({
  baseURL,
  capturedAt: new Date().toISOString(),
  boards: Object.fromEntries(boards),
  failures,
}, null, 2));

await browser.close();

if (failures.length) {
  process.stderr.write(`completed with ${failures.length} skipped states; see manifest.json\n`);
  process.exitCode = 2;
} else {
  process.stdout.write("all requested states captured\n");
}
