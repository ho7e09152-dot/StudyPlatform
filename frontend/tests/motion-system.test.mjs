import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
