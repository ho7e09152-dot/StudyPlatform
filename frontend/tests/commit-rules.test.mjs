import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_COMMIT_RULES,
  normalizeCommitRules,
  renderCommitMessage,
  validateCommitRules,
} from "../lib/domain/commitRules.ts";

const context = {
  action: "submit",
  name: "김서연",
  date: "2026-08-13",
  item: "그래프 탐색",
  itemId: "item-a1b2",
  session: "그래프 집중 학습",
};

test("old workspaces receive the default commit rules", () => {
  assert.deepEqual(normalizeCommitRules(undefined), DEFAULT_COMMIT_RULES);
});

test("commit templates combine custom text with supported variables", () => {
  assert.equal(
    renderCommitMessage("study: {name} / {date} / {item}", context),
    "study: 김서연 / 2026-08-13 / 그래프 탐색",
  );
  assert.equal(validateCommitRules({
    submissionTemplate: "study: {name} / {date} / {item}",
    submissionGuidance: "확인해 주세요.",
  }), "");
  assert.match(validateCommitRules({
    submissionTemplate: "study: {unknown}",
    submissionGuidance: "확인해 주세요.",
  }), /지원하지 않는 변수/);
});

test("settings and submission use the same workspace commit rule contract", async () => {
  const [settings, submission] = await Promise.all([
    readFile(new URL("../components/settings/SettingsWorkspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/today/SubmissionDialog.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(settings, /saveCommitRules/);
  assert.match(settings, /COMMIT_RULE_VARIABLES/);
  assert.match(submission, /workspace\.settings\.commitRules/);
  assert.match(submission, /commitRules\.submissionGuidance/);
});
