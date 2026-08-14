import test from "node:test";
import assert from "node:assert/strict";
import {
  canWriteRepository,
  getGitLabAccessLabel,
  getRepositoryVisibilityLabel,
  getWorkspaceRepositoryConnection,
  toRepository,
} from "../lib/domain/repository.ts";
import { APP_ROLE_LABEL } from "../lib/domain/permissions.ts";
import { readFile } from "node:fs/promises";

test("Repository UI maps provider data without leaking raw visibility enums", () => {
  const repository = toRepository({
    id: 42,
    name: "Study",
    pathWithNamespace: "team/study",
    defaultBranch: "main",
    webUrl: "https://gitlab.example/team/study",
    visibility: "internal",
    accessLevel: 30,
  });

  assert.equal(repository.provider, "GITLAB");
  assert.equal(repository.externalId, "42");
  assert.deepEqual(repository.capabilities, { canRead: true, canWrite: true, canManage: false });
  assert.equal(repository.path, "team/study");
  assert.equal(getRepositoryVisibilityLabel(repository.visibility), "내부");
});

test("Workspace repository identity prefers the normalized provider contract", () => {
  const connection = getWorkspaceRepositoryConnection({
    id: "workspace-a",
    name: "Study",
    gitlabProjectId: 42,
    gitlabProjectPath: "legacy/path",
    defaultBranch: "main",
    repositoryBasePath: "",
    repositorySchemaVersion: 2,
    importMode: "NEW",
    status: "ACTIVE",
    lastSyncedAt: "",
    members: [],
    sessions: {},
    submissions: {},
    settings: { timezone: "Asia/Seoul", requireChangeNoteWhenSubmitted: true, notifications: { scheduleChanges: true, submissionMismatch: true, syncFailures: true } },
    repository: { provider: "GITLAB", externalRepositoryId: "9001", fullName: "team/current", defaultBranch: "develop", canRead: true, canWrite: true, canManage: false },
  });
  assert.equal(connection.externalRepositoryId, "9001");
  assert.equal(connection.fullName, "team/current");
  assert.equal(connection.repositoryId, 9001);
});

test("Workspace connection requires GitLab Developer-level write access", () => {
  assert.equal(canWriteRepository(20), false);
	assert.equal(canWriteRepository(null), false);
  assert.equal(canWriteRepository(30), true);
  assert.equal(canWriteRepository(40), true);
  assert.equal(getGitLabAccessLabel(20), "Reporter");
  assert.equal(getGitLabAccessLabel(30), "Developer");
});

test("App roles keep internal enums and use Korean user-facing labels", () => {
  assert.deepEqual(APP_ROLE_LABEL, {
    OWNER: "소유자",
    MANAGER: "관리자",
    MEMBER: "멤버",
  });
});

test("Workspace connection state is reset and scoped to the selected repository", async () => {
  const [provider, shell, workspaceProvider] = await Promise.all([
    readFile(new URL("../lib/api/hooks/useRepositoryConnection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/shell/AppShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/providers/WorkspaceProvider.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(provider, /setState\("loading"\)/);
  assert.match(provider, /setData\(null\)/);
  assert.match(provider, /repository\.externalRepositoryId/);
  assert.match(shell, /REPOSITORY_ACCESS_REVOKED/);
  assert.match(workspaceProvider, /setLastSyncFailures\(\[\]\)/);
});
