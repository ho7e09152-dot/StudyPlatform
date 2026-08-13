import type { StudyMember } from "./types";

export type AppRole = StudyMember["role"];

export const APP_ROLE_LABEL: Record<AppRole, string> = {
  OWNER: "소유자",
  MANAGER: "관리자",
  MEMBER: "멤버",
};

export function canManageSchedules(
  member?: Pick<StudyMember, "role" | "status">,
) {
  return Boolean(
    member?.status === "ACTIVE" &&
      (member.role === "OWNER" || member.role === "MANAGER"),
  );
}

export function canManageWorkspaceSettings(
  member?: Pick<StudyMember, "role" | "status">,
) {
  return canManageSchedules(member);
}

export function canMigrateRepository(
  member?: Pick<StudyMember, "role" | "status">,
) {
  return Boolean(member?.status === "ACTIVE" && member.role === "OWNER");
}

export function canDeleteWorkspace(
  member?: Pick<StudyMember, "role" | "status">,
) {
  return canMigrateRepository(member);
}
