import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("OAuth session rotation clears the cached CSRF token", async () => {
  const authApi = await readFile(new URL("../lib/api/services/authApi.ts", import.meta.url), "utf8");

  assert.match(authApi, /completeGitLabLogin[\s\S]*resetCsrfToken\(\)/);
});

test("a stale CSRF denial refreshes once without retrying unrelated 403 errors", async () => {
  const http = await readFile(new URL("../lib/api/client/http.ts", import.meta.url), "utf8");

  assert.match(http, /allowCsrfRetry/);
  assert.match(http, /response\.status === 403/);
  assert.match(http, /body\?\.code === "ACCESS_DENIED"/);
  assert.match(http, /apiRequestAttempt<T>\(path, options, false\)/);
});

test("a preference write succeeds after refreshing a stale session token", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let csrfRequestCount = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if (url.endsWith("/api/v1/auth/csrf")) {
      csrfRequestCount += 1;
      return Response.json({
        token: csrfRequestCount === 1 ? "stale-token" : "fresh-token",
        headerName: "X-CSRF-TOKEN",
      });
    }
    if (init.headers?.["X-CSRF-TOKEN"] === "stale-token") {
      return Response.json(
        { code: "ACCESS_DENIED", message: "요청을 수행할 권한이 없습니다." },
        { status: 403 },
      );
    }
    return Response.json({ themeMode: "DARK", accentColor: "PURPLE" });
  };

  try {
    const { apiRequest } = await import("../lib/api/client/http.ts?csrf-runtime");
    const result = await apiRequest("/api/v1/auth/preferences", {
      method: "PATCH",
      body: { themeMode: "DARK", accentColor: "PURPLE" },
    });

    assert.equal(result.themeMode, "DARK");
    assert.equal(csrfRequestCount, 2);
    assert.equal(requests.length, 4);
    assert.equal(requests[1].init.headers["X-CSRF-TOKEN"], "stale-token");
    assert.equal(requests[3].init.headers["X-CSRF-TOKEN"], "fresh-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
