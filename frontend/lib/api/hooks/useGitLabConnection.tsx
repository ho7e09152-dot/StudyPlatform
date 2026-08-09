"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getGitLabConnection } from "@/lib/api/services/gitlabApi";
import type { GitLabConnection } from "@/lib/api/types/gitlab";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAuth } from "@/components/providers/AuthProvider";

export type GitLabConnectionState = "loading" | "ready" | "error";

interface GitLabConnectionContextValue {
  data: GitLabConnection | null;
  state: GitLabConnectionState;
  error: string | null;
  reload: () => void;
}

const GitLabConnectionContext =
  createContext<GitLabConnectionContextValue | null>(null);
GitLabConnectionContext.displayName = "GitLabConnectionContext";

export function GitLabConnectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { workspace } = useWorkspace();
  const { mode, user } = useAuth();
  const [data, setData] = useState<GitLabConnection | null>(null);
  const [state, setState] = useState<GitLabConnectionState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      if (mode === "demo") {
        await Promise.resolve();
        if (signal?.aborted) return;
        setData({
          configured: true,
          status: "CONNECTED",
          message: "데모 모드의 가상 GitLab 연결입니다.",
          checkedAt: new Date().toISOString(),
          user,
          project: {
            id: workspace.gitlabProjectId,
            name: workspace.name,
            pathWithNamespace: workspace.gitlabProjectPath,
            defaultBranch: workspace.defaultBranch,
            webUrl: null,
            visibility: "private",
          },
          repositoryTree: [],
        });
        setState("ready");
        return;
      }
      const connection = await getGitLabConnection(workspace.gitlabProjectId, signal);
      setData(connection);
      setState("ready");
    } catch (requestError) {
      if (signal?.aborted) return;
      setData(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "GitLab 연결 상태를 확인하지 못했습니다.",
      );
      setState("error");
    }
  }, [mode, user, workspace]);

  useEffect(() => {
    const controller = new AbortController();
    if (mode === "demo") {
      const demoConnection: GitLabConnection = {
        configured: true,
        status: "CONNECTED",
        message: "데모 모드의 가상 GitLab 연결입니다.",
        checkedAt: new Date().toISOString(),
        user,
        project: {
          id: workspace.gitlabProjectId,
          name: workspace.name,
          pathWithNamespace: workspace.gitlabProjectPath,
          defaultBranch: workspace.defaultBranch,
          webUrl: null,
          visibility: "private",
        },
        repositoryTree: [],
      };
      void Promise.resolve(demoConnection).then((connection) => {
        if (controller.signal.aborted) return;
        setData(connection);
        setState("ready");
      });
    } else {
      void getGitLabConnection(workspace.gitlabProjectId, controller.signal)
        .then((connection) => {
          setData(connection);
          setState("ready");
        })
        .catch((requestError) => {
          if (controller.signal.aborted) return;
          setData(null);
          setError(requestError instanceof Error ? requestError.message : "GitLab 연결 상태를 확인하지 못했습니다.");
          setState("error");
        });
    }
    return () => controller.abort();
  }, [mode, user, workspace]);

  const reload = useCallback(() => {
    setState("loading");
    setError(null);
    void load();
  }, [load]);

  const value = useMemo(
    () => ({ data, state, error, reload }),
    [data, error, reload, state],
  );

  return (
    <GitLabConnectionContext.Provider value={value}>
      {children}
    </GitLabConnectionContext.Provider>
  );
}

export function useGitLabConnection() {
  const context = useContext(GitLabConnectionContext);
  if (!context) {
    throw new Error(
      "useGitLabConnection must be used inside GitLabConnectionProvider",
    );
  }
  return context;
}
