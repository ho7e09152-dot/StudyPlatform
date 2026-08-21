import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getActiveRequiredItems,
  getDashboardMetrics,
  getMemberScore,
} from "../lib/domain/metrics.ts";

const member = {
  id: "member-a",
  gitlabUserId: 101,
  username: "member-a",
  displayName: "김서연",
  avatar: "",
  color: "#000000",
  fileName: "김서연.md",
  role: "OWNER",
  status: "ACTIVE",
  accessLevel: 50,
};

const session = {
  date: "2026-08-20",
  folder: "260820",
  revision: 1,
  type: "algorithm",
  title: "호환용 제목",
  description: "",
  status: "active",
  deadline: "2026-08-20T23:59:00+09:00",
  createdAt: "2026-08-20T00:00:00+09:00",
  createdBy: "member-a",
  updatedAt: "2026-08-20T00:00:00+09:00",
  updatedBy: "member-a",
  lastCommitId: "session-sha",
  archivedItems: [],
  items: [
    { id: "submission", order: 1, title: "문제 풀이", kind: "submission", type: "algorithm", submitType: "link", required: true, deadline: "2026-08-20T23:00:00+09:00", status: "active" },
    { id: "check", order: 2, title: "교재 읽기", kind: "check", type: "cs", submitType: "text", required: true, status: "active" },
    { id: "event", order: 3, title: "주간 회의", kind: "event", type: "free", submitType: "text", required: false, startTime: "19:00", endTime: "20:00", status: "active" },
  ],
};

function workspace(submissions) {
  return {
    id: "workspace-a",
    members: [member],
    sessions: { [session.date]: session },
    submissions,
  };
}

test("checklist items count toward completion while timed events do not", () => {
  const data = workspace({
    "260820/member-a": {
      submissions: [
        { itemId: "check", type: "check", value: "completed", submittedAt: "2026-08-20T12:00:00+09:00", updatedAt: "2026-08-20T12:00:00+09:00" },
      ],
    },
  });

  assert.deepEqual(getActiveRequiredItems(session).map((item) => item.id), ["submission", "check"]);
  assert.equal(getDashboardMetrics(data, session).submittedItems, 1);
  assert.equal(getDashboardMetrics(data, session).totalRequiredSubmissions, 2);
});

test("checklist completion and timed events never affect submission score", () => {
  const data = workspace({
    "260820/member-a": {
      submissions: [
        { itemId: "submission", type: "link", value: "https://example.com", submittedAt: "2026-08-20T22:00:00+09:00", updatedAt: "2026-08-20T22:00:00+09:00" },
        { itemId: "check", type: "check", value: "completed", submittedAt: "2026-08-20T12:00:00+09:00", updatedAt: "2026-08-20T12:00:00+09:00" },
      ],
    },
  });

  const score = getMemberScore(data, [session], member);
  assert.equal(score.points, 10);
  assert.equal(score.maxPoints, 10);
  assert.equal(score.primaryCount, 1);
});

test("checklist completion and reopen both send the current member file commit", async () => {
  const api = await readFile(new URL("../lib/api/services/workspaceApi.ts", import.meta.url), "utf8");
  assert.match(api, /method: "PUT", body: \{ expectedFileCommitId \}/);
  assert.match(api, /method: "DELETE", body: \{ expectedFileCommitId \}/);
});
