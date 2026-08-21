import { expect, test, type Page } from "@playwright/test";
import { initialWorkspaces } from "../lib/data/seed";

function captureUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openWorkspacePage(page: Page, path: string) {
  const publicPath = ["/", "/login", "/auth/callback", "/terms", "/privacy", "/demo"]
    .some((candidate) => path === candidate || path.startsWith(`${candidate}?`));
  if (publicPath) {
    await page.goto(path);
  } else {
    await page.goto(`/demo?returnTo=${encodeURIComponent(path)}`);
    await page.waitForURL((url) => `${url.pathname}${url.search}` === path, { timeout: 7_000 });
  }
  await page.waitForLoadState("networkidle");
}

async function mockAuthenticatedWorkspace(page: Page) {
  await page.route("**/api/v1/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: "[]",
  }));
  await page.route("**/api/v1/auth/me", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      authenticated: true,
      identityProvider: "GITLAB",
      user: {
        id: "study-user-a",
        legacyGitLabUserId: 101,
        username: "gitlab-user-a",
        name: "김서연",
        profileCompleted: true,
        repositoryFileName: "member-a.md",
        timezone: "Asia/Seoul",
        themeMode: "LIGHT",
        accentColor: "PURPLE",
      },
    }),
  }));
  await page.route("**/api/v1/workspaces", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(initialWorkspaces),
  }));
  await page.route("**/api/v1/me/provider-accounts", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([{
      id: "gitlab-account",
      provider: "GITLAB",
      externalUserId: "101",
      username: "gitlab-user-a",
      displayName: "김서연",
      avatarUrl: null,
      webUrl: null,
      status: "CONNECTED",
    }]),
  }));
  await page.route("**/api/v1/capabilities", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      authProviders: ["GITLAB", "GITHUB"],
      accountLinkProviders: ["GITLAB", "GITHUB"],
      repositoryProviders: ["GITLAB"],
      features: { workspaceDiscovery: true },
    }),
  }));
  await page.route("**/api/v1/repositories/GITLAB/48213", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provider: "GITLAB",
        externalId: "48213",
        name: "evening-workspace",
        fullName: "study-team/evening-workspace",
        visibility: "private",
        defaultBranch: "main",
        webUrl: null,
        capabilities: { canRead: true, canWrite: true, canManage: true },
        providerPermission: "40",
        connectionState: "AVAILABLE",
      }),
    });
  });
}

