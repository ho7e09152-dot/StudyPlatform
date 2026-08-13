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
