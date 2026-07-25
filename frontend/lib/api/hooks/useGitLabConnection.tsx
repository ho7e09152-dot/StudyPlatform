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
  const [data, setData] = useState<GitLabConnection | null>(null);
  const [state, setState] = useState<GitLabConnectionState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const connection = await getGitLabConnection(signal);
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
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getGitLabConnection(controller.signal)
      .then((connection) => {
        setData(connection);
        setState("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "GitLab 연결 상태를 확인하지 못했습니다.",
        );
        setState("error");
      });
    return () => controller.abort();
  }, []);

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
