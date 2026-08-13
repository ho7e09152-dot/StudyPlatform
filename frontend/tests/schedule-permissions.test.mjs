import test from "node:test";
import assert from "node:assert/strict";
import {
  canDeleteWorkspace,
  canManageSchedules,
  canManageWorkspaceSettings,
  canMigrateRepository,
} from "../lib/domain/permissions.ts";

function member(role, status = "ACTIVE") {
  return { role, status };
}

test("Schedule management follows the official App Role contract", () => {
  assert.equal(canManageSchedules(member("OWNER")), true);
  assert.equal(canManageSchedules(member("MANAGER")), true);
  assert.equal(canManageSchedules(member("MEMBER")), false);
  assert.equal(canManageSchedules(member("OWNER", "PROJECT_ACCESS_LOST")), false);
  assert.equal(canManageSchedules(undefined), false);
});

test("Settings management follows the official App Role contract", () => {
  assert.equal(canManageWorkspaceSettings(member("OWNER")), true);
  assert.equal(canManageWorkspaceSettings(member("MANAGER")), true);
  assert.equal(canManageWorkspaceSettings(member("MEMBER")), false);
  assert.equal(canMigrateRepository(member("OWNER")), true);
  assert.equal(canMigrateRepository(member("MANAGER")), false);
  assert.equal(canDeleteWorkspace(member("OWNER")), true);
  assert.equal(canDeleteWorkspace(member("MANAGER")), false);
});
