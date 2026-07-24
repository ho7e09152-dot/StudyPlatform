"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { initialWorkspaces } from "@/lib/data/seed";
import { REFERENCE_DATE } from "@/lib/domain/constants";
import { getSubmissionKey } from "@/lib/domain/metrics";
import { toFolderName } from "@/lib/domain/format";
import type {
  SessionDraft,
  StudySession,
  SubmissionDraft,
  Workspace,
} from "@/lib/domain/types";

interface ToastMessage {
  id: number;
  title: string;
  detail?: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  workspace: Workspace;
  currentUserId: string;
  referenceDate: string;
  syncing: boolean;
  toast: ToastMessage | null;
  switchWorkspace: (workspaceId: string) => void;
  syncWorkspace: () => Promise<void>;
  submitItem: (
    date: string,
    itemId: string,
    draft: SubmissionDraft,
  ) => Promise<void>;
  saveSession: (
    draft: SessionDraft,
    expectedRevision?: number,
  ) => Promise<void>;
  cancelSession: (date: string) => Promise<void>;
  toggleNotification: (
    key: keyof Workspace["settings"]["notifications"],
  ) => void;
  dismissToast: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function cloneSeed() {
  return structuredClone(initialWorkspaces);
}

function makeCommitId() {
  return `commit-${Math.random().toString(36).slice(2, 10)}`;
}

function reconcileItems(
  current: StudySession | undefined,
  draft: SessionDraft,
) {
  if (!current) {
    return { active: draft.items, archived: [] };
  }

  const nextIds = new Set(draft.items.map((item) => item.id));
  const newlyArchived = current.items
    .filter((item) => item.status === "active" && !nextIds.has(item.id))
    .map((item) => ({ ...item, status: "cancelled" as const }));

  return {
    active: draft.items.map((item, index) => ({
      ...item,
      order: index + 1,
      status: "active" as const,
    })),
    archived: [...current.archivedItems, ...newlyArchived],
  };
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(cloneSeed);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(
    initialWorkspaces[0].id,
  );
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const currentUserId = "member-a";

  const workspace = useMemo(
    () =>
      workspaces.find((candidate) => candidate.id === currentWorkspaceId) ??
      workspaces[0],
    [currentWorkspaceId, workspaces],
  );

  const notify = useCallback((title: string, detail?: string) => {
    setToast({ id: Date.now(), title, detail });
  }, []);

  const updateCurrentWorkspace = useCallback(
    (updater: (workspace: Workspace) => Workspace) => {
      setWorkspaces((current) =>
        current.map((candidate) =>
          candidate.id === currentWorkspaceId ? updater(candidate) : candidate,
        ),
      );
    },
    [currentWorkspaceId],
  );

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      setCurrentWorkspaceId(workspaceId);
      const next = workspaces.find((candidate) => candidate.id === workspaceId);
      notify("Workspace를 전환했습니다", next?.gitlabProjectPath);
    },
    [notify, workspaces],
  );

  const syncWorkspace = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    const now = new Date().toISOString();
    updateCurrentWorkspace((current) => ({
      ...current,
      lastSyncedAt: now,
    }));
    setSyncing(false);
    notify("GitLab 동기화 완료", "연결된 프로젝트의 최신 상태를 반영했습니다.");
  }, [notify, syncing, updateCurrentWorkspace]);

  const submitItem = useCallback(
    async (date: string, itemId: string, draft: SubmissionDraft) => {
      const session = workspace.sessions[date];
      const member = workspace.members.find(
        (candidate) => candidate.id === currentUserId,
      );
      const item = session?.items.find((candidate) => candidate.id === itemId);

      if (!session || !member || !item) {
        throw new Error("ITEM_NOT_FOUND");
      }

      if (item.submitType !== draft.type) {
        throw new Error("SUBMISSION_TYPE_MISMATCH");
      }

      const commitMessage = draft.commitMessage.trim();
      if (!commitMessage) {
        throw new Error("COMMIT_MESSAGE_REQUIRED");
      }

      const key = getSubmissionKey(session.folder, member.id);
      const previousFile = workspace.submissions[key];
      const now = new Date().toISOString();
      const previousEntry = previousFile?.submissions.find(
        (entry) => entry.itemId === itemId,
      );
      const submissions = [
        ...(previousFile?.submissions.filter(
          (entry) => entry.itemId !== itemId,
        ) ?? []),
        {
          itemId,
          type: draft.type,
          value: draft.value,
          language: draft.language,
          submittedAt: previousEntry?.submittedAt ?? now,
          updatedAt: now,
        },
      ].sort((a, b) => a.itemId.localeCompare(b.itemId));

      updateCurrentWorkspace((current) => ({
        ...current,
        submissions: {
          ...current.submissions,
          [key]: {
            version: 1,
            memberId: member.id,
            gitlabUserId: member.gitlabUserId,
            username: member.username,
            date: session.folder,
            sessionRevision: session.revision,
            sessionType: session.type,
            updatedAt: now,
            submissions,
            lastCommitId: makeCommitId(),
            lastCommitMessage: commitMessage,
          },
        },
      }));

      await new Promise((resolve) => setTimeout(resolve, 350));
      notify(
        previousEntry ? "제출을 수정했습니다" : "항목을 제출했습니다",
        commitMessage,
      );
    },
    [currentUserId, notify, updateCurrentWorkspace, workspace],
  );

  const saveSession = useCallback(
    async (draft: SessionDraft, expectedRevision?: number) => {
      const current = workspace.sessions[draft.date];
      if (current && expectedRevision !== current.revision) {
        throw new Error("SESSION_REVISION_CONFLICT");
      }

      const actor = workspace.members.find(
        (member) => member.id === currentUserId,
      );
      if (!actor) throw new Error("WORKSPACE_ACCESS_DENIED");

      const hasSubmissions = current
        ? Object.keys(workspace.submissions).some((key) =>
            key.startsWith(`${current.folder}/`),
          )
        : false;
      if (current && hasSubmissions && !draft.changeReason.trim()) {
        throw new Error("CHANGE_REASON_REQUIRED");
      }

      const { active, archived } = reconcileItems(current, draft);
      const now = new Date().toISOString();
      const nextSession: StudySession = {
        date: draft.date,
        folder: current?.folder ?? toFolderName(draft.date),
        revision: (current?.revision ?? 0) + 1,
        type: draft.type,
        title: draft.title,
        description: draft.description,
        status: "active",
        deadline: draft.deadline,
        secondaryDeadline: draft.secondaryDeadline,
        createdAt: current?.createdAt ?? now,
        createdBy: current?.createdBy ?? actor.username,
        updatedAt: now,
        updatedBy: actor.username,
        change: current
          ? {
              changed: true,
              message: "학습 일정과 항목이 수정되었습니다.",
              reason: draft.changeReason,
            }
          : undefined,
        items: active,
        archivedItems: archived,
        lastCommitId: makeCommitId(),
      };

      updateCurrentWorkspace((candidate) => ({
        ...candidate,
        sessions: {
          ...candidate.sessions,
          [draft.date]: nextSession,
        },
      }));
      await new Promise((resolve) => setTimeout(resolve, 350));
      notify(
        current ? "일정을 수정했습니다" : "새 일정을 만들었습니다",
        `${nextSession.folder}/session.yml · revision ${nextSession.revision}`,
      );
    },
    [currentUserId, notify, updateCurrentWorkspace, workspace],
  );

  const cancelSession = useCallback(
    async (date: string) => {
      const session = workspace.sessions[date];
      if (!session) return;
      updateCurrentWorkspace((current) => ({
        ...current,
        sessions: {
          ...current.sessions,
          [date]: {
            ...session,
            status: "cancelled",
            revision: session.revision + 1,
            updatedAt: new Date().toISOString(),
            lastCommitId: makeCommitId(),
          },
        },
      }));
      notify("일정을 취소했습니다", "파일은 삭제하지 않고 cancelled 상태로 보존합니다.");
    },
    [notify, updateCurrentWorkspace, workspace.sessions],
  );

  const toggleNotification = useCallback(
    (key: keyof Workspace["settings"]["notifications"]) => {
      updateCurrentWorkspace((current) => ({
        ...current,
        settings: {
          ...current.settings,
          notifications: {
            ...current.settings.notifications,
            [key]: !current.settings.notifications[key],
          },
        },
      }));
    },
    [updateCurrentWorkspace],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      workspace,
      currentUserId,
      referenceDate: REFERENCE_DATE,
      syncing,
      toast,
      switchWorkspace,
      syncWorkspace,
      submitItem,
      saveSession,
      cancelSession,
      toggleNotification,
      dismissToast: () => setToast(null),
    }),
    [
      cancelSession,
      saveSession,
      submitItem,
      switchWorkspace,
      syncWorkspace,
      syncing,
      toast,
      toggleNotification,
      workspace,
      workspaces,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
