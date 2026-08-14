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
import { getRepository, type RepositorySummaryDto } from "@/lib/api/services/repositoryApi";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { ApiError } from "@/lib/api/client/http";
import { getWorkspaceRepositoryConnection } from "@/lib/domain/repository";
import { getProviderDescriptor } from "@/lib/providers/provider-descriptors";

export type RepositoryConnectionState = "loading" | "ready" | "error";

interface RepositoryConnectionContextValue {
  data: RepositorySummaryDto | null;
  state: RepositoryConnectionState;
  error: string | null;
  errorCode: string | null;
  reload: () => void;
}

const RepositoryConnectionContext =
  createContext<RepositoryConnectionContextValue | null>(null);
RepositoryConnectionContext.displayName = "RepositoryConnectionContext";

export function RepositoryConnectionProvider({ children }: { children: ReactNode }) {
  const { workspace } = useWorkspace();
  const { mode } = useAuth();
  const repository = getWorkspaceRepositoryConnection(workspace);
  const [data, setData] = useState<RepositorySummaryDto | null>(null);
  const [state, setState] = useState<RepositoryConnectionState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setData(null);
    setState("loading");
    setError(null);
    setErrorCode(null);
    try {
      const result = mode === "demo"
        ? {
            provider: repository.provider,
            externalId: repository.externalRepositoryId,
            name: workspace.name,
            fullName: repository.fullName ?? workspace.gitlabProjectPath,
            visibility: repository.visibility ?? "private",
            defaultBranch: repository.defaultBranch ?? workspace.defaultBranch,
            webUrl: repository.webUrl ?? null,
            capabilities: { canRead: true, canWrite: true, canManage: true },
            providerPermission: "ADMIN",
            connectionState: "AVAILABLE",
          } satisfies RepositorySummaryDto
        : await getRepository(repository.provider, repository.externalRepositoryId, signal);
      if (signal?.aborted) return;
      setData(result);
      setState("ready");
    } catch (requestError) {
      if (signal?.aborted) return;
      setData(null);
      setErrorCode(requestError instanceof ApiError ? requestError.code : null);
      setError(requestError instanceof Error
        ? requestError.message
        : `${getProviderDescriptor(repository.provider).displayName} 저장소 상태를 확인하지 못했습니다.`);
      setState("error");
    }
  }, [mode, repository.defaultBranch, repository.externalRepositoryId, repository.fullName,
    repository.provider, repository.visibility, repository.webUrl, workspace.defaultBranch,
    workspace.gitlabProjectPath, workspace.name]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  const reload = useCallback(() => { void load(); }, [load]);
  const value = useMemo(() => ({ data, state, error, errorCode, reload }),
    [data, error, errorCode, reload, state]);

  return <RepositoryConnectionContext.Provider value={value}>{children}</RepositoryConnectionContext.Provider>;
}

export function useRepositoryConnection() {
  const context = useContext(RepositoryConnectionContext);
  if (!context) throw new Error("useRepositoryConnection must be used inside RepositoryConnectionProvider");
  return context;
}
