import { expect, test, type Page } from "@playwright/test";

function captureUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openWorkspacePage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("Workspace release smoke", () => {
  test("오늘 페이지에서 활동함, 팀 피드, 제출 흐름이 이어진다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/today");

    await expect(page.getByRole("heading", { name: "오늘 함께 공부하기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "공지와 팀 대화" })).toBeVisible();

    await page.getByRole("button", { name: /활동함 열기/ }).click();
    const inbox = page.getByRole("dialog", { name: "활동함" });
    await expect(inbox).toBeVisible();
    const inboxBox = await inbox.boundingBox();
    const viewport = page.viewportSize();
    expect(inboxBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(inboxBox!.x).toBeGreaterThan(viewport!.width / 2);
    await inbox.getByRole("button", { name: "활동함 닫기" }).click();
    await expect(inbox).toBeHidden();

    const message = "E2E: 오늘 학습 흐름을 확인했습니다.";
    await page.getByPlaceholder("질문, 회의 메모, 짧은 응원을 남겨보세요.").fill(message);
    await page.getByRole("button", { name: "보내기" }).click();
    await expect(page.getByText(message)).toBeVisible();

    await page.getByRole("button", { name: "제출", exact: true }).click();
    await expect(page.getByRole("heading", { name: "학습 항목 제출" })).toBeVisible();
    await page.getByRole("textbox", { name: "제출 링크" }).fill("https://example.com/e2e-process");
    await page.getByRole("button", { name: "이 항목 제출" }).click();

    await expect(page.getByRole("heading", { name: "오늘 필수 학습을 모두 마쳤어요" })).toBeVisible();
    await expect(page.getByText("https://example.com/e2e-process")).toBeVisible();
    await expect(page.getByText("6/6건 제출 · 3/3명 완료")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("학습 라이브러리에서 팀 문서를 만들고 작성자 권한을 구분한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/repository");
    await page.getByRole("button", { name: "팀 문서" }).click();

    await expect(page.getByRole("region", { name: "팀 문서" })).toBeVisible();
    await page.getByRole("button", { name: "새 문서" }).click();
    await page.getByPlaceholder("문서 제목", { exact: true }).fill("E2E 릴리스 점검 노트");
    await page.getByPlaceholder("Markdown으로 학습 내용을 작성하세요.").fill(
      "## 확인 결과\n\n- [x] 팀 문서 저장\n- [x] Markdown 미리보기",
    );
    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(page.getByRole("heading", { name: "확인 결과" })).toBeVisible();
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByRole("heading", { name: "E2E 릴리스 점검 노트" })).toBeVisible();
    await expect(page.getByRole("button", { name: "편집" })).toBeVisible();
    await page.locator(".library-document-nav").getByRole("button", { name: "팀 문서" }).click();

    await page.getByRole("button", { name: /큐 문제를 풀 때 확인할 패턴/ }).click();
    await expect(page.getByText("읽기 전용")).toBeVisible();
    await expect(page.getByRole("button", { name: "편집" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("일정 검색과 설정 화면은 외부 API 오류 없이 동작한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/schedule");
    await page.getByRole("searchbox", { name: "일정 검색" }).fill("영어");
    await expect(page.getByRole("heading", { name: "영어 표현과 듣기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "큐와 배열 집중 학습" })).toHaveCount(0);

    await openWorkspacePage(page, "/settings");
    await expect(page.getByRole("heading", { name: "저장소 연결" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workspace 멤버" })).toBeVisible();
    await page.getByRole("button", { name: /활동함 열기/ }).click();
    await expect(page.getByRole("dialog", { name: "활동함" })).toBeVisible();
    await page.getByRole("dialog", { name: "활동함" }).getByRole("button", { name: "활동함 닫기" }).click();
    expect(errors).toEqual([]);
  });
});
