import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("App brand routes demo users to landing and signed-in users to today", async () => {
  const shell = await readFile(
    new URL("../components/shell/AppShell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(shell, /const brandHref = mode === "demo" \? "\/" : "\/today"/);
  assert.match(shell, /className="brand-block" href=\{brandHref\}/);
  assert.match(shell, /className="mobile-brand" href=\{brandHref\}/);
});

test("Workspace switcher routes every completed workspace change to today", async () => {
  const switcher = await readFile(
    new URL("../components/shell/WorkspaceSwitcher.tsx", import.meta.url),
    "utf8",
  );

  assert.match(switcher, /onSwitch\(candidate\.id\);\s+router\.push\("\/today"\)/);
  assert.match(switcher, /if \(candidate\.id !== workspace\.id\)/);
});

test("Deleting a workspace returns to the all-workspaces screen", async () => {
  const settings = await readFile(
    new URL("../components/settings/SettingsWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(settings, /else window\.location\.replace\(APP_ROUTES\.workspaces\)/);
});