test.describe("Workspace release smoke", () => {
  test("demo data is available only after the explicit demo entry", async ({ browser }) => {
    const context = await browser.newContext();
    const realPage = await context.newPage();
    await realPage.route("**/api/v1/auth/me", (route) => route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "AUTH_REQUIRED", message: "GitLab 로그인이 필요합니다." }),
    }));
    await realPage.goto("/today");
    await expect(realPage).toHaveURL(/\/login\?oauthError=session_expired/);
    await expect(realPage.getByRole("heading", { name: "Study-ing 시작하기" })).toBeVisible();

    const demoPage = await context.newPage();
    await demoPage.goto("/");
    await demoPage.getByRole("link", { name: "데모 둘러보기" }).first().click();
    await expect(demoPage.getByText("데모 페이지를 준비하고 있어요")).toBeVisible();
    await expect(demoPage).toHaveURL(/\/today$/);
    await expect(demoPage.getByRole("heading", { name: "오늘 함께 공부하기" })).toBeVisible();
    await expect(demoPage.getByText("저녁 스터디").first()).toBeVisible();
    await context.close();
  });

  test("demo entry reuses the branded loading screen for at least 2.5 seconds", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      window.localStorage.setItem("study-workspace-theme", JSON.stringify({ themeMode: "DARK", accentColor: "PURPLE" }));
    });
    await page.goto("/demo?returnTo=%2Fschedule");
    const loadingStatus = page.getByRole("status");
    await expect(loadingStatus).toContainText("데모 페이지를 준비하고 있어요");
    await expect(page.getByText("잠시만 기다려주세요.")).toBeVisible();
    await expect(loadingStatus).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await page.waitForTimeout(2_000);
    await expect(page).toHaveURL(/\/demo\?/);
    await expect(page).toHaveURL(/\/schedule$/, { timeout: 2_000 });
    await expect(page.locator(".app-frame")).toHaveAttribute("data-theme", "light");
    expect(errors).toEqual([]);
  });

  test("demo workspace and settings never request or render authenticated account data", async ({ page }) => {
    test.setTimeout(60_000);
    const apiRequests: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      apiRequests.push(`${route.request().method()} ${url.pathname}`);

      if (url.pathname === "/api/v1/capabilities") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            authProviders: ["GITLAB", "GITHUB"],
            accountLinkProviders: ["GITLAB", "GITHUB"],
            repositoryProviders: ["GITLAB"],
            features: { workspaceDiscovery: true },
          }),
        });
        return;
      }

      if (url.pathname === "/api/v1/repositories") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{
            provider: "GITLAB",
            externalId: "actual-private-repository",
            name: "ACTUAL_PRIVATE_REPOSITORY_SENTINEL",
            fullName: "actual-user/private-repository",
            visibility: "private",
            defaultBranch: "main",
            webUrl: "https://gitlab.example/actual-user/private-repository",
            capabilities: { canRead: true, canWrite: true, canManage: true },
            providerPermission: "40",
            connectionState: "AVAILABLE",
          }]),
        });
        return;
      }

      if (url.pathname === "/api/v1/me/provider-accounts") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{
            id: "actual-provider-account",
            provider: "GITLAB",
            externalUserId: "actual-user",
            username: "ACTUAL_ACCOUNT_SENTINEL",
            displayName: "Actual Account",
            avatarUrl: null,
            webUrl: null,
            status: "CONNECTED",
          }]),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/demo?returnTo=%2Fworkspaces%2Fnew");
    await expect(page).toHaveURL(/\/workspaces\/new$/, { timeout: 5_000 });
    await expect(page.getByText("데모 알고리즘 연습")).toBeVisible();
    await expect(page.getByText("ACTUAL_PRIVATE_REPOSITORY_SENTINEL")).toHaveCount(0);

    await page.getByRole("option", { name: /데모 알고리즘 연습/ }).click();
    await page.getByRole("button", { name: "계속" }).click();
    await expect(page.getByText("연결할 수 있어요")).toBeVisible();
    await page.getByRole("button", { name: "계속" }).click();
    await expect(page.getByRole("heading", { name: "기본 정보" })).toBeVisible();
    await page.getByRole("button", { name: "계속" }).click();
    await expect(page.getByRole("heading", { name: "저장 방식", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Workspace 연결하기" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByText("데모 알고리즘 연습").first()).toBeVisible();

    await page.goto("/workspaces");
    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();

    for (const section of ["general", "study-rules", "commit-rules", "members", "notifications", "repository", "data", "profile", "accounts", "appearance", "security", "account", "danger"]) {
      await page.goto(`/settings/${section}`);
      await expect(page.getByRole("heading", { name: "설정", exact: true })).toBeVisible();
    }
    await expect(page.getByText("ACTUAL_ACCOUNT_SENTINEL")).toHaveCount(0);
    await page.goto("/settings/accounts");
    await expect(page.getByText("데모 계정", { exact: true })).toBeVisible();
    await expect(page.locator(".provider-account-row a")).toHaveCount(0);
    await page.goto("/settings/accounts?providerLink=github_collision");
    await expect(page.locator(".provider-link-result")).toHaveCount(0);
    await expect(page.locator("a[href*='provider-accounts']")).toHaveCount(0);
    await page.goto("/settings/account");
    await expect(page.getByRole("button", { name: "데모 계정" })).toBeDisabled();
    expect(apiRequests).toEqual([]);
  });

  test("demo remains local after every seed workspace is deleted and reconnected", async ({ page }) => {
    test.setTimeout(45_000);
    const apiRequests: string[] = [];
    await page.route("**/api/v1/**", async (route) => {
      apiRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "REAL_API_SENTINEL" }) });
    });

    await page.goto("/demo?returnTo=%2Fsettings%2Fdanger");
    await expect(page).toHaveURL(/\/settings\/danger$/, { timeout: 5_000 });

    for (let index = 0; index < initialWorkspaces.length; index += 1) {
      await page.getByRole("button", { name: "Workspace 삭제" }).click();
      const dialog = page.getByRole("dialog", { name: "Workspace를 삭제할까요?" });
      await dialog.getByRole("button", { name: "Workspace 삭제" }).click();
      await expect(dialog).toBeHidden();
      if (index < initialWorkspaces.length - 1) await page.goto("/settings/danger");
    }

    await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "새 Workspace 연결" }).click();
    await expect(page.getByRole("heading", { name: "새 Workspace 연결", exact: true })).toBeVisible();
    await page.getByRole("option", { name: /데모 알고리즘 연습/ }).click();
    await page.getByRole("button", { name: "계속" }).click();
    await expect(page.getByText("연결할 수 있어요")).toBeVisible();
    await page.getByRole("button", { name: "계속" }).click();
    await page.getByRole("button", { name: "계속" }).click();
    await page.getByRole("button", { name: "Workspace 연결하기" }).click();
    await page.goto("/settings/notifications");
    await page.getByRole("switch").first().click();
    await expect(page.getByText("변경사항은 즉시 저장되며")).toBeVisible();
    expect(apiRequests).toEqual([]);
  });

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
    await page.getByRole("searchbox", { name: "항목 검색" }).fill("영어");
    await expect(page.getByText("영어 영상 15분 듣기", { exact: true })).toBeVisible();
    await expect(page.getByText("행렬 테두리 회전하기", { exact: true })).toHaveCount(0);

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

  test("Workspace 커밋 규칙이 제출 기본 메시지와 안내 문구에 적용된다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/settings/commit-rules");

    await expect(page.getByRole("heading", { name: "커밋 규칙" })).toBeVisible();
    await page.getByRole("textbox", { name: "메시지 규칙" }).fill("custom: {name} / {date} / {item}");
    await page.getByRole("textbox", { name: "안내 문구" }).fill("팀 커밋 규칙에 맞는지 확인해 주세요.");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("모든 변경사항이 저장되었습니다.")).toBeVisible();

    await page.getByRole("link", { name: "오늘", exact: true }).click();
    await expect(page).toHaveURL(/\/today$/);
    await page.getByRole("button", { name: "계속 학습하기" }).click();
    await page.getByText("GitLab 저장 정보", { exact: true }).click();
    await expect(page.getByRole("textbox", { name: "커밋 메시지" })).toHaveValue(
      "custom: 김서연 / 2026-07-23 / 프로세스",
    );
    await expect(page.getByText("팀 커밋 규칙에 맞는지 확인해 주세요.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(horizontalOverflow).toBe(false);
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

    const row = agenda.locator(".schedule-list-row").filter({ hasText: "행렬 테두리 회전하기" });
    await expect(row.locator(".schedule-list-row__primary > strong")).toHaveText("행렬 테두리 회전하기");
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

  test("월 달력은 같은 날짜의 항목을 각각 표시하고 편집기는 체크·시간 항목을 추가한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/schedule");

    await expect(page.getByTitle("제출: 오늘의 표현 10개")).toBeVisible();
    await expect(page.getByTitle("제출: 영어 영상 15분 듣기")).toBeVisible();
    await expect(page.getByTitle("제출: 한 문단 요약")).toBeVisible();

    await openWorkspacePage(page, "/schedule/2026-07-23/edit");
    await expect(page.getByLabel("일정 제목")).toHaveCount(0);
    await page.getByRole("button", { name: /다음 단계/ }).click();
    await page.getByRole("button", { name: "체크", exact: true }).click();
    await page.getByRole("button", { name: "시간", exact: true }).click();

    await expect(page.getByRole("option", { name: "체크형" }).last()).toBeAttached();
    await expect(page.getByRole("option", { name: "시간형" }).last()).toBeAttached();
    await expect(page.getByLabel("시작 시간")).toHaveValue("19:00");
    await expect(page.getByLabel("종료 시간")).toHaveValue("20:00");
    expect(errors).toEqual([]);
  });

  test("항목 추가에서 기존 일정 날짜를 선택하면 신규 생성 대신 해당 날짜 편집으로 전환한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/schedule/new");

    await page.locator('input[type="date"]').fill("2026-07-23");
    await page.getByRole("button", { name: /다음 단계/ }).click();

    await expect(page).toHaveURL(/\/schedule\/2026-07-23\/edit\?step=items$/);
    await expect(page.getByRole("heading", { name: "하루 계획 편집" })).toBeVisible();
    await expect(page.locator("#editor-items-title")).toBeVisible();
    await expect(page.getByText("행렬 테두리 회전하기", { exact: true }).first()).toBeVisible();
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

  test("기록 화면은 좁은 데스크톱에서 카드 내부 정보가 우측으로 넘치지 않는다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);

    for (const width of [1180, 1100, 1024, 961]) {
      await page.setViewportSize({ width, height: 900 });
      await openWorkspacePage(page, "/records");

      const metrics = await page.evaluate(() => {
        const layout = document.querySelector(".records-weekly-layout");
        const panel = document.querySelector(".records-team-status");
        const rows = [...document.querySelectorAll(".records-member-row")];
        if (!(layout instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
          throw new Error("Records responsive layout not found");
        }
        const panelRect = panel.getBoundingClientRect();
        const childrenInsidePanel = rows.every((row) => {
          const rowRect = row.getBoundingClientRect();
          return rowRect.left >= panelRect.left - 1 && rowRect.right <= panelRect.right + 1;
        });
        return {
          layoutColumns: getComputedStyle(layout).gridTemplateColumns.split(" ").length,
          childrenInsidePanel,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        };
      });

      expect(metrics.layoutColumns).toBe(1);
      expect(metrics.childrenInsidePanel).toBe(true);
      expect(metrics.horizontalOverflow).toBe(false);
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
    await expect(page.getByRole("dialog", { name: /이준호.*항목 현황/ })).toBeVisible();
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

		await page.route("**/api/v1/auth/me", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ authenticated: false }),
		}));
		await page.route("**/api/v1/capabilities", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				authProviders: ["GITLAB"],
				accountLinkProviders: ["GITLAB"],
				repositoryProviders: ["GITLAB"],
				features: { workspaceDiscovery: true },
			}),
		}));
		await openWorkspacePage(page, "/login");
		const onlyProvider = page.locator(".auth-provider-button");
		await expect(onlyProvider).toHaveCount(1);
		await expect(onlyProvider).toHaveAttribute("data-provider", "gitlab");
		await expect(page.getByRole("link", { name: /GitLab로 계속하기/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
		expect(errors).toEqual([]);
	});

	test("연결된 계정 Provider 목록은 상위 상태가 갱신되어도 다시 로딩되지 않는다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await mockAuthenticatedWorkspace(page);
		await page.unroute("**/api/v1/capabilities");
		let capabilityRequests = 0;
		let releaseCapabilities = () => {};
		const capabilityGate = new Promise<void>((resolve) => {
			releaseCapabilities = resolve;
		});
		await page.route("**/api/v1/capabilities", async (route) => {
			capabilityRequests += 1;
			await capabilityGate;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					authProviders: ["GITLAB", "GITHUB"],
					accountLinkProviders: ["GITLAB", "GITHUB"],
					repositoryProviders: ["GITLAB"],
					features: { workspaceDiscovery: true },
				}),
			});
		});

		await page.goto("/settings/accounts");
		const accountsSection = page.locator(".settings-content .settings-section-block");
		await expect(accountsSection).toHaveAttribute("aria-busy", "true");
		await expect(page.getByText("연결된 계정을 확인하고 있어요.")).toBeVisible();
		await expect(page.getByText("GitHub 계정", { exact: true })).toHaveCount(0);

		releaseCapabilities();
		await expect(accountsSection).toHaveAttribute("aria-busy", "false");
		await expect(page.getByText("GitLab 계정", { exact: true })).toBeVisible();
		await expect(page.getByText("GitHub 계정", { exact: true })).toBeVisible();
		await page.waitForTimeout(900);
		await expect(page.getByText("GitHub 계정", { exact: true })).toBeVisible();
		expect(capabilityRequests).toBe(1);
		expect(errors).toEqual([]);
	});

	test("GitHub auth capability가 켜지면 Login에만 Provider 버튼이 추가된다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await page.route("**/api/v1/auth/me", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ authenticated: false }),
		}));
		await page.route("**/api/v1/capabilities", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				authProviders: ["GITLAB", "GITHUB"],
				accountLinkProviders: ["GITLAB", "GITHUB"],
				repositoryProviders: ["GITLAB", "GITHUB"],
				features: { workspaceDiscovery: true },
			}),
		}));

		await page.goto("/login?returnUrl=%2Flibrary");
		const providerButtons = page.locator(".auth-provider-button");
		await expect(providerButtons).toHaveCount(2);
		await expect(providerButtons.nth(0)).toHaveAttribute("data-provider", "github");
		await expect(providerButtons.nth(1)).toHaveAttribute("data-provider", "gitlab");
		await expect(page.getByRole("link", { name: /GitLab로 계속하기/ })).toBeVisible();
		const github = page.getByRole("link", { name: /GitHub로 계속하기/ });
		await expect(github).toBeVisible();
		await expect(github).toHaveAttribute("href", /\/api\/v1\/auth\/github\/login\?returnUrl=%2Flibrary/);
		await expect(page.locator(".auth-entry-provider-mark")).toHaveCount(0);
		await expect(page.getByText("안전한 OAuth 로그인")).toHaveCount(0);
		await expect(page.getByText("개인 액세스 토큰을 직접 입력할 필요가 없습니다.")).toHaveCount(0);
		const gitlab = page.getByRole("link", { name: /GitLab로 계속하기/ });
		const githubBox = await github.boundingBox();
		const gitlabBox = await gitlab.boundingBox();
		expect(githubBox?.height).toBe(gitlabBox?.height);
		expect(githubBox?.width).toBe(gitlabBox?.width);

		const githubBackground = await github.evaluate((element) => getComputedStyle(element).backgroundColor);
		await github.hover();
		const githubHoverBackground = await github.evaluate((element) => getComputedStyle(element).backgroundColor);
		expect(githubBackground).not.toBe("rgb(102, 83, 199)");
		expect(githubHoverBackground).not.toBe(githubBackground);
		await github.focus();
		expect(await github.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe("3px");

		const topbarBox = await page.locator(".auth-entry-topbar").boundingBox();
		const cardBox = await page.locator(".auth-entry-layout").boundingBox();
		expect(topbarBox?.x).toBe(cardBox?.x);
		expect((cardBox?.y ?? 0) - ((topbarBox?.y ?? 0) + (topbarBox?.height ?? 0))).toBeLessThanOrEqual(20);
		expect(errors).toEqual([]);
	});

	test("프로필 미완료 사용자는 Login에서 다른 Provider를 선택할 수 있다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await page.route("**/api/v1/auth/me", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				authenticated: true,
				identityProvider: "GITLAB",
				user: {
					id: "new-user",
					username: "new-user",
					name: "New User",
					profileCompleted: false,
				},
			}),
		}));
		await page.route("**/api/v1/capabilities", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				authProviders: ["GITLAB", "GITHUB"],
				accountLinkProviders: ["GITLAB", "GITHUB"],
				repositoryProviders: ["GITLAB", "GITHUB"],
				features: { workspaceDiscovery: true },
			}),
		}));

		await page.goto("/login?returnUrl=%2Ftoday");
		await page.waitForTimeout(300);

		await expect(page).toHaveURL(/\/login\?returnUrl=%2Ftoday$/);
		await expect(page.getByRole("link", { name: /GitHub로 계속하기/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /GitLab로 계속하기/ })).toBeVisible();
		expect(errors).toEqual([]);
	});

	test("첫 프로필 설정은 두 이름만 입력받고 시간대는 자동 적용한다", async ({ page }) => {
		const errors = captureUnexpectedErrors(page);
		await page.route("**/api/v1/auth/me", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				authenticated: true,
				identityProvider: "GITLAB",
				user: {
					id: "new-user",
					username: "new-user",
					name: "새 사용자",
					profileCompleted: false,
					repositoryFileName: null,
					timezone: "Asia/Seoul",
				},
			}),
		}));

		await page.goto("/onboarding/profile?returnTo=%2Ftoday");
		await expect(page.getByLabel("표시 이름", { exact: false })).toBeVisible();
		await expect(page.getByLabel("학습 기록 이름", { exact: false })).toBeVisible();
		await expect(page.locator("details")).toHaveCount(0);
		await expect(page.getByText("고급 설정")).toHaveCount(0);
		await expect(page.getByText("시간대", { exact: true })).toHaveCount(0);
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

  test("Provider 연결 callback 결과는 첫 Settings 렌더와 후속 context 갱신 뒤에도 안내된다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await mockAuthenticatedWorkspace(page);
    const cases = [
      ["github_collision", "이 GitHub 계정은 이미 다른 Study-ing 계정에 연결되어 있습니다."],
      ["github_account_exists", "이미 다른 GitHub 계정이 연결되어 있습니다."],
      ["github_expired", "GitHub 계정 연결 요청이 만료되었습니다."],
      ["github_failed", "GitHub 계정을 연결하지 못했어요."],
      ["github_cancelled", "GitHub 계정 연결이 취소되었습니다."],
    ] as const;

    for (const [result, message] of cases) {
      await page.goto(`/settings/accounts?providerLink=${result}`);
      const notice = page.locator(".provider-link-result");
      await expect(notice).toContainText(message);
      await page.waitForTimeout(500);
      await expect(notice).toContainText(message);
      await expect(page).toHaveURL(/\/settings\/accounts$/);
    }
    expect(errors).toEqual([]);
  });

  test("GitHub와 GitLab 로그인 callback 오류는 첫 Login 렌더에서 안내된다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await page.route("**/api/v1/auth/me", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    }));
    await page.route("**/api/v1/capabilities", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authProviders: ["GITLAB", "GITHUB"],
        accountLinkProviders: ["GITLAB", "GITHUB"],
        repositoryProviders: ["GITLAB"],
        features: { workspaceDiscovery: true },
      }),
    }));

    for (const provider of ["GITLAB", "GITHUB"] as const) {
      for (const [error, expected] of [
        ["access_denied", `${provider === "GITHUB" ? "GitHub" : "GitLab"} 로그인이 취소되었습니다.`],
        ["session_expired", "로그인이 만료되었습니다."],
        ["oauth_failed", `${provider === "GITHUB" ? "GitHub" : "GitLab"}로 로그인하지 못했습니다.`],
      ] as const) {
        await page.goto(`/login?provider=${provider}&oauthError=${error}`);
        await expect(page.locator(".auth-notice")).toContainText(expected);
        await expect(page.getByRole("link", { name: new RegExp(`${provider === "GITHUB" ? "GitHub" : "GitLab"}로 계속하기`) })).toBeVisible();
      }
    }
    expect(errors).toEqual([]);
  });

  test("공통 Motion은 route와 overlay의 open/close 상태를 설명한다", async ({ page }) => {
    const errors = captureUnexpectedErrors(page);
    await openWorkspacePage(page, "/today");

    await page.getByRole("link", { name: "일정", exact: true }).click();
    await expect(page).toHaveURL(/\/schedule$/);
    const routeAnimation = await page.locator(".motion-page").evaluate((element) => getComputedStyle(element).animationName);
    expect(routeAnimation).toContain("motion-page-enter");

    await openWorkspacePage(page, "/settings/general");
    await page.locator(".motion-page").evaluate((element) => {
      element.setAttribute("data-settings-motion-instance", "stable");
    });
    await page.getByRole("link", { name: "학습 규칙", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/study-rules$/);
    await expect(page.locator(".motion-page")).toHaveAttribute("data-settings-motion-instance", "stable");
    const settingsContentAnimation = await page.locator(".settings-content").evaluate((element) => getComputedStyle(element).animationName);
    expect(settingsContentAnimation).toContain("motion-content-enter");

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

		const context = await browser.newContext();
		const page = await context.newPage();
		await page.route("**/api/v1/auth/csrf", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ token: "github-oauth-routing-test", headerName: "X-CSRF-TOKEN" }),
		}));
		await page.route("**/api/v1/auth/github/complete", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ returnUrl: "/records" }),
		}));
		const forwarded = page.waitForRequest((request) => new URL(request.url()).pathname === "/records");
		await page.goto("/auth/callback?provider=GITHUB");
		await forwarded;
		await context.close();
  });
});
