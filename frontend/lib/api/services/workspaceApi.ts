import { apiGet, apiRequest } from "@/lib/api/client/http";
import type {
  SessionDraft,
  SubmissionDraft,
  Workspace,
  WorkspaceSettings,
  StudyMember,
} from "@/lib/domain/types";
import type { ProviderId } from "@/lib/providers/provider-descriptors";
import type { RepositoryStorageLayout } from "@/lib/domain/repository-storage-layout";

function workspacePath(workspaceId: string) {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
}

export function listWorkspaces(signal?: AbortSignal) {
  return apiGet<Workspace[]>("/api/v1/workspaces", signal);
}

export interface DiscoverableWorkspace {
  workspaceId: string;
  workspaceName: string;
  provider: ProviderId;
  externalRepositoryId: string;
  repositoryFullName: string;
  repositoryId: string;
  repositoryPath: string;
  defaultBranch?: string | null;
  eligibility: "REPOSITORY_WRITE_CONFIRMED";
}

export interface WorkspaceJoinResponse {
  workspace: Workspace;
  joined: boolean;
}

export function listDiscoverableWorkspaces(signal?: AbortSignal) {
  return apiGet<DiscoverableWorkspace[]>("/api/v1/workspaces/discoverable", signal);
}

export function joinWorkspace(workspaceId: string) {
  return apiRequest<WorkspaceJoinResponse>(`${workspacePath(workspaceId)}/join`, { method: "POST" });
}

export function updateWorkspaceSettings(
  workspaceId: string,
  input: { name: string; settings: WorkspaceSettings },
) {
  return apiRequest<Workspace>(workspacePath(workspaceId), {
    method: "PATCH",
    body: input,
  });
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

export function listNotifications(signal?: AbortSignal) {
  return apiGet<InAppNotification[]>("/api/v1/notifications", signal);
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<InAppNotification>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, { method: "PATCH" });
}

export interface WorkspaceAnnouncement {
  id: string;
  authorName: string;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string;
  expiresAt?: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface WorkspaceMessage {
  id: string;
  authorName: string;
  contextDate: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  canEdit: boolean;
}

export interface WorkspaceMessagePage {
  items: WorkspaceMessage[];
  nextCursor?: string;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  pinned: boolean;
  publishedAt?: string;
  expiresAt?: string;
}

export function listWorkspaceAnnouncements(workspaceId: string, signal?: AbortSignal) {
  return apiGet<WorkspaceAnnouncement[]>(`${workspacePath(workspaceId)}/announcements`, signal);
}

export function createWorkspaceAnnouncement(workspaceId: string, input: AnnouncementInput) {
  return apiRequest<WorkspaceAnnouncement>(`${workspacePath(workspaceId)}/announcements`, { method: "POST", body: input });
}

export function updateWorkspaceAnnouncement(workspaceId: string, announcementId: string, input: AnnouncementInput) {
  return apiRequest<WorkspaceAnnouncement>(`${workspacePath(workspaceId)}/announcements/${encodeURIComponent(announcementId)}`, { method: "PATCH", body: input });
}

export function deleteWorkspaceAnnouncement(workspaceId: string, announcementId: string) {
  return apiRequest<void>(`${workspacePath(workspaceId)}/announcements/${encodeURIComponent(announcementId)}`, { method: "DELETE" });
}

export function listWorkspaceMessages(workspaceId: string, options: { date?: string; cursor?: string } = {}, signal?: AbortSignal) {
  const search = new URLSearchParams();
  if (options.date) search.set("date", options.date);
  if (options.cursor) search.set("cursor", options.cursor);
  const query = search.size ? `?${search}` : "";
  return apiGet<WorkspaceMessagePage>(`${workspacePath(workspaceId)}/messages${query}`, signal);
}

export function createWorkspaceMessage(workspaceId: string, body: string, contextDate: string) {
  return apiRequest<WorkspaceMessage>(`${workspacePath(workspaceId)}/messages`, { method: "POST", body: { body, contextDate } });
}

export function updateWorkspaceMessage(workspaceId: string, messageId: string, body: string) {
  return apiRequest<WorkspaceMessage>(`${workspacePath(workspaceId)}/messages/${encodeURIComponent(messageId)}`, { method: "PATCH", body: { body } });
}

export function deleteWorkspaceMessage(workspaceId: string, messageId: string) {
  return apiRequest<void>(`${workspacePath(workspaceId)}/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
}

export interface WorkspaceDocument {
  id: string;
  authorName: string;
  title: string;
  bodyMarkdown: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
}

export interface WorkspaceDocumentPage {
  items: WorkspaceDocument[];
  nextCursor?: string;
}

export function listWorkspaceDocuments(workspaceId: string, options: { query?: string; cursor?: string } = {}, signal?: AbortSignal) {
  const search = new URLSearchParams();
  if (options.query) search.set("query", options.query);
  if (options.cursor) search.set("cursor", options.cursor);
  const query = search.size ? `?${search}` : "";
  return apiGet<WorkspaceDocumentPage>(`${workspacePath(workspaceId)}/documents${query}`, signal);
}

export function getWorkspaceDocument(workspaceId: string, documentId: string, signal?: AbortSignal) {
  return apiGet<WorkspaceDocument>(`${workspacePath(workspaceId)}/documents/${encodeURIComponent(documentId)}`, signal);
}

export function createWorkspaceDocument(workspaceId: string, title: string, bodyMarkdown: string) {
  return apiRequest<WorkspaceDocument>(`${workspacePath(workspaceId)}/documents`, { method: "POST", body: { title, bodyMarkdown } });
}

export function updateWorkspaceDocument(workspaceId: string, documentId: string, title: string, bodyMarkdown: string, expectedVersion: number) {
  return apiRequest<WorkspaceDocument>(`${workspacePath(workspaceId)}/documents/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    body: { title, bodyMarkdown, expectedVersion },
  });
}

