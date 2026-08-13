import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getLoginNoticeState } from "../lib/auth/loginState.ts";
import { safeAppReturnUrl } from "../lib/auth/redirects.ts";

test("safe return paths allow internal deep links and reject open redirects", () => {
  assert.equal(safeAppReturnUrl("/library/sessions/2026-07-23?member=12"), "/library/sessions/2026-07-23?member=12");
  assert.equal(safeAppReturnUrl("https://example.com"), "/today");
  assert.equal(safeAppReturnUrl("//example.com"), "/today");
  assert.equal(safeAppReturnUrl("/\\example.com"), "/today");
  assert.equal(safeAppReturnUrl("/today\nLocation:https://example.com"), "/today");
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
});

test("profile onboarding requires age, Terms, and Privacy independently", async () => {
  const source = await readFile(new URL("../components/auth/ProfileSetupPage.tsx", import.meta.url), "utf8");
  assert.match(source, /만 14세 이상입니다/);
  assert.match(source, /acceptTerms/);
  assert.match(source, /acceptPrivacy/);
  assert.match(source, /confirmMinimumAge/);
  assert.match(source, /href="\/terms"/);
  assert.match(source, /href="\/privacy"/);
});
