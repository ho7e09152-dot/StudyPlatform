import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getPageTransitionPath } from "../lib/motion/pageTransition.ts";

test("settings menu routes keep the outer page transition stable", () => {
  assert.equal(getPageTransitionPath("/settings"), "/settings");
  assert.equal(getPageTransitionPath("/settings/general"), "/settings");
  assert.equal(getPageTransitionPath("/settings/study-rules"), "/settings");
  assert.equal(getPageTransitionPath("/settings/data/migrate"), "/settings/data/migrate");
  assert.equal(getPageTransitionPath("/schedule"), "/schedule");
});

test("authenticated UI uses shared motion tokens and reduced-motion foundation", async () => {
  const css = await readFile(new URL("../app/design-system.css", import.meta.url), "utf8");
  assert.match(css, /--motion-instant:\s*100ms/);
  assert.match(css, /--motion-fast:\s*140ms/);
  assert.match(css, /--motion-base:\s*200ms/);
  assert.match(css, /--motion-slow:\s*240ms/);
  assert.match(css, /--ease-standard:\s*cubic-bezier\(0\.2, 0, 0, 1\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.motion-page/);
  assert.match(css, /data-motion-state="closing"/);
  assert.doesNotMatch(css, /transition:\s*all\b/);
});

test("shared overlays retain an exit state before unmount", async () => {
  const [modal, drawer, toast, hook] = await Promise.all([
    readFile(new URL("../components/ui/Modal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/Drawer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/ui/Toast.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/motion/useExitTransition.ts", import.meta.url), "utf8"),
  ]);
  for (const source of [modal, drawer, toast]) {
    assert.match(source, /useExitTransition/);
    assert.match(source, /data-motion-state/);
  }
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /setTimeout/);
});

test("toast automatically dismisses after seven seconds", async () => {
  const toast = await readFile(new URL("../components/ui/Toast.tsx", import.meta.url), "utf8");
  assert.match(toast, /TOAST_AUTO_DISMISS_MS\s*=\s*7_000/);
  assert.match(toast, /window\.setTimeout\(requestClose, TOAST_AUTO_DISMISS_MS\)/);
  assert.match(toast, /window\.clearTimeout\(timer\)/);
});

test("settings applies content motion only to the changing section", async () => {
  const source = await readFile(new URL("../components/settings/SettingsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(source, /<main key=\{section\} className="settings-content motion-content-swap"/);
  assert.doesNotMatch(source, /settings-shell motion-content-swap/);
});
