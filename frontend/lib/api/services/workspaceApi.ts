import { apiGet, apiRequest } from "@/lib/api/client/http";
import type {
  SessionDraft,
  SubmissionDraft,
  Workspace,
  WorkspaceSettings,
  StudyMember,
} from "@/lib/domain/types";

function workspacePath(workspaceId: string) {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function listWorkspaces(signal?: AbortSignal) {
  return apiGet<Workspace[]>("/api/v1/workspaces", signal);
}

export interface DeletedWorkspace {
  workspace: Workspace;
  deletedAt: string;
  deletionExpiresAt: string;
}

export interface SyncJob {
  id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  jobType: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface InAppNotification {
  id: string;
  workspaceId?: string;
  type: string;
  title: string;
  message: string;
  actionPath?: string;
  readAt?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  eventType: string;
  targetType?: string;
  targetId?: string;
  detailsJson: string;
  createdAt: string;
}

export function listDeletedWorkspaces(signal?: AbortSignal) {
  return apiGet<DeletedWorkspace[]>("/api/v1/workspaces/deleted", signal);
}

export function restoreWorkspace(workspaceId: string) {
  return apiRequest<Workspace>(`${workspacePath(workspaceId)}/restore`, { method: "POST" });
}

export function listMemberCandidates(workspaceId: string) {
  return apiGet<StudyMember[]>(`${workspacePath(workspaceId)}/member-candidates`);
}

export function addWorkspaceMember(workspaceId: string, gitlabUserId: number) {
  return apiRequest<Workspace>(`${workspacePath(workspaceId)}/members`, {
    method: "POST",
    body: { gitlabUserId },
  });
}

export function syncWorkspaceMembers(workspaceId: string) {
  return apiRequest<Workspace>(`${workspacePath(workspaceId)}/members/sync`, { method: "POST" });
}

export function updateWorkspaceMemberRole(workspaceId: string, memberId: string, role: StudyMember["role"]) {
  return apiRequest<Workspace>(`${workspacePath(workspaceId)}/members/${encodeURIComponent(memberId)}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export function listSyncJobs(workspaceId: string) {
  return apiGet<SyncJob[]>(`${workspacePath(workspaceId)}/sync-jobs`);
}

export function listAuditEvents(workspaceId: string) {
  return apiGet<AuditEvent[]>(`${workspacePath(workspaceId)}/audit-events`);
}

export function listNotifications() {
  return apiGet<InAppNotification[]>("/api/v1/notifications");
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<InAppNotification>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" });
}

export interface CreateWorkspaceInput {
  name: string;
  gitlabProjectId: number;
  gitlabProjectPath: string;
  defaultBranch: string;
  timezone: string;
}

export interface WorkspaceSyncResult {
  workspace: Workspace;
  importedSessions: number;
  removedSessions: number;
  importedSubmissions: number;
  removedSubmissions: number;
  failures: Array<{
    path: string;
    code: string;
    message: string;
  }>;
  syncedAt: string;
}

export function createWorkspace(input: CreateWorkspaceInput) {
  return apiRequest<Workspace>("/api/v1/workspaces", {
    method: "POST",
    body: input,
  });
}

export function syncWorkspace(workspaceId: string) {
  return apiRequest<WorkspaceSyncResult>(`${workspacePath(workspaceId)}/sync`, {
    method: "POST",
  });
}

export function saveWorkspaceSession(
  workspaceId: string,
  draft: SessionDraft,
  expectedRevision?: number,
) {
  const request = { ...draft, expectedRevision };
  return apiRequest<Workspace>(
    expectedRevision === undefined
      ? `${workspacePath(workspaceId)}/sessions`
      : `${workspacePath(workspaceId)}/sessions/${encodeURIComponent(draft.date)}`,
    {
      method: expectedRevision === undefined ? "POST" : "PUT",
      body: request,
    },
  );
}

export function cancelWorkspaceSession(
  workspaceId: string,
  date: string,
  expectedRevision: number,
) {
  const search = new URLSearchParams({
    expectedRevision: expectedRevision.toString(),
  });
  return apiRequest<Workspace>(
    `${workspacePath(workspaceId)}/sessions/${encodeURIComponent(date)}?${search}`,
    { method: "DELETE" },
  );
}

export function upsertSubmission(
  workspaceId: string,
  date: string,
  itemId: string,
  draft: SubmissionDraft,
) {
  return apiRequest<Workspace>(
    `${workspacePath(workspaceId)}/sessions/${encodeURIComponent(date)}/items/${encodeURIComponent(itemId)}/submission`,
    { method: "PUT", body: draft },
  );
}

export function updateNotifications(
  workspaceId: string,
  notifications: WorkspaceSettings["notifications"],
) {
  return apiRequest<Workspace>(`${workspacePath(workspaceId)}/notifications`, {
    method: "PATCH",
    body: notifications,
  });
}

export function softDeleteWorkspace(workspaceId: string) {
  return apiRequest<Workspace>(workspacePath(workspaceId), {
    method: "DELETE",
  });
}
