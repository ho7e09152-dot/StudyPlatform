import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("demo data is activated by an explicit session-scoped entry instead of a build flag", async () => {
  const [authProvider, login, landing] = await Promise.all([
    readFile(new URL("../components/providers/AuthProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/marketing/LoginPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/marketing/LandingPage.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(authProvider, /isDemoSessionActive/);
  assert.doesNotMatch(authProvider, /NEXT_PUBLIC_APP_MODE/);
  assert.match(login, /getDemoEntryUrl/);
  assert.match(landing, /getDemoEntryUrl/);
});

test("real workspace loading never falls back to seed data after authentication", async () => {
  const source = await readFile(new URL("../components/providers/WorkspaceProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /demoMode \? cloneSeed\(\) : \[\]/);
  assert.match(source, /listWorkspaces\(controller\.signal\)/);
  assert.match(source, /if \(demoMode\) return;/);
});

test("the shared API client blocks every authenticated request while demo mode is active", async () => {
  const source = await readFile(new URL("../lib/api/client/http.ts", import.meta.url), "utf8");
  assert.match(source, /isDemoSessionActive/);
  assert.match(source, /DEMO_API_ACCESS_BLOCKED/);
  assert.ok(
    source.indexOf("if (isDemoSessionActive())") < source.indexOf("return apiRequestAttempt<T>(path, options, true)"),
    "the demo guard must run before fetch and CSRF preparation",
  );
});

test("the demo API boundary rejects before fetch is called", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.window = {
    sessionStorage: {
      getItem(key) {
        return key === "study-ing-demo-session" ? "active" : null;
      },
    },
  };
  globalThis.fetch = async () => {
    fetchCount += 1;
    return Response.json({});
  };

  try {
    const { apiGet } = await import("../lib/api/client/http.ts?demo-isolation-runtime");
    await assert.rejects(
      () => apiGet("/api/v1/repositories"),
      (error) => error?.code === "DEMO_API_ACCESS_BLOCKED" && error?.status === 403,
    );
    assert.equal(fetchCount, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
  }
});

test("demo entry fails closed when browser session storage is unavailable", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    sessionStorage: {
      setItem() {
        throw new Error("blocked");
      },
    },
  };

  try {
    const { startDemoSession } = await import("../lib/demo/session.ts?demo-storage-blocked");
    assert.equal(startDemoSession(), false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("demo workspace connection uses local fixtures instead of provider APIs", async () => {
  const source = await readFile(new URL("../components/onboarding/WorkspaceOnboarding.tsx", import.meta.url), "utf8");
  assert.match(source, /listDemoRepositories/);
  assert.match(source, /getDemoRepositoryAnalysis/);
  assert.match(source, /createDemoWorkspace/);
  assert.match(source, /실제 계정이나 저장소에는 접근하지 않으며/);
});

test("the empty-workspace entry gate reuses the demo-aware workspace activation path", async () => {
  const source = await readFile(new URL("../components/providers/WorkspaceProvider.tsx", import.meta.url), "utf8");
  assert.match(source, /onWorkspaceReady=\{\(created\) => activateWorkspace\(created/);
  assert.doesNotMatch(source, /onWorkspaceReady=\{\(created\) => \{[\s\S]{0,300}setBackendConnected\(true\)/);
});

test("demo workspace discovery cannot invoke the real join callback", async () => {
  const source = await readFile(
    new URL("../components/workspaces/DiscoverableWorkspaceSection.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /if \(mode === "demo"\) \{\s*setAnnouncement\("데모에서는 실제 Workspace에 참여하지 않습니다\."\);\s*return;/,
  );
});
