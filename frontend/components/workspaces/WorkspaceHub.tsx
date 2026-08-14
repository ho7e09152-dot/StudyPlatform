"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleDot, FolderGit2, Plus, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { listDeletedWorkspaces, restoreWorkspace, type DeletedWorkspace } from "@/lib/api/services/workspaceApi";
import { APP_ROLE_LABEL } from "@/lib/domain/permissions";
import { getWorkspaceRepositoryConnection, REPOSITORY_PROVIDER_LABEL } from "@/lib/domain/repository";
import { APP_ROUTES } from "@/lib/routes";
import { getUserFacingError } from "@/lib/api/errors";
import { DiscoverableWorkspaceSection } from "@/components/workspaces/DiscoverableWorkspaceSection";
import { useAuth } from "@/components/providers/AuthProvider";

function remainingDays(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

export function WorkspaceHub() {
  const router = useRouter();
  const { mode } = useAuth();
  const { workspaces, workspace, currentUserId, switchWorkspace, joinDiscoveredWorkspace } = useWorkspace();
  const [deleted, setDeleted] = useState<DeletedWorkspace[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const currentGitLabUserId = workspace.members.find((member) => member.id === currentUserId)?.gitlabUserId;

  useEffect(() => {
    if (mode === "demo") {
      return;
    }
    const controller = new AbortController();
    void listDeletedWorkspaces(controller.signal).then(setDeleted).catch(() => undefined);
    return () => controller.abort();
  }, [mode]);

  const restorable = useMemo(
    () => deleted.filter((item) => item.workspace.members.some((member) => member.gitlabUserId === currentGitLabUserId && member.role === "OWNER" && member.status === "ACTIVE")),
    [currentGitLabUserId, deleted],
  );

  function openWorkspace(workspaceId: string) {
    switchWorkspace(workspaceId);
    router.push("/today");
  }

  async function restore(item: DeletedWorkspace) {
    setRestoring(item.workspace.id);
    setRestoreError("");
    try {
      const restored = await restoreWorkspace(item.workspace.id);
      setDeleted((current) => current.filter((candidate) => candidate.workspace.id !== restored.id));
      window.location.assign("/today");
    } catch (error) {
      setRestoreError(getUserFacingError(error, "Workspace를 복원하지 못했습니다."));
      setRestoring(null);
    }
  }

  return (
    <div className="workspace-hub page-workspace">
      <header className="workspace-hub__header">
        <div><h1>Workspace</h1><p>참여 중인 스터디 공간을 선택하거나 새 저장소를 연결하세요.</p></div>
        <Link className="button button--primary" href={APP_ROUTES.workspaceNew}><Plus size={17} /> 새 Workspace 연결</Link>
      </header>

      <section className="workspace-hub__section" aria-labelledby="my-workspaces-title">
        <div className="section-header"><div><h2 id="my-workspaces-title">내 Workspace</h2><p>{workspaces.length}개의 스터디 공간에 참여하고 있습니다.</p></div></div>
        <div className="workspace-hub__list">
          {workspaces.map((candidate) => {
            const connection = getWorkspaceRepositoryConnection(candidate);
            const member = candidate.members.find((item) => item.gitlabUserId === currentGitLabUserId);
            const current = candidate.id === workspace.id;
            return (
              <button type="button" key={candidate.id} onClick={() => openWorkspace(candidate.id)}>
                <span className="workspace-hub__icon"><FolderGit2 size={20} /></span>
                <span className="workspace-hub__copy">
                  <span><strong>{candidate.name}</strong>{current ? <em><CircleDot size={14} /> 현재 사용 중</em> : null}</span>
                  <small>
                    {REPOSITORY_PROVIDER_LABEL[connection.provider]}
                    {connection.repositoryPath ? <span className="workspace-hub__repository-path"> · {connection.repositoryPath}</span> : <span> · 저장 정보 없음</span>}
                  </small>
                </span>
                <span className="workspace-hub__role">{member ? APP_ROLE_LABEL[member.role] : "멤버"}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

			<DiscoverableWorkspaceSection onJoin={async (workspaceId) => {
				const joined = await joinDiscoveredWorkspace(workspaceId);
				router.push("/today");
				return joined;
			}} />

      {restorable.length ? (
        <section className="workspace-hub__section" aria-labelledby="deleted-workspaces-title">
          <div className="section-header"><div><h2 id="deleted-workspaces-title">최근 삭제</h2><p>소유자만 삭제한 Workspace를 복원할 수 있습니다.</p></div></div>
          <div className="workspace-hub__list workspace-hub__list--deleted">
            {restorable.map((item) => {
              const connection = getWorkspaceRepositoryConnection(item.workspace);
              return (
                <div key={item.workspace.id}>
                  <span className="workspace-hub__icon"><RotateCcw size={19} /></span>
                  <span className="workspace-hub__copy"><strong>{item.workspace.name}</strong><small>{REPOSITORY_PROVIDER_LABEL[connection.provider]}{connection.repositoryPath ? ` · ${connection.repositoryPath}` : ""} · {remainingDays(item.deletionExpiresAt)}일 후 영구 삭제</small></span>
                  <button className="button button--secondary button--small" type="button" disabled={restoring === item.workspace.id} onClick={() => void restore(item)}>{restoring === item.workspace.id ? "복원 중…" : "복원"}</button>
                </div>
              );
            })}
          </div>
          {restoreError ? <div className="workspace-connect__error" role="alert">{restoreError}</div> : null}
        </section>
      ) : null}
    </div>
  );
}
