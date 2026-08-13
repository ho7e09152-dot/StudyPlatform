"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FolderTree, LoaderCircle } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Modal } from "@/components/ui/Modal";
import {
  getRepositorySchemaMigrationPreview,
  type RepositorySchemaMigrationPreview,
} from "@/lib/api/services/workspaceApi";
import { APP_ROUTES } from "@/lib/routes";
import { canMigrateRepository } from "@/lib/domain/permissions";
import { getUserFacingError } from "@/lib/api/errors";

export function RepositoryMigrationPage() {
  const { workspace, currentUserId, migrateRepositoryLayout } = useWorkspace();
  const isOwner = canMigrateRepository(workspace.members.find((member) => member.id === currentUserId));
  const [preview, setPreview] = useState<RepositorySchemaMigrationPreview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "success" | "error" | "restricted">(isOwner ? "loading" : "restricted");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  function load() {
    if (!isOwner) { setState("restricted"); return; }
    setState("loading"); setError("");
    void getRepositorySchemaMigrationPreview(workspace.id)
      .then((result) => { setPreview(result); setState("ready"); })
      .catch((requestError) => { setError(getUserFacingError(requestError, "이전 대상을 확인하지 못했습니다.")); setState("error"); });
  }

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    void getRepositorySchemaMigrationPreview(workspace.id)
      .then((result) => { if (active) { setPreview(result); setState("ready"); } })
      .catch((requestError) => { if (active) { setError(getUserFacingError(requestError, "이전 대상을 확인하지 못했습니다.")); setState("error"); } });
    return () => { active = false; };
  }, [isOwner, workspace.id]);

  function execute() {
    if (!preview?.ready || preview.totalMoves === 0) return;
    setConfirming(false); setState("saving"); setError("");
    void migrateRepositoryLayout(preview.treeFingerprint)
      .then(() => setState("success"))
      .catch((requestError) => {
        setError(getUserFacingError(requestError, "저장 구조를 이전하지 못했습니다."));
        setState("ready");
      });
  }

  return (
    <div className="page-stack settings-migration-page">
      <Link className="page-back-link" href={APP_ROUTES.settingsSection("data")}><ArrowLeft size={15} /> 데이터 및 동기화</Link>
      <header className="page-heading"><div><h1>저장 구조 이전</h1><p>GitLab의 기존 학습 파일을 Study-ing 전용 저장 경로로 정리합니다.</p></div></header>
      {!isOwner ? <div className="settings-migration-state settings-restricted" role="alert"><AlertTriangle size={23} /><div><strong>소유자만 저장 구조를 이전할 수 있어요</strong><p>현재 계정에는 이 Workspace의 저장 구조를 변경할 권한이 없습니다.</p><Link className="button button--secondary" href={APP_ROUTES.settingsSection("data")}>데이터 및 동기화로 돌아가기</Link></div></div> : null}
      {isOwner && state === "loading" ? <div className="settings-migration-loading" role="status"><LoaderCircle className="spin" size={22} /><strong>이전할 파일을 확인하고 있어요</strong><span>저장소는 아직 변경되지 않습니다.</span></div> : null}
      {state === "error" ? <div className="settings-migration-state" role="alert"><AlertTriangle size={23} /><strong>이전 대상을 확인하지 못했어요</strong><p>{error}</p><button type="button" className="button button--secondary" onClick={load}>다시 시도</button></div> : null}
      {isOwner && state === "success" ? <div className="settings-migration-state" role="status"><CheckCircle2 size={25} /><strong>저장 구조 이전을 완료했어요</strong><p>{preview?.totalMoves ?? 0}개 파일을 새 저장 경로로 이동했습니다.</p><Link className="button button--primary" href={APP_ROUTES.settingsSection("data")}>데이터 및 동기화로 돌아가기</Link></div> : null}
      {isOwner && state !== "loading" && state !== "restricted" && state !== "success" && preview ? (
        <div className="settings-migration-content">
          <section className="settings-section-block"><h2>이전 대상</h2><div className="migration-metrics"><span><small>일정 파일</small><strong>{preview.sessionFiles}개</strong></span><span><small>제출 파일</small><strong>{preview.submissionFiles}개</strong></span><span><small>전체 이동</small><strong>{preview.totalMoves}개</strong></span></div></section>
          {preview.totalMoves === 0 && preview.blockers.length === 0 ? <section className="settings-migration-state"><CheckCircle2 size={23} /><strong>이전할 파일이 없어요</strong><p>현재 저장 구조가 이미 최신 상태입니다.</p></section> : null}
          {preview.moves.length ? <section className="settings-section-block"><h2>이동 경로</h2><p>이 작업에서는 실제 파일 경로 확인이 필요하므로 기술 경로를 함께 표시합니다.</p><div className="migration-path-list">{preview.moves.map((move) => <article key={move.sourcePath}><code>{move.sourcePath}</code><ArrowRight size={15} /><code>{move.targetPath}</code></article>)}</div></section> : null}
          {preview.blockers.length ? <section className="settings-migration-blocked" role="alert"><div><AlertTriangle size={19} /><span><strong>이전하기 전에 확인이 필요해요</strong><small>{preview.blockers.length}개의 문제가 있어 현재 이전을 실행할 수 없습니다.</small></span></div>{preview.blockers.map((blocker) => <article key={`${blocker.code}-${blocker.path}`}><strong>{blocker.message}</strong>{blocker.path ? <code>{blocker.path}</code> : null}</article>)}</section> : null}
          <section className="settings-migration-note"><FolderTree size={19} /><span><strong>GitLab commit 하나로 이동합니다</strong><small>학습 내용은 변경하지 않으며, 분석 이후 저장소가 바뀌었다면 실행을 중단합니다.</small></span></section>
          {error ? <div className="onboarding-error" role="alert">{error}</div> : null}
          <footer className="settings-migration-actions"><Link className="button button--ghost" href={APP_ROUTES.settingsSection("data")}>취소</Link><button type="button" className="button button--primary" disabled={!preview.ready || preview.totalMoves === 0 || state === "saving"} onClick={() => setConfirming(true)}>{state === "saving" ? "GitLab에 반영 중…" : "이전 실행"}</button></footer>
        </div>
      ) : null}
      {confirming ? <Modal title="저장 구조를 이전할까요?" description="GitLab 파일 경로가 변경되며, 작업은 commit 하나로 기록됩니다." onClose={() => setConfirming(false)}><div className="destructive-confirmation"><p>{preview?.totalMoves ?? 0}개 파일을 표시된 새 경로로 이동합니다. 분석 이후 저장소가 변경되었다면 안전하게 중단됩니다.</p><div className="modal-actions"><button type="button" className="button button--ghost" onClick={() => setConfirming(false)}>취소</button><button type="button" className="button button--primary" onClick={execute}>이전 실행</button></div></div></Modal> : null}
    </div>
  );
}
