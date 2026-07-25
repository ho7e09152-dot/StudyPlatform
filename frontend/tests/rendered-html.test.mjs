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
  assert.match(html, /함께 움직이는 Workspace로/);
  assert.match(html, /GitLab로 시작하기/);
  assert.match(html, /스터디의 반복 작업을/);
  assert.match(html, /GitLab learning hub/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("login page renders GitLab OAuth and demo entry points", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /GitLab 계정으로 시작/);
  assert.match(html, /GitLab로 계속하기/);
  assert.match(html, /데모 Workspace 둘러보기/);
  assert.match(html, /\/api\/v1\/auth\/gitlab\/login/);
});

test("all authenticated workspace routes render their product heading", async () => {
  const routes = [
    ["/today", "오늘의 학습"],
    ["/schedule", "학습 일정"],
    ["/records", "학습 기록"],
    ["/repository", "저장소"],
    ["/settings", "설정"],
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
  assert.match(rootShell, /GitLabConnectionProvider/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
