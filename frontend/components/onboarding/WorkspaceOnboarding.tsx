"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, Database, FileCheck2, Gitlab, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { createWorkspace, listDeletedWorkspaces, restoreWorkspace, syncWorkspace, type DeletedWorkspace } from "@/lib/api/services/workspaceApi";
import {
  getGitLabConnection,
  analyzeGitLabRepository,
  listGitLabProjects,
} from "@/lib/api/services/gitlabApi";
import type { GitLabProject, RepositoryImportAnalysis } from "@/lib/api/types/gitlab";
import type { Workspace } from "@/lib/domain/types";

export function WorkspaceOnboarding({
  onCreated,
  embedded = false,
}: {
  onCreated: (workspace: Workspace) => void;
  embedded?: boolean;
}) {
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "checking" | "saving">("loading");
  const [connectionReady, setConnectionReady] = useState(false);
  const [analysis, setAnalysis] = useState<RepositoryImportAnalysis | null>(null);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState<DeletedWorkspace[]>([]);

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  async function loadProjects(query = "", signal?: AbortSignal) {
    await Promise.resolve();
    if (signal?.aborted) return;
    setState("loading");
    setError("");
    try {
      const loaded = await listGitLabProjects(query, signal);
      setProjects(loaded);
      setSelectedId(null);
      setConnectionReady(false);
      setAnalysis(null);
      setState("ready");
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(requestError instanceof Error ? requestError.message : "프로젝트를 불러오지 못했습니다.");
      setState("ready");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void listGitLabProjects("", controller.signal)
      .then((loaded) => {
        setProjects(loaded);
        setState("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "프로젝트를 불러오지 못했습니다.");
        setState("ready");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void listDeletedWorkspaces(controller.signal).then(setDeleted).catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await loadProjects(search);
  }

  async function selectProject(project: GitLabProject) {
    setSelectedId(project.id);
    setWorkspaceName(project.name);
    setConnectionReady(false);
    setAnalysis(null);
    setError("");
    setState("checking");
    try {
      const [, repositoryAnalysis] = await Promise.all([
        getGitLabConnection(project.id),
        analyzeGitLabRepository(project.id),
      ]);
      setAnalysis(repositoryAnalysis);
      setConnectionReady(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "프로젝트 연결을 확인하지 못했습니다.");
    } finally {
      setState("ready");
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!selected || !connectionReady || !analysis || analysis.classification === "CONFLICTED" || !workspaceName.trim()) return;
    setState("saving");
    setError("");
    try {
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
        gitlabProjectId: selected.id,
        gitlabProjectPath: selected.pathWithNamespace,
        defaultBranch: selected.defaultBranch ?? "main",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
        repositoryBasePath: analysis.repositoryBasePath,
        importMode: analysis.classification,
        expectedTreeFingerprint: analysis.treeFingerprint,
      });
      try {
        const initialSync = await syncWorkspace(workspace.id);
        onCreated(initialSync.workspace);
      } catch {
        // Workspace creation is already committed. Enter the app and expose the
        // failed sync job in Settings so the user can safely retry it.
        onCreated(workspace);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Workspace를 만들지 못했습니다.");
      setState("ready");
    }
  }

  return (
    <main className={embedded ? "onboarding-page onboarding-page--embedded" : "onboarding-page"}>
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-eyebrow"><Gitlab size={17} /> GitLab 프로젝트 연결</div>
        <h1 id="onboarding-title">{embedded ? "새 Workspace 연결" : "첫 Workspace를 만들어볼까요?"}</h1>
        <p>OAuth로 승인한 계정에서 접근 가능한 프로젝트만 표시합니다. PAT는 필요하지 않습니다.</p>

        <form className="onboarding-search" onSubmit={handleSearch}>
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="GitLab 프로젝트 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="프로젝트 이름으로 검색"
          />
          <button type="submit" disabled={state === "loading"}>검색</button>
        </form>

        {state === "loading" ? (
          <div className="onboarding-status" role="status"><LoaderCircle className="spin" /> 프로젝트를 불러오고 있습니다.</div>
        ) : projects.length ? (
          <div className="onboarding-projects" role="list">
            {projects.map((project) => (
              <button
                type="button"
                role="listitem"
                className={project.id === selectedId ? "is-selected" : ""}
                key={project.id}
                onClick={() => void selectProject(project)}
              >
                <span><strong>{project.name}</strong><small>{project.pathWithNamespace}</small></span>
                <em>{project.visibility}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="onboarding-status">검색 조건에 맞는 접근 가능 프로젝트가 없습니다.</div>
        )}

        {selected ? (
          <form className="onboarding-create" onSubmit={handleCreate}>
            <label>
              Workspace 이름
              <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} />
            </label>
            <div className={connectionReady ? "onboarding-check is-ready" : "onboarding-check"}>
              {state === "checking" ? <LoaderCircle className="spin" /> : <CheckCircle2 />}
              <span>
                <strong>{connectionReady ? "연결할 수 있습니다" : "프로젝트 권한 확인"}</strong>
                <small>{selected.defaultBranch ? `기본 브랜치: ${selected.defaultBranch}` : "빈 저장소 · 첫 기본 브랜치는 main으로 설정됩니다."}</small>
              </span>
            </div>

            {analysis ? <RepositoryAnalysisCard analysis={analysis} /> : null}

            <button className="button" type="submit" disabled={!connectionReady || !analysis || analysis.classification === "CONFLICTED" || !workspaceName.trim() || state === "saving"}>
              {state === "saving"
                ? "Workspace 생성·초기 동기화 중…"
                : analysis?.classification === "COMPATIBLE" || analysis?.classification === "PARTIALLY_COMPATIBLE"
                  ? "기존 데이터 가져와서 시작하기"
                  : "기존 파일 유지하고 시작하기"}
            </button>
          </form>
        ) : null}

        {error ? <div className="onboarding-error" role="alert">{error}</div> : null}

        {deleted.length ? (
          <section className="onboarding-restore" aria-labelledby="restore-title">
            <h2 id="restore-title">복원 가능한 Workspace</h2>
            {deleted.map((item) => (
              <div key={item.workspace.id}>
                <span><strong>{item.workspace.name}</strong><small>{item.workspace.gitlabProjectPath} · {new Date(item.deletionExpiresAt).toLocaleString("ko-KR")}까지</small></span>
                <button type="button" onClick={() => void restoreWorkspace(item.workspace.id).then(onCreated)}>
                  <RotateCcw size={15} /> 복원
                </button>
              </div>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}

function RepositoryAnalysisCard({ analysis }: { analysis: RepositoryImportAnalysis }) {
  const compatible = analysis.classification === "COMPATIBLE" || analysis.classification === "PARTIALLY_COMPATIBLE";
  const conflicted = analysis.classification === "CONFLICTED";
  return (
    <section className={`repository-analysis ${conflicted ? "is-conflicted" : ""}`} aria-label="저장소 분석 결과">
      <header>
        <span>{conflicted ? <AlertTriangle size={18} /> : compatible ? <FileCheck2 size={18} /> : <Database size={18} />}</span>
        <div>
          <strong>{conflicted ? "전용 경로 충돌을 해결해야 합니다" : compatible ? "기존 학습 데이터를 찾았습니다" : analysis.classification === "EMPTY" ? "빈 저장소에서 새로 시작합니다" : "기존 파일을 그대로 유지합니다"}</strong>
          <small>{analysis.repositoryBasePath ? `${analysis.repositoryBasePath}/ 아래에서만 학습 데이터를 관리합니다.` : "현재 루트의 서비스 형식을 그대로 가져옵니다."}</small>
        </div>
      </header>
      <dl>
        <div><dt>전체 파일</dt><dd>{analysis.totalFiles}</dd></div>
        <div><dt>일정</dt><dd>{analysis.compatibleSessions}</dd></div>
        <div><dt>제출</dt><dd>{analysis.compatibleSubmissions}</dd></div>
        <div><dt>유지되는 기타 파일</dt><dd>{analysis.ignoredFiles}</dd></div>
      </dl>
      {analysis.issues.length ? (
        <div className="repository-analysis__issues">
          {analysis.issues.slice(0, 4).map((issue) => <span key={`${issue.path}-${issue.code}`}><code>{issue.path}</code>{issue.message}</span>)}
        </div>
      ) : null}
    </section>
  );
}