export function deleteWorkspaceDocument(workspaceId: string, documentId: string, expectedVersion: number) {
  const search = new URLSearchParams({ expectedVersion: expectedVersion.toString() });
  return apiRequest<void>(`${workspacePath(workspaceId)}/documents/${encodeURIComponent(documentId)}?${search}`, { method: "DELETE" });
}

export interface CreateWorkspaceInput {
  name: string;
  provider: ProviderId;
  externalRepositoryId: string;
  gitlabProjectId?: number;
  gitlabProjectPath: string;
  defaultBranch: string;
  timezone: string;
  repositoryBasePath: string;
  repositorySchemaVersion: number;
  importMode: string;
  expectedTreeFingerprint: string;
  storageLayout?: RepositoryStorageLayout;
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

export interface RepositorySchemaMigrationPreview {
  currentSchemaVersion: number;
  targetSchemaVersion: number;
  currentBasePath: string;
  targetBasePath: string;
  treeFingerprint: string;
  sessionFiles: number;
  submissionFiles: number;
  totalMoves: number;
  ready: boolean;
  moves: Array<{
    sourcePath: string;
    targetPath: string;
    type: "SESSION" | "SUBMISSION";
  }>;
  blockers: Array<{
    path: string;
    code: string;
    message: string;
  }>;
}

export interface RepositorySchemaMigrationResult {
  workspace: Workspace;
  commitId: string;
  movedFiles: number;
  failures: WorkspaceSyncResult["failures"];
  syncedAt: string;
}

export interface SubmissionReviewThread {
  memberId: string;
  memberName: string;
  filePath: string;
  commitId: string;
  comments: Array<{
    id: string;
    body: string;
    authorGitLabUserId: number;
    authorUsername: string;
    authorName: string;
    authorAvatarUrl?: string;
    createdAt: string;
  }>;
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

export function getRepositorySchemaMigrationPreview(workspaceId: string) {
  return apiGet<RepositorySchemaMigrationPreview>(
    `${workspacePath(workspaceId)}/repository-schema/migration`,
  );
}

export function migrateRepositorySchema(workspaceId: string, expectedTreeFingerprint: string) {
  return apiRequest<RepositorySchemaMigrationResult>(
    `${workspacePath(workspaceId)}/repository-schema/migrate`,
    { method: "POST", body: { expectedTreeFingerprint } },
  );
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

function submissionReviewPath(workspaceId: string, date: string, memberId: string) {
  return `${workspacePath(workspaceId)}/sessions/${encodeURIComponent(date)}/members/${encodeURIComponent(memberId)}/reviews`;
}

export function getSubmissionReviews(
  workspaceId: string,
  date: string,
  memberId: string,
  signal?: AbortSignal,
) {
  return apiGet<SubmissionReviewThread>(
    submissionReviewPath(workspaceId, date, memberId),
    signal,
  );
}

export function createSubmissionReview(
  workspaceId: string,
  date: string,
  memberId: string,
  body: string,
) {
  return apiRequest<SubmissionReviewThread>(
    submissionReviewPath(workspaceId, date, memberId),
    { method: "POST", body: { body } },
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
