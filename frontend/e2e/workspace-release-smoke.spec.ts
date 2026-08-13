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
  test("오늘 페이지에서 활동함과 공통 제출 흐름이 이어진다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/today");

    await expect(page.getByRole("heading", { name: "오늘 함께 공부하기" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "오늘 학습 계획" })).toBeVisible();
    await expect(page.locator(".today-focus__progress")).toContainText("1 / 2 완료");
    await expect(page.locator(".today-focus__progress")).not.toContainText("50%");
    await expect(page.locator(".today-team-list")).not.toContainText("최근 제출");

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

    await page.getByRole("button", { name: "계속 학습하기" }).click();
    await expect(page.getByRole("heading", { name: "학습 항목 제출" })).toBeVisible();
    await page.getByRole("textbox", { name: "제출 링크" }).fill("https://example.com/e2e-process");
    await page.getByRole("button", { name: "제출하기" }).click();

    await expect(page.getByRole("button", { name: "내 제출 보기" })).toBeVisible();
    await expect(page.getByText("2 / 2 완료")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("학습 라이브러리에서 팀 문서를 만들고 작성자 권한을 구분한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/library");
    await expect(page.locator(".library-session-list")).not.toContainText("최근 업데이트");
    await page.getByRole("tab", { name: "팀 문서" }).click();

    await expect(page.getByRole("region", { name: "팀 문서" })).toBeVisible();
    await page.getByRole("link", { name: "새 문서" }).click();
    await page.getByPlaceholder("문서 제목", { exact: true }).fill("E2E 릴리스 점검 노트");
    await page.getByPlaceholder("Markdown으로 학습 내용을 작성하세요.").fill(
      "## 확인 결과\n\n- [x] 팀 문서 저장\n- [x] Markdown 미리보기",
    );
    await page.getByRole("button", { name: "미리보기" }).click();
    await expect(page.getByRole("heading", { name: "확인 결과" })).toBeVisible();
    await page.getByRole("button", { name: "저장" }).click();

    await expect(page.getByRole("heading", { name: "E2E 릴리스 점검 노트" })).toBeVisible();
    await expect(page.getByRole("link", { name: "편집" })).toBeVisible();
    await page.getByRole("link", { name: "팀 문서" }).click();

    await page.getByRole("link", { name: /큐 문제를 풀 때 확인할 패턴/ }).click();
    await expect(page.getByRole("heading", { name: "큐 문제를 풀 때 확인할 패턴" })).toBeVisible();
    await expect(page.getByRole("link", { name: "편집" })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("일정 검색과 설정 화면은 외부 API 오류 없이 동작한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/schedule");
    await page.getByRole("searchbox", { name: "일정 또는 학습 항목 검색" }).fill("영어");
    await expect(page.getByText("영어 표현과 듣기", { exact: true })).toBeVisible();
    await expect(page.getByText("큐와 배열 집중 학습", { exact: true })).toHaveCount(0);

    await openWorkspacePage(page, "/settings");
    await expect(page.getByRole("heading", { name: "Workspace 일반" })).toBeVisible();
    await page.getByRole("link", { name: "저장소 연결" }).click();
    await expect(page.getByRole("heading", { name: "저장소 연결" })).toBeVisible();
    await page.getByRole("link", { name: "멤버", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Workspace 멤버" })).toBeVisible();
    await page.getByRole("button", { name: /활동함 열기/ }).click();
    await expect(page.getByRole("dialog", { name: "활동함" })).toBeVisible();
    await page.getByRole("dialog", { name: "활동함" }).getByRole("button", { name: "활동함 닫기" }).click();
    expect(errors).toEqual([]);
  });

  test("일정 목록은 날짜 그룹과 핵심 정보를 명확한 행으로 제공한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/schedule");
    await page.getByRole("button", { name: "목록" }).click();

    const agenda = page.getByRole("region", { name: "일정 목록" });
    await expect(agenda).toBeVisible();
    await expect(agenda.locator(".schedule-date-group")).toHaveCount(4);
    await expect(agenda.getByRole("heading", { name: "7월 23일 (목)" })).toBeVisible();
    await expect(agenda.getByText("오늘", { exact: true })).toHaveCount(1);

    const row = agenda.locator(".schedule-list-row").filter({ hasText: "큐와 배열 집중 학습" });
    await expect(row.locator(".schedule-list-row__primary > strong")).toHaveText("큐와 배열 집중 학습");
    await expect(row.locator(".schedule-list-row__progress")).toContainText("내 진행");
    await expect(row.locator(".schedule-list-row__change")).toHaveText("변경됨");
    await expect(row.locator(".schedule-list-row__chevron")).toBeVisible();

    await row.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(row).toBeFocused();
    const focusOutline = await row.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(focusOutline).not.toBe("none");

    await page.setViewportSize({ width: 390, height: 844 });
    const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });

  test("일정 편집 하단바는 문서 끝에서도 viewport 하단에 붙어 있다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await openWorkspacePage(page, "/schedule/2026-07-23/edit");
      await page.getByRole("button", { name: /다음 단계/ }).click();
      await page.locator("#editor-items-title").waitFor();

      const headingMetrics = await page
        .locator(".editor-items__heading > .editor-step__heading")
        .evaluate((heading) => {
          const icon = heading.querySelector(":scope > span");
          const copy = heading.querySelector(":scope > div");
          if (!(icon instanceof HTMLElement) || !(copy instanceof HTMLElement)) {
            throw new Error("Schedule editor item heading is incomplete");
          }
          const iconRect = icon.getBoundingClientRect();
          const copyRect = copy.getBoundingClientRect();
          return {
            flexDirection: getComputedStyle(heading).flexDirection,
            horizontalGap: Math.round(copyRect.left - iconRect.right),
            centerDelta: Math.round(
              Math.abs((iconRect.top + iconRect.bottom) / 2 - (copyRect.top + copyRect.bottom) / 2),
            ),
          };
        });
      expect(headingMetrics.flexDirection).toBe("row");
      expect(headingMetrics.horizontalGap).toBeGreaterThanOrEqual(0);
      expect(headingMetrics.centerDelta).toBeLessThanOrEqual(2);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

      const footerMetrics = await page.locator(".schedule-editor-page .session-editor__footer").evaluate((footer) => {
        const rect = footer.getBoundingClientRect();
        return {
          bottomGap: Math.round(window.innerHeight - rect.bottom),
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      expect(footerMetrics.bottomGap).toBeLessThanOrEqual(1);
      expect(footerMetrics.horizontalOverflow).toBe(false);
    }

    expect(errors).toEqual([]);
  });

  test("선행 제출 경고와 공통 리뷰 흐름이 모든 진입에서 유지된다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/library/sessions/2026-07-23");
    await page.getByRole("button", { name: /이준호.*제출 내용과 리뷰 보기/ }).click();
    const warning = page.getByRole("dialog", { name: "아직 내 학습을 완료하지 않았어요" });
    await expect(warning).toBeVisible();
    await warning.getByRole("button", { name: "그래도 보기" }).click();
    await expect(page.getByRole("dialog", { name: /이준호.*제출/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Workspace 전환과 404 상태가 현재 제품 경계를 지킨다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/today");
    await page.locator(".workspace-picker__button").click();
    await page.getByRole("menuitemradio", { name: /CS 원서 읽기/ }).click();
    await expect(page.locator(".workspace-picker__button")).toContainText("CS 원서 읽기");

    await openWorkspacePage(page, "/definitely-not-a-study-route");
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없어요." })).toBeVisible();
    await expect(page.getByRole("link", { name: "홈으로" })).toBeVisible();
    expect(errors.filter((error) => !error.includes("404"))).toEqual([]);
  });

	 test("GitHub linking capability가 꺼진 배포에서는 Settings 밖에 GitHub UI가 없다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await openWorkspacePage(page, "/settings/accounts");
		await expect(page.getByRole("heading", { name: "연결된 계정" })).toBeVisible();
		await expect(page.getByText("GitLab 계정", { exact: true })).toBeVisible();
		await expect(page.getByText("GitHub 계정", { exact: true })).toHaveCount(0);

		await openWorkspacePage(page, "/login");
		await expect(page.getByRole("link", { name: /GitLab로 계속하기/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
		expect(errors).toEqual([]);
	});

	test("모바일 연결된 계정 Row는 가로 overflow 없이 stack된다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await page.setViewportSize({ width: 390, height: 844 });
		await openWorkspacePage(page, "/settings/accounts");
		const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
		expect(bodyWidth).toBeLessThanOrEqual(390);
		await expect(page.getByText("GitLab 계정", { exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	});

  test("공통 Motion은 route와 overlay의 open/close 상태를 설명한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/today");

    await page.getByRole("link", { name: "일정", exact: true }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    const routeAnimation = await page.locator(".motion-page").evaluate((element) => getComputedStyle(element).animationName);
    expect(routeAnimation).toContain("motion-page-enter");

    await openWorkspacePage(page, "/today");
    await page.getByRole("button", { name: /계속 학습하기/ }).click();
    const modalLayer = page.locator(".modal-layer");
    await expect(modalLayer).toHaveAttribute("data-motion-state", "open");
    const modalBounds = await modalLayer.boundingBox();
    const modalViewport = page.viewportSize();
    expect(modalBounds).not.toBeNull();
    expect(modalViewport).not.toBeNull();
    expect(modalBounds!.x).toBe(0);
    expect(modalBounds!.y).toBe(0);
    expect(modalBounds!.width).toBe(modalViewport!.width);
    expect(modalBounds!.height).toBe(modalViewport!.height);
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(modalLayer).toHaveAttribute("data-motion-state", "closing");
    await expect(modalLayer).toBeHidden();

    await page.getByRole("button", { name: /활동함 열기/ }).click();
    const drawerLayer = page.locator(".activity-inbox-layer");
    await expect(drawerLayer).toHaveAttribute("data-motion-state", "open");
    await page.getByRole("dialog", { name: "활동함" }).getByRole("button", { name: "활동함 닫기" }).click();
    await expect(drawerLayer).toHaveAttribute("data-motion-state", "closing");
    await expect(drawerLayer).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("reduced motion에서는 이동 animation이 사실상 제거된다", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openWorkspacePage(page, "/today");
    const duration = await page.locator(".motion-page").evaluate((element) => getComputedStyle(element).animationDuration);
    expect(duration).toBe("0.001s");
  });

  test("OAuth callback은 Profile, Workspace, returnTo 목적지를 그대로 보존한다", async ({ browser }) => {
    for (const target of [
      "/onboarding/profile?returnTo=%2Ftoday",
      "/workspaces",
      "/library/sessions/2026-07-23?member=12",
    ]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "oauth-routing-test", headerName: "X-CSRF-TOKEN" }),
      }));
      await page.route("**/api/v1/auth/gitlab/complete", (route) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ returnUrl: target }),
      }));

      const destination = new URL(target, "http://localhost:3110");
      const forwarded = page.waitForRequest((request) => {
        const url = new URL(request.url());
        return url.pathname === destination.pathname && url.search === destination.search;
      });
      await page.goto("/auth/callback");
      await forwarded;
      await context.close();
    }
  });
});
