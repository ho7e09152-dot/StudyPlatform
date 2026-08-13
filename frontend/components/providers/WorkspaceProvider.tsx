"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addWorkspaceMember,
  cancelWorkspaceSession,
  listWorkspaces,
	joinWorkspace as joinWorkspaceApi,
  saveWorkspaceSession,
  softDeleteWorkspace,
  migrateRepositorySchema,
  syncWorkspace as syncWorkspaceApi,
  syncWorkspaceMembers,
  updateWorkspaceMemberRole,
  updateNotifications,
  updateWorkspaceSettings,
  upsertSubmission,
} from "@/lib/api/services/workspaceApi";
import { useAuth } from "@/components/providers/AuthProvider";
import { WorkspaceEntryGate } from "@/components/workspaces/WorkspaceEntryGate";
import { usePathname } from "next/navigation";
import { initialWorkspaces } from "@/lib/data/seed";
import { REFERENCE_DATE } from "@/lib/domain/constants";
import { getSubmissionKey } from "@/lib/domain/metrics";
import { getDateKeyInTimeZone, toFolderName } from "@/lib/domain/format";
import { APP_ROLE_LABEL, canManageSchedules } from "@/lib/domain/permissions";
import { getUserFacingError } from "@/lib/api/errors";
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
  lastSyncFailures: Array<{ path: string; code: string; message: string }>;
  toast: ToastMessage | null;
	notify: (title: string, detail?: string) => void;
  switchWorkspace: (workspaceId: string) => void;
	activateWorkspace: (workspace: Workspace, message?: string) => void;
	joinDiscoveredWorkspace: (workspaceId: string) => Promise<Workspace>;
  syncWorkspace: () => Promise<void>;
  syncMembers: () => Promise<void>;
  addMember: (gitlabUserId: number) => Promise<void>;
  updateMemberRole: (memberId: string, role: Workspace["members"][number]["role"]) => Promise<void>;
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
  ) => Promise<void>;
  saveWorkspaceGeneral: (name: string, timezone: string) => Promise<void>;
  saveCommitRules: (rules: Workspace["settings"]["commitRules"]) => Promise<void>;
  deleteCurrentWorkspace: () => Promise<void>;
  migrateRepositoryLayout: (treeFingerprint: string) => Promise<void>;
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
	const pathname = usePathname();
  const { mode, user, checking: checkingAuth } = useAuth();
  const demoMode = mode === "demo";
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() =>
    demoMode ? cloneSeed() : [],
  );
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(
    demoMode ? initialWorkspaces[0].id : "",
  );
  const [syncing, setSyncing] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [loading, setLoading] = useState(!demoMode);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [lastSyncFailures, setLastSyncFailures] = useState<
    Array<{ path: string; code: string; message: string }>
  >([]);
  const workspaceScopeVersion = useRef(0);

  const selectedWorkspace = useMemo(
    () =>
      workspaces.find((candidate) => candidate.id === currentWorkspaceId) ??
      workspaces[0],
    [currentWorkspaceId, workspaces],
  );
  const workspace = selectedWorkspace ?? initialWorkspaces[0];
  const currentUserId = demoMode
    ? "member-a"
    : selectedWorkspace?.members.find(
        (member) => (member.userId === user?.id || member.gitlabUserId === user?.legacyGitLabUserId) && member.status === "ACTIVE",
      )?.id ?? "";

  const notify = useCallback((title: string, detail?: string) => {
    setToast({ id: Date.now(), title, detail });
  }, []);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    void listWorkspaces(controller.signal)
      .then((loaded) => {
        setWorkspaces(loaded);
        setCurrentWorkspaceId((current) => {
          if (!loaded.length) return "";
          return loaded.some((workspace) => workspace.id === current)
            ? current
            : loaded[0].id;
        });
        setBackendConnected(true);
        setLoadError("");
        setLoading(false);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setBackendConnected(false);
        setLoadError(getUserFacingError(requestError, "Workspace를 불러오지 못했습니다."));
        setLoading(false);
      });

    return () => controller.abort();
  }, [demoMode]);

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

  const replaceWorkspace = useCallback((updated: Workspace) => {
    setWorkspaces((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
  }, []);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspaceId === currentWorkspaceId) return;
      workspaceScopeVersion.current += 1;
      setLastSyncFailures([]);
      setSyncing(false);
      setCurrentWorkspaceId(workspaceId);
      const next = workspaces.find((candidate) => candidate.id === workspaceId);
      notify("Workspace를 전환했습니다", next?.gitlabProjectPath);
    },
    [currentWorkspaceId, notify, workspaces],
  );

	const activateWorkspace = useCallback((next: Workspace, message = "Workspace를 전환했습니다") => {
		workspaceScopeVersion.current += 1;
		setWorkspaces((current) => [
			...current.filter((candidate) => candidate.id !== next.id),
			next,
		]);
		setCurrentWorkspaceId(next.id);
		setBackendConnected(true);
		setLastSyncFailures([]);
		setSyncing(false);
		notify(message, next.name);
	}, [notify]);

	const joinDiscoveredWorkspace = useCallback(async (workspaceId: string) => {
		const result = await joinWorkspaceApi(workspaceId);
		activateWorkspace(result.workspace, result.joined ? "Workspace에 참여했어요" : "이미 참여 중인 Workspace입니다");
		return result.workspace;
	}, [activateWorkspace]);

  const syncWorkspace = useCallback(async () => {
    if (syncing) return;
    const scopeVersion = workspaceScopeVersion.current;
    setSyncing(true);
    try {
      if (backendConnected) {
        const result = await syncWorkspaceApi(workspace.id);
        replaceWorkspace(result.workspace);
        if (workspaceScopeVersion.current !== scopeVersion) return;
        setLastSyncFailures(result.failures);
        if (result.failures.length > 0) {
          notify(
            "일부 일정 동기화 실패",
            `일정 ${result.importedSessions}개 · 제출 ${result.importedSubmissions}개 반영 · 확인할 파일 ${result.failures.length}개`,
          );
        } else {
          notify(
            "GitLab 일정 동기화 완료",
            `일정 ${result.importedSessions}개 · 제출 ${result.importedSubmissions}개를 반영했습니다.`,
          );
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 800));
        updateCurrentWorkspace((current) => ({
          ...current,
          lastSyncedAt: new Date().toISOString(),
        }));
        notify("데모 동기화 완료", "데모 Workspace의 동기화 시간을 갱신했습니다.");
      }
    } catch (error) {
      if (workspaceScopeVersion.current !== scopeVersion) return;
      setLastSyncFailures([
        {
          path: workspace.gitlabProjectPath,
          code: "SYNC_FAILED",
          message: getUserFacingError(error, "GitLab 일정을 불러오지 못했습니다."),
        },
      ]);
      notify(
        "GitLab 일정 동기화 실패",
        getUserFacingError(error, "GitLab 일정을 불러오지 못했습니다."),
      );
    } finally {
      if (workspaceScopeVersion.current === scopeVersion) setSyncing(false);
    }
  }, [backendConnected, notify, replaceWorkspace, syncing, updateCurrentWorkspace, workspace.gitlabProjectPath, workspace.id]);

  const syncMembers = useCallback(async () => {
    if (!backendConnected) {
      notify("데모에서는 멤버를 동기화하지 않습니다");
      return;
    }
    const updated = await syncWorkspaceMembers(workspace.id);
    replaceWorkspace(updated);
    notify("GitLab 멤버 동기화 완료", `${updated.members.length}명의 상태와 권한을 확인했습니다.`);
  }, [backendConnected, notify, replaceWorkspace, workspace.id]);

  const addMember = useCallback(async (gitlabUserId: number) => {
    if (!backendConnected) {
      notify("데모에서는 멤버를 추가하지 않습니다");
      return;
    }
    const updated = await addWorkspaceMember(workspace.id, gitlabUserId);
    replaceWorkspace(updated);
    notify("Workspace 멤버를 추가했습니다");
  }, [backendConnected, notify, replaceWorkspace, workspace.id]);

  const updateMemberRole = useCallback(async (memberId: string, role: Workspace["members"][number]["role"]) => {
    if (!backendConnected) return;
    const updated = await updateWorkspaceMemberRole(workspace.id, memberId, role);
    replaceWorkspace(updated);
    notify("멤버 역할을 변경했습니다", APP_ROLE_LABEL[role]);
  }, [backendConnected, notify, replaceWorkspace, workspace.id]);

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

      if (backendConnected) {
        const previousFile = workspace.submissions[
          getSubmissionKey(session.folder, member.id)
        ];
        const previousEntry = previousFile?.submissions.find(
          (entry) => entry.itemId === itemId,
        );
        const updatedWorkspace = await upsertSubmission(
          workspace.id,
          date,
          itemId,
          {
            ...draft,
            expectedFileCommitId: previousFile?.lastCommitId,
            commitMessage,
          },
        );
        replaceWorkspace(updatedWorkspace);
        notify(
          previousEntry ? "제출을 수정했습니다" : "항목을 제출했습니다",
          commitMessage,
        );
        return;
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
            username: member.displayName,
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
    [backendConnected, currentUserId, notify, replaceWorkspace, updateCurrentWorkspace, workspace],
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
      if (!canManageSchedules(actor)) throw new Error("WORKSPACE_MANAGER_REQUIRED");

      const hasSubmissions = current
        ? Object.keys(workspace.submissions).some((key) =>
            key.startsWith(`${current.folder}/`),
          )
        : false;
      if (current && hasSubmissions && !draft.changeReason.trim()) {
        throw new Error("CHANGE_REASON_REQUIRED");
      }

      if (backendConnected) {
        const updated = await saveWorkspaceSession(
          workspace.id,
          draft,
          expectedRevision,
        );
        replaceWorkspace(updated);
        notify(
          current ? "일정을 수정했습니다" : "새 일정을 만들었습니다",
          "팀 학습 일정에 반영했습니다.",
        );
        return;
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
		createdBy: current?.createdBy ?? actor.displayName,
        updatedAt: now,
		updatedBy: actor.displayName,
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
        "팀 학습 일정에 반영했습니다.",
      );
    },
    [backendConnected, currentUserId, notify, replaceWorkspace, updateCurrentWorkspace, workspace],
  );

  const cancelSession = useCallback(
    async (date: string) => {
      const session = workspace.sessions[date];
      if (!session) return;
      const actor = workspace.members.find((member) => member.id === currentUserId);
      if (!canManageSchedules(actor)) throw new Error("WORKSPACE_MANAGER_REQUIRED");
      if (backendConnected) {
        replaceWorkspace(
          await cancelWorkspaceSession(workspace.id, date, session.revision),
        );
        notify("일정을 취소했습니다", "일정 기록은 삭제하지 않고 취소 상태로 보존합니다.");
        return;
      }
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
      notify("일정을 취소했습니다", "일정 기록은 삭제하지 않고 취소 상태로 보존합니다.");
    },
    [backendConnected, currentUserId, notify, replaceWorkspace, updateCurrentWorkspace, workspace.id, workspace.members, workspace.sessions],
  );

  const toggleNotification = useCallback(
    async (key: keyof Workspace["settings"]["notifications"]) => {
      const notifications = {
        ...workspace.settings.notifications,
        [key]: !workspace.settings.notifications[key],
      };
      try {
        if (backendConnected) {
          replaceWorkspace(await updateNotifications(workspace.id, notifications));
        } else {
          updateCurrentWorkspace((current) => ({
            ...current,
            settings: { ...current.settings, notifications },
          }));
        }
        notify("알림 설정을 저장했습니다");
      } catch (error) {
        notify("알림 설정 저장 실패", "잠시 후 다시 시도해 주세요.");
        throw error;
      }
    },
    [backendConnected, notify, replaceWorkspace, updateCurrentWorkspace, workspace.id, workspace.settings.notifications],
  );

  const saveWorkspaceGeneral = useCallback(async (name: string, timezone: string) => {
    const next = {
      ...workspace,
      name: name.trim(),
      settings: { ...workspace.settings, timezone: timezone.trim() },
    };
    if (!backendConnected) {
      replaceWorkspace(next);
      notify("Workspace 정보를 저장했습니다");
      return;
    }
    const updated = await updateWorkspaceSettings(workspace.id, {
      name: next.name,
      settings: next.settings,
    });
    replaceWorkspace(updated);
    notify("Workspace 정보를 저장했습니다");
  }, [backendConnected, notify, replaceWorkspace, workspace]);

  const saveCommitRules = useCallback(async (rules: Workspace["settings"]["commitRules"]) => {
    const next = {
      ...workspace,
      settings: { ...workspace.settings, commitRules: rules },
    };
    if (!backendConnected) {
      replaceWorkspace(next);
      notify("커밋 규칙을 저장했습니다");
      return;
    }
    const updated = await updateWorkspaceSettings(workspace.id, {
      name: workspace.name,
      settings: next.settings,
    });
    replaceWorkspace(updated);
    notify("커밋 규칙을 저장했습니다");
  }, [backendConnected, notify, replaceWorkspace, workspace]);

  const deleteCurrentWorkspace = useCallback(async () => {
    if (backendConnected) {
      await softDeleteWorkspace(workspace.id);
    }
    const remaining = workspaces.filter(
      (candidate) => candidate.id !== workspace.id,
    );
    setWorkspaces(remaining);
    setCurrentWorkspaceId(remaining[0]?.id ?? "");
    notify("Workspace를 소프트 삭제했습니다", "GitLab 파일은 변경하지 않았습니다.");
  }, [backendConnected, notify, workspace.id, workspaces]);

  const migrateRepositoryLayout = useCallback(async (treeFingerprint: string) => {
    if (!backendConnected) throw new Error("실제 GitLab 연결에서만 저장 구조를 변경할 수 있습니다.");
    const result = await migrateRepositorySchema(workspace.id, treeFingerprint);
    replaceWorkspace(result.workspace);
    setLastSyncFailures(result.failures);
    notify(
      "저장 구조를 V2로 변경했습니다",
      `${result.movedFiles}개 파일 이동 · ${result.commitId.slice(0, 12)}`,
    );
  }, [backendConnected, notify, replaceWorkspace, workspace.id]);

  const value: WorkspaceContextValue = {
    workspaces,
    workspace,
    currentUserId,
    referenceDate: demoMode
      ? REFERENCE_DATE
      : getDateKeyInTimeZone(new Date(), workspace.settings.timezone),
    syncing,
    lastSyncFailures,
    toast,
		notify,
    switchWorkspace,
		activateWorkspace,
		joinDiscoveredWorkspace,
    syncWorkspace,
    syncMembers,
    addMember,
    updateMemberRole,
    submitItem,
    saveSession,
    cancelSession,
    toggleNotification,
    saveWorkspaceGeneral,
    saveCommitRules,
    deleteCurrentWorkspace,
    migrateRepositoryLayout,
    dismissToast: () => setToast(null),
  };

  if (loading || checkingAuth) {
    return null;
  }

  if (loadError) {
    return (
      <main className="app-bootstrap app-bootstrap--error" role="alert">
        <strong>Workspace를 불러오지 못했습니다</strong>
        <span>{loadError}</span>
        <button type="button" className="button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  }

  if (!selectedWorkspace || !currentUserId) {
		return <WorkspaceEntryGate forceConnection={pathname === "/workspaces/new"} onWorkspaceReady={(created) => {
			setWorkspaces((current) => [...current.filter((candidate) => candidate.id !== created.id), created]);
			setCurrentWorkspaceId(created.id);
			setBackendConnected(true);
		}} />;
  }

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
