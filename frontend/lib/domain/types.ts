import type { RepositoryStorageLayout } from "./repository-storage-layout";

export type SessionType = "algorithm" | "english" | "cs" | "free";

export type SubmissionType = "link" | "text" | "code" | "mixed";

export type SessionStatus = "active" | "cancelled";

export type ItemStatus = "active" | "cancelled" | "replaced";

export interface StudyMember {
  id: string;
  gitlabUserId: number;
  username: string;
  displayName: string;
  avatar: string;
  color: string;
  fileName: string;
  role: "OWNER" | "MANAGER" | "MEMBER";
  status: "ACTIVE" | "PROJECT_ACCESS_LOST";
  accessLevel: number;
  userId?: string | null;
}

export interface SessionItem {
  id: string;
  order: number;
  title: string;
  type: SessionType;
  source?: string;
  url?: string;
  submitType: SubmissionType;
  required: boolean;
  status: ItemStatus;
  replaces?: string;
  replacedBy?: string;
}

export interface StudySession {
  date: string;
  folder: string;
  revision: number;
  type: SessionType;
  title: string;
  description: string;
  status: SessionStatus;
  deadline: string;
  secondaryDeadline?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  change?: {
    changed: boolean;
    message: string;
    reason: string;
  };
  items: SessionItem[];
  archivedItems: SessionItem[];
  lastCommitId: string;
}

export interface SubmissionEntry {
  itemId: string;
  type: SubmissionType;
  value: string;
  language?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface MemberSubmissionFile {
  version: 1;
  memberId: string;
  gitlabUserId: number;
  username: string;
  date: string;
  sessionRevision: number;
  sessionType: SessionType;
  updatedAt: string;
  submissions: SubmissionEntry[];
  reflection?: string;
  lastCommitId: string;
  lastCommitMessage?: string;
}

export interface WorkspaceSettings {
  timezone: string;
  requireChangeNoteWhenSubmitted: boolean;
  commitRules: CommitRules;
  notifications: {
    scheduleChanges: boolean;
    submissionMismatch: boolean;
    syncFailures: boolean;
  };
}

export interface CommitRules {
  submissionTemplate: string;
  submissionGuidance: string;
}

export interface Workspace {
  id: string;
  name: string;
  gitlabProjectId: number;
  gitlabProjectPath: string;
  defaultBranch: string;
  repositoryBasePath: string;
  repositorySchemaVersion: number;
  importMode: "EMPTY" | "COMPATIBLE" | "LEGACY" | "DETECTED" | "PARTIALLY_COMPATIBLE";
  status: "ACTIVE" | "SOFT_DELETED";
  lastSyncedAt: string;
  members: StudyMember[];
  sessions: Record<string, StudySession>;
  submissions: Record<string, MemberSubmissionFile>;
  settings: WorkspaceSettings;
  repository?: {
    provider: "GITLAB" | "GITHUB";
    externalRepositoryId: string;
    fullName: string;
    webUrl?: string | null;
    visibility?: string | null;
    defaultBranch?: string | null;
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
    providerPermission?: string | null;
  } | null;
  storageLayout?: RepositoryStorageLayout | null;
}

export interface DashboardMetrics {
  completedMembers: number;
  totalMembers: number;
  memberCompletionRate: number;
  submittedItems: number;
  totalRequiredSubmissions: number;
  submissionRate: number;
}

export interface MemberProgress {
  member: StudyMember;
  completedItems: number;
  requiredItems: number;
  completionRate: number;
  status: "NOT_STARTED" | "PARTIAL" | "COMPLETE";
  lastSubmittedAt?: string;
}

export interface SessionDraft {
  date: string;
  /** 첫 번째 항목 유형에서 파생되는 하위 호환용 대표 유형 */
  type: SessionType;
  title: string;
  description: string;
  deadline: string;
  secondaryDeadline?: string;
  changeReason: string;
  items: SessionItem[];
}

export interface SubmissionDraft {
  type: SubmissionType;
  value: string;
  language?: string;
  expectedFileCommitId?: string;
  commitMessage: string;
}
