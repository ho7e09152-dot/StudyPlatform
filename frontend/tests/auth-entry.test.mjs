import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getLoginNoticeState, shouldAutoResumeAuthenticatedSession } from "../lib/auth/loginState.ts";
import { safeAppReturnUrl } from "../lib/auth/redirects.ts";
import { getDemoEntryUrl } from "../lib/demo/session.ts";
import { orderLoginProviders } from "../lib/providers/provider-descriptors.ts";

test("safe return paths allow internal deep links and reject open redirects", () => {
  assert.equal(safeAppReturnUrl("/library/sessions/2026-07-23?member=12"), "/library/sessions/2026-07-23?member=12");
  assert.equal(safeAppReturnUrl("https://example.com"), "/today");
  assert.equal(safeAppReturnUrl("//example.com"), "/today");
  assert.equal(safeAppReturnUrl("/\\example.com"), "/today");
  assert.equal(safeAppReturnUrl("/today\nLocation:https://example.com"), "/today");
});

test("demo entry keeps only safe in-app return paths", () => {
  assert.equal(getDemoEntryUrl("/library"), "/demo?returnTo=%2Flibrary");
  assert.equal(safeAppReturnUrl(new URL(getDemoEntryUrl("/schedule"), "http://localhost").searchParams.get("returnTo")), "/schedule");
  assert.equal(safeAppReturnUrl("https://example.com"), "/today");
});

test("OAuth errors keep cancellation separate from authentication failure", () => {
  assert.deepEqual(getLoginNoticeState("access_denied"), {
    tone: "neutral",
    title: "GitLab 로그인이 취소되었습니다.",
    description: "원할 때 다시 로그인할 수 있습니다.",
    actionLabel: "GitLab로 계속하기",
  });
  assert.equal(getLoginNoticeState("session_expired")?.actionLabel, "GitLab로 다시 로그인");
  assert.equal(getLoginNoticeState("reconnect_required")?.actionLabel, "GitLab 다시 연결");
  assert.equal(getLoginNoticeState("oauth_failed")?.tone, "danger");
  assert.equal(getLoginNoticeState("access_denied", "GITHUB")?.title, "GitHub 로그인이 취소되었습니다.");
  assert.equal(getLoginNoticeState("session_expired", "GITHUB")?.actionLabel, "GitHub로 다시 로그인");
});

test("expired or reconnect-required sessions stay on the login recovery screen", () => {
  assert.equal(shouldAutoResumeAuthenticatedSession("session_expired"), false);
  assert.equal(shouldAutoResumeAuthenticatedSession("reconnect_required"), false);
  assert.equal(shouldAutoResumeAuthenticatedSession(null), true);
  assert.equal(shouldAutoResumeAuthenticatedSession("oauth_cancelled"), true);
});

test("login and callback UI are capability-driven and provider-aware", async () => {
  const login = await readFile(new URL("../components/marketing/LoginPage.tsx", import.meta.url), "utf8");
  const callback = await readFile(new URL("../components/auth/OAuthCallbackPage.tsx", import.meta.url), "utf8");
  assert.match(login, /getProviderCapabilities/);
  assert.match(login, /orderLoginProviders\(authProviders\)\.map/);
  assert.match(login, /getProviderLoginUrl/);
  assert.match(callback, /completeGitHubLogin/);
  assert.match(callback, /provider=\$\{provider\}/);
});

test("login provider order prefers GitHub without inventing unavailable capabilities", () => {
  assert.deepEqual(orderLoginProviders(["GITLAB", "GITHUB"]), ["GITHUB", "GITLAB"]);
  assert.deepEqual(orderLoginProviders(["GITLAB"]), ["GITLAB"]);
});

test("profile onboarding requires age, Terms, and Privacy independently", async () => {
  const source = await readFile(new URL("../components/auth/ProfileSetupPage.tsx", import.meta.url), "utf8");
  assert.match(source, /표시 이름/);
  assert.match(source, /학습 기록 이름/);
  assert.doesNotMatch(source, /<details|고급 설정|>시간대</);
  assert.match(source, /만 14세 이상입니다/);
  assert.match(source, /acceptTerms/);
  assert.match(source, /acceptPrivacy/);
  assert.match(source, /confirmMinimumAge/);
  assert.match(source, /href="\/terms"/);
  assert.match(source, /href="\/privacy"/);
});
