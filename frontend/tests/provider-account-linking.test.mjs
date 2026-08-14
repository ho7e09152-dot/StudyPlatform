import assert from "node:assert/strict";
import test from "node:test";

import { buildProviderAccountRows, getProviderLinkNotice, parseProviderLinkResult } from "../lib/providers/connected-accounts.ts";

const gitLabAccount = {
  id: "gitlab-account",
  provider: "GITLAB",
  externalUserId: "1",
  username: "gitlab-user",
  displayName: "GitLab User",
  avatarUrl: null,
  webUrl: null,
  status: "CONNECTED",
};

const githubAccount = {
  id: "github-account",
  provider: "GITHUB",
  externalUserId: "2",
  username: "github-user",
  displayName: "GitHub User",
  avatarUrl: null,
  webUrl: null,
  status: "CONNECTED",
};

test("capability off never exposes a GitHub account row", () => {
  const rows = buildProviderAccountRows([gitLabAccount, githubAccount], ["GITLAB"]);
  assert.deepEqual(rows.map((row) => row.provider), ["GITLAB"]);
});

test("GitHub link capability renders a disconnected connect row", () => {
  const rows = buildProviderAccountRows([gitLabAccount], ["GITLAB", "GITHUB"]);
  const github = rows.find((row) => row.provider === "GITHUB");
  assert.equal(github.status, "DISCONNECTED");
  assert.equal(github.username, null);
});

test("connected GitHub account replaces the connect row without duplication", () => {
  const rows = buildProviderAccountRows([gitLabAccount, githubAccount], ["GITLAB", "GITHUB"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].username, "github-user");
  assert.equal(rows[1].status, "CONNECTED");
});

test("callback result parsing keeps success, cancel, collision, existing account, expiry and failure distinct", () => {
  assert.equal(parseProviderLinkResult("github_success"), "success");
  assert.equal(parseProviderLinkResult("github_cancelled"), "cancelled");
  assert.equal(parseProviderLinkResult("github_collision"), "collision");
  assert.equal(parseProviderLinkResult("github_account_exists"), "account-exists");
  assert.equal(parseProviderLinkResult("github_expired"), "expired");
  assert.equal(parseProviderLinkResult("github_failed"), "failed");
  assert.equal(parseProviderLinkResult(null), null);
});

test("every provider linking failure has visible guidance and appropriate retry behavior", () => {
  assert.deepEqual(getProviderLinkNotice("collision"), {
    message: "이 GitHub 계정은 이미 다른 Study-ing 계정에 연결되어 있습니다.",
    tone: "danger",
    retry: true,
  });
  assert.equal(getProviderLinkNotice("account-exists")?.retry, false);
  assert.match(getProviderLinkNotice("account-exists")?.message ?? "", /다시 승인/);
  for (const result of ["cancelled", "expired", "failed"]) {
    assert.equal(getProviderLinkNotice(result)?.retry, true);
  }
  assert.equal(getProviderLinkNotice("success"), null);
});
