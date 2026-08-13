"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FolderGit2, LoaderCircle, RotateCcw } from "lucide-react";
import { ApiError } from "@/lib/api/client/http";
import { getUserFacingError } from "@/lib/api/errors";
import { getGitLabReconnectUrl } from "@/lib/api/services/authApi";
import {
  listDiscoverableWorkspaces,
  type DiscoverableWorkspace,
} from "@/lib/api/services/workspaceApi";
import type { Workspace } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";
import { getProviderDescriptor } from "@/lib/providers/provider-descriptors";

export function DiscoverableWorkspaceSection({
  onJoin,
  onResolved,
  hideWhenEmpty = true,
}: {
  onJoin: (workspaceId: string) => Promise<Workspace>;
  onResolved?: (result: { count: number; error: boolean }) => void;
  hideWhenEmpty?: boolean;
}) {
  const [items, setItems] = useState<DiscoverableWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    setReconnectRequired(false);
    try {
      const result = await listDiscoverableWorkspaces(signal);
      setItems(result);
      onResolved?.({ count: result.length, error: false });
    } catch (requestError) {
      if (signal?.aborted) return;
      setReconnectRequired(requestError instanceof ApiError && [
        "GITLAB_RECONNECT_REQUIRED",
        "GITLAB_AUTHENTICATION_FAILED",
      ].includes(requestError.code));
      setError(getUserFacingError(requestError, "참여 가능한 Workspace를 확인하지 못했어요."));
      onResolved?.({ count: 0, error: true });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [onResolved]);

  useEffect(() => {
    const controller = new AbortController();
		void listDiscoverableWorkspaces(controller.signal)
			.then((result) => {
				setItems(result);
				onResolved?.({ count: result.length, error: false });
			})
			.catch((requestError) => {
				if (controller.signal.aborted) return;
				setReconnectRequired(requestError instanceof ApiError && [
					"GITLAB_RECONNECT_REQUIRED",
					"GITLAB_AUTHENTICATION_FAILED",
				].includes(requestError.code));
				setError(getUserFacingError(requestError, "참여 가능한 Workspace를 확인하지 못했어요."));
				onResolved?.({ count: 0, error: true });
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
    return () => controller.abort();
  }, [onResolved]);

  async function join(item: DiscoverableWorkspace) {
    if (joining) return;
    setJoining(item.workspaceId);
    setAnnouncement(`${item.workspaceName} 참여를 처리하고 있습니다.`);
    setError("");
    try {
      await onJoin(item.workspaceId);
      setItems((current) => current.filter((candidate) => candidate.workspaceId !== item.workspaceId));
      setAnnouncement(`${item.workspaceName} Workspace에 참여했어요.`);
    } catch (requestError) {
      setReconnectRequired(requestError instanceof ApiError && [
        "GITLAB_RECONNECT_REQUIRED",
        "GITLAB_AUTHENTICATION_FAILED",
      ].includes(requestError.code));
      setError(getUserFacingError(requestError, "Workspace에 참여하지 못했습니다."));
      setAnnouncement(`${item.workspaceName} Workspace에 참여하지 못했습니다.`);
      setJoining(null);
    }
  }

  if (!loading && !error && items.length === 0 && hideWhenEmpty) return null;

  return (
    <section className="workspace-hub__section workspace-discovery" aria-labelledby="discoverable-workspaces-title">
      <div className="section-header">
        <div>
          <h2 id="discoverable-workspaces-title">참여 가능한 Workspace</h2>
          <p>연결된 저장소 권한으로 참여할 수 있는 Workspace입니다.</p>
        </div>
      </div>

      {loading ? (
        <div className="workspace-discovery__state" role="status" aria-live="polite">
          <LoaderCircle className="spin" size={18} /> 참여 가능한 Workspace를 확인하고 있어요.
        </div>
      ) : error ? (
        <div className="workspace-discovery__state workspace-discovery__state--error" role="alert">
          <AlertTriangle size={18} />
          <span><strong>참여 가능한 Workspace를 확인하지 못했어요.</strong><small>{error}</small></span>
          {reconnectRequired ? (
            <a className="button button--secondary button--small" href={getGitLabReconnectUrl(APP_ROUTES.workspaces)}>GitLab 다시 연결</a>
          ) : (
            <button className="button button--secondary button--small" type="button" onClick={() => void load()}><RotateCcw size={14} /> 다시 시도</button>
          )}
        </div>
      ) : items.length ? (
        <div className="workspace-hub__list workspace-hub__list--discoverable">
          {items.map((item) => (
            <div key={item.workspaceId}>
              <span className="workspace-hub__icon"><FolderGit2 size={20} /></span>
              <span className="workspace-hub__copy">
                <strong>{item.workspaceName}</strong>
                <small>{getProviderDescriptor(item.provider).displayName}<span className="workspace-hub__repository-path"> · {item.repositoryFullName}</span></small>
              </span>
              <button className="button button--primary button--small" type="button" disabled={joining !== null} onClick={() => void join(item)}>
                {joining === item.workspaceId ? <><LoaderCircle className="spin" size={14} /> 참여 중…</> : "참여하기"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="workspace-discovery__state">현재 참여 가능한 Workspace가 없어요.</div>
      )}
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  );
}
