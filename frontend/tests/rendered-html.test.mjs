import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the public landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Study-ing/);
  assert.match(html, /study-ing-icon\.png/);
  assert.doesNotMatch(html, /ssafy_icon|>STUDY</);
  assert.match(html, /스터디의 계획부터 기록까지/);
  assert.match(html, /Study-ing 시작하기/);
  assert.match(html, /GitLab·GitHub OAuth/);
  assert.match(html, /데모 둘러보기/);
  assert.match(html, /\/demo\?returnTo=%2Ftoday/);
  assert.match(html, /Workspace 연결/);
  assert.match(html, /실제 제품 화면/);
  assert.match(html, /today-desktop\.webp/);
  assert.match(html, /라이브러리/);
  assert.doesNotMatch(html, /Spring Boot|REST API|GitLab learning hub/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("legal pages share the readable document foundation", async () => {
  const [terms, privacy] = await Promise.all([render("/terms"), render("/privacy")]);
  assert.equal(terms.status, 200);
  assert.equal(privacy.status, 200);

  const termsHtml = await terms.text();
  const privacyHtml = await privacy.text();
  assert.match(termsHtml, /legal-document/);
  assert.match(termsHtml, /서비스의 역할/);
  assert.match(privacyHtml, /OAuth access\/refresh token은 서버 DB에 AES-GCM으로 암호화/);
  assert.match(privacyHtml, /HttpOnly 세션 쿠키/);
  assert.match(privacyHtml, /알림은 90일, 동기화 오류 기록은 30일, 감사 기록은 180일/);
  assert.match(termsHtml, /만 14세 이상/);
  assert.doesNotMatch(termsHtml, /로그인으로 돌아가기/);
  assert.doesNotMatch(privacyHtml, /로그인으로 돌아가기/);
  assert.doesNotMatch(termsHtml, /공개 출시 전|법률 검토/);
  assert.doesNotMatch(privacyHtml, /공개 출시 전|법률 검토/);
  assert.doesNotMatch(privacyHtml, /향후 확정될 문의 채널/);
});

test("unknown public routes render the shared 404 state", async () => {
  const response = await render("/definitely-not-a-study-route");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /페이지를 찾을 수 없어요/);
  assert.match(html, /홈으로/);
  assert.match(html, /오늘로 이동/);
});

test("login page renders real OAuth and an explicitly isolated demo entry", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Study-ing 시작하기/);
  assert.match(html, /study-ing-icon\.png/);
  assert.doesNotMatch(html, /ssafy_icon|>STUDY</);
  assert.match(html, /함께 공부하고/);
  assert.match(html, /GitLab로 계속하기/);
  assert.doesNotMatch(html, /GitHub로 계속하기|GitHub 계정/);
  assert.match(html, /데모 Workspace 둘러보기/);
  assert.match(html, /\/demo\?returnTo=%2Ftoday/);
  assert.match(html, /\/api\/v1\/auth\/gitlab\/login/);
  assert.doesNotMatch(html, /CONNECTED WORKFLOW|login-background__orb|GitLab learning hub/);
});

test("demo entry is a dedicated transient route", async () => {
  const response = await render("/demo?returnTo=%2Fschedule");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /데모 Workspace를 준비하고 있어요/);
  assert.match(html, /aria-live="polite"/);
});

test("login states use concise shared user-facing notices", async () => {
  const cancelled = await render("/login?oauthError=access_denied");
  const failed = await render("/login?oauthError=oauth_failed");
  assert.match(await cancelled.text(), /GitLab 로그인이 취소되었습니다/);
  assert.match(await failed.text(), /GitLab로 로그인하지 못했습니다/);
});

test("OAuth callback renders the branded transition screen", async () => {
  const response = await render("/auth/callback");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /Study-ing/);
  assert.match(html, /로그인하고 있어요/);
  assert.match(html, /잠시만 기다려주세요/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /GitLab 계정 확인|프로필 확인|Workspace 확인|oauth-checking-steps|SECURE OAUTH CONNECTION|auth-transition__progress/);
});

test("all authenticated workspace routes render their product heading", async () => {
  const routes = [
    ["/today", "오늘의 학습"],
    ["/schedule", "학습 일정"],
    ["/records", "학습 기록"],
    ["/library", "학습 라이브러리"],
    ["/workspaces", "Workspace"],
    ["/settings", "설정"],
    ["/settings/general", "설정"],
    ["/settings/members", "설정"],
    ["/settings/profile", "설정"],
    ["/settings/data/migrate", "저장 구조 이전"],
  ];

  for (const [pathname, heading] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(heading), pathname);
  }
});

test("starter preview infrastructure is removed", async () => {
  const [page, layout, rootShell, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/shell/RootShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /LandingPage/);
  assert.match(layout, /RootShell/);
  assert.match(rootShell, /WorkspaceProvider/);
  assert.match(rootShell, /AuthProvider/);
  assert.match(rootShell, /RepositoryConnectionProvider/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
