"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  RotateCcw,
  Search,
} from "lucide-react";
import { ApiError } from "@/lib/api/client/http";
import { getGitLabReconnectUrl } from "@/lib/api/services/authApi";
import { getProviderCapabilities } from "@/lib/api/services/authApi";
import {
  createWorkspace,
  joinWorkspace,
  listDiscoverableWorkspaces,
  syncWorkspace,
  type DiscoverableWorkspace,
} from "@/lib/api/services/workspaceApi";
import { analyzeRepository, getRepository, listRepositories, listRepositoryTree, type RepositoryTreeEntry } from "@/lib/api/services/repositoryApi";
import type { RepositoryImportAnalysis } from "@/lib/api/types/gitlab";
import {
  getRepositoryVisibilityLabel,
  type Repository,
} from "@/lib/domain/repository";
import { getProviderDescriptor, type ProviderId } from "@/lib/providers/provider-descriptors";
import { ProviderIcon } from "@/components/providers/ProviderIcon";
import type { Workspace } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";
import { getUserFacingError } from "@/lib/api/errors";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  createDemoWorkspace,
  getDemoRepositoryAnalysis,
  listDemoRepositories,
} from "@/lib/demo/data";
import { StorageLayoutBuilder } from "@/components/onboarding/StorageLayoutBuilder";
import {
  RECOMMENDED_STORAGE_LAYOUT,
  validateStorageBasePath,
  validateStorageLayout,
  type RepositoryStorageLayout,
} from "@/lib/domain/repository-storage-layout";

type FlowState = "loading" | "ready" | "checking" | "saving";
type PermissionState = "idle" | "checking" | "ready" | "denied";

export function WorkspaceConnectionFlow({
  onCreated,
  embedded = false,
  existingWorkspaces = [],
  onOpenWorkspace,
}: {
  onCreated: (workspace: Workspace) => void;
  embedded?: boolean;
  existingWorkspaces?: Workspace[];
  onOpenWorkspace?: (workspace: Workspace) => void;
}) {
	const { mode } = useAuth();
	const demoMode = mode === "demo";
  const [repositories, setRepositories] = useState<Repository[]>(() => demoMode ? listDemoRepositories() : []);
	const [provider, setProvider] = useState<ProviderId>("GITLAB");
	const [repositoryProviders, setRepositoryProviders] = useState<ProviderId[]>(["GITLAB"]);
  const [discoverable, setDiscoverable] = useState<DiscoverableWorkspace[]>([]);
  const [search, setSearch] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [state, setState] = useState<FlowState>(demoMode ? "ready" : "loading");
  const [permission, setPermission] = useState<PermissionState>("idle");
  const [verifiedAccessLevel, setVerifiedAccessLevel] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<RepositoryImportAnalysis | null>(null);
  const [repositoryTree, setRepositoryTree] = useState<RepositoryTreeEntry[]>([]);
  const [repositoryTreeLoading, setRepositoryTreeLoading] = useState(false);
  const [repositoryTreeError, setRepositoryTreeError] = useState("");
  const repositoryTreeRequest = useRef(0);
  const [repositoryBasePath, setRepositoryBasePath] = useState(".study-workspace/sessions");
  const [storageLayout, setStorageLayout] = useState<RepositoryStorageLayout>(() => structuredClone(RECOMMENDED_STORAGE_LAYOUT));
  const [showStorageOptions, setShowStorageOptions] = useState(false);
  const [error, setError] = useState("");
  const [reconnectRequired, setReconnectRequired] = useState(false);
	const [joining, setJoining] = useState(false);

  const selected = useMemo(
    () => repositories.find((repository) => repository.externalId === selectedId) ?? null,
    [repositories, selectedId],
  );
  const connectedWorkspace = selected
    ? existingWorkspaces.find((workspace) =>
		workspace.repository?.provider === selected.provider
		&& workspace.repository.externalRepositoryId === selected.externalId)
    : undefined;
  const joinableWorkspace = selected
    ? discoverable.find((candidate) => candidate.provider === selected.provider && candidate.externalRepositoryId === selected.externalId)
    : undefined;
	const providerDescriptor = getProviderDescriptor(provider);
  const normalizedStorageBase = repositoryBasePath.trim().replace(/^\/+|\/+$/g, "");
  const storageBaseBlocked = Boolean(normalizedStorageBase && repositoryTree.some((entry) => entry.type === "blob"
    && (entry.path === normalizedStorageBase || normalizedStorageBase.startsWith(`${entry.path}/`))));

  async function loadRepositories(query = "") {
    setState("loading");
    setError("");
    setReconnectRequired(false);
    if (demoMode) {
      setRepositories(listDemoRepositories(query, provider));
      setSelectedId(null);
      setPermission("idle");
      setAnalysis(null);
      setRepositoryTree([]);
      setRepositoryTreeLoading(false);
      setRepositoryTreeError("");
      setShowStorageOptions(false);
      setSearched(Boolean(query.trim()));
      setState("ready");
      return;
    }
    try {
		const projects = await listRepositories(query, undefined, provider);
		setRepositories(projects);
      setSelectedId(null);
      setPermission("idle");
      setAnalysis(null);
      setRepositoryTree([]);
      setRepositoryTreeLoading(false);
      setRepositoryTreeError("");
      setShowStorageOptions(false);
      setSearched(Boolean(query.trim()));
    } catch (requestError) {
      setReconnectRequired(requestError instanceof ApiError && requestError.code === "GITLAB_RECONNECT_REQUIRED");
      setError(getUserFacingError(requestError, "프로젝트를 불러오지 못했습니다."));
    } finally {
      setState("ready");
    }
  }

  useEffect(() => {
	if (demoMode) {
		return;
	}
	const controller = new AbortController();
	void getProviderCapabilities(controller.signal).then((result) => {
		const available: ProviderId[] = result.repositoryProviders?.length ? result.repositoryProviders : ["GITLAB"];
		setRepositoryProviders(available);
		if (!available.includes(provider)) setProvider(available[0]);
	}).catch(() => undefined);
	return () => controller.abort();
	}, [demoMode, provider]);

  useEffect(() => {
	if (demoMode) {
		return;
	}
    void listRepositories("", undefined, provider)
		.then((projects) => setRepositories(projects))
      .catch((requestError) => {
		setReconnectRequired(requestError instanceof ApiError && requestError.code.includes("REAUTH"));
		setError(getUserFacingError(requestError, "저장소를 불러오지 못했습니다."));
      })
      .finally(() => setState("ready"));
  }, [demoMode, provider]);

	useEffect(() => {
		if (demoMode) {
			return;
		}
		const controller = new AbortController();
		void listDiscoverableWorkspaces(controller.signal)
			.then(setDiscoverable)
			.catch(() => undefined);
		return () => controller.abort();
	}, [demoMode]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    await loadRepositories(search);
  }

  async function selectRepository(repository: Repository) {
    setSelectedId(repository.externalId);
    setWorkspaceName(repository.name);
    setPermission("checking");
    setVerifiedAccessLevel(repository.accessLevel ?? null);
    setAnalysis(null);
    setRepositoryTree([]);
    setRepositoryTreeLoading(false);
    setRepositoryTreeError("");
    setRepositoryBasePath(".study-workspace/sessions");
    setStorageLayout(structuredClone(RECOMMENDED_STORAGE_LAYOUT));
    setShowStorageOptions(false);
    setError("");
    setReconnectRequired(false);

    const alreadyConnected = existingWorkspaces.some(
      (workspace) => workspace.repository?.provider === repository.provider
		&& workspace.repository.externalRepositoryId === repository.externalId,
    ) || discoverable.some((workspace) => workspace.provider === repository.provider && workspace.externalRepositoryId === repository.externalId);
    if (alreadyConnected) {
      setPermission("idle");
      return;
    }
    if (!repository.capabilities.canWrite) {
      setPermission("denied");
      return;
    }
	if (demoMode) {
		const demoAnalysis = getDemoRepositoryAnalysis(repository);
		setAnalysis(demoAnalysis);
		setRepositoryBasePath(demoAnalysis.repositoryBasePath);
		setStorageLayout(structuredClone(RECOMMENDED_STORAGE_LAYOUT));
		setPermission("ready");
		setRepositoryTreeLoading(false);
		setState("ready");
		return;
	}

    setState("checking");
    void loadRepositoryFolders(repository);
    try {
      const [connection, repositoryAnalysis] = await Promise.all([
        getRepository(repository.provider, repository.externalId),
        analyzeRepository(repository.provider, repository.externalId),
      ]);
	  const accessLevel = connection.capabilities.canManage ? 40 : connection.capabilities.canWrite ? 30 : connection.capabilities.canRead ? 20 : 0;
      setVerifiedAccessLevel(accessLevel);
      const verifiedCanWrite = connection.capabilities.canWrite;
      if (!verifiedCanWrite) {
        setPermission("denied");
        return;
      }
      setAnalysis(repositoryAnalysis);
      if (repositoryAnalysis.detectedLayout) {
        setStorageLayout(repositoryAnalysis.detectedLayout);
        setRepositoryBasePath(repositoryAnalysis.repositoryBasePath || "");
      } else if (repositoryAnalysis.classification === "EMPTY" || repositoryAnalysis.classification === "LEGACY") {
        setStorageLayout(structuredClone(RECOMMENDED_STORAGE_LAYOUT));
        setRepositoryBasePath(".study-workspace/sessions");
      } else {
        setRepositoryBasePath(repositoryAnalysis.repositoryBasePath);
      }
      setPermission("ready");
    } catch (requestError) {
	  setReconnectRequired(requestError instanceof ApiError && requestError.code.includes("REAUTH"));
      setError(getUserFacingError(requestError, "프로젝트를 확인하지 못했어요."));
      setPermission(requestError instanceof ApiError && requestError.status === 403 ? "denied" : "idle");
    } finally {
      setState("ready");
    }
  }

  async function loadRepositoryFolders(repository: Repository) {
    const requestId = ++repositoryTreeRequest.current;
    if (demoMode) {
      setRepositoryTree([]);
      setRepositoryTreeLoading(false);
      setRepositoryTreeError("");
      return;
    }
    setRepositoryTreeLoading(true);
    setRepositoryTreeError("");
    try {
      const nextTree = await listRepositoryTree(repository.provider, repository.externalId);
      if (requestId !== repositoryTreeRequest.current) return;
      setRepositoryTree(nextTree);
    } catch (requestError) {
      if (requestId !== repositoryTreeRequest.current) return;
      setRepositoryTree([]);
      setRepositoryTreeError(getUserFacingError(requestError, "폴더를 불러오지 못했어요."));
    } finally {
      if (requestId === repositoryTreeRequest.current) setRepositoryTreeLoading(false);
    }
  }

	async function handleJoin(workspaceId: string) {
		if (joining) return;
		setJoining(true);
		setError("");
		try {
			const result = await joinWorkspace(workspaceId);
			onCreated(result.workspace);
		} catch (requestError) {
			setReconnectRequired(requestError instanceof ApiError && ["GITLAB_RECONNECT_REQUIRED", "GITLAB_AUTHENTICATION_FAILED"].includes(requestError.code));
			setError(getUserFacingError(requestError, "Workspace에 참여하지 못했습니다."));
			setJoining(false);
		}
	}

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const usesConfigurableLayout = analysis?.classification === "EMPTY" || analysis?.classification === "LEGACY" || analysis?.classification === "DETECTED";
    if (!selected || permission !== "ready" || !analysis || analysis.classification === "CONFLICTED" || !workspaceName.trim()
      || (usesConfigurableLayout && (repositoryTreeLoading || Boolean(repositoryTreeError) || validateStorageLayout(storageLayout).length > 0 || validateStorageBasePath(repositoryBasePath) || storageBaseBlocked))) return;
    setState("saving");
    setError("");
    if (demoMode) {
      onCreated(createDemoWorkspace(selected, workspaceName.trim()));
      return;
    }
    try {
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
		provider: selected.provider,
		externalRepositoryId: selected.externalId,
		gitlabProjectId: selected.provider === "GITLAB" ? selected.id : undefined,
        gitlabProjectPath: selected.path,
        defaultBranch: selected.defaultBranch ?? "main",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
        repositoryBasePath: usesConfigurableLayout ? repositoryBasePath : analysis.repositoryBasePath,
        repositorySchemaVersion: usesConfigurableLayout ? 3 : analysis.repositorySchemaVersion,
        importMode: analysis.classification,
        expectedTreeFingerprint: analysis.treeFingerprint,
        storageLayout: usesConfigurableLayout ? storageLayout : undefined,
      });
      try {
        onCreated((await syncWorkspace(workspace.id)).workspace);
      } catch {
        onCreated(workspace);
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === "WORKSPACE_PROJECT_ALREADY_CONNECTED") {
		try {
			const available = await listDiscoverableWorkspaces();
			setDiscoverable(available);
			const match = available.find((candidate) => candidate.provider === selected.provider && candidate.externalRepositoryId === selected.externalId);
			setError(match ? "" : "이미 Study-ing Workspace와 연결된 프로젝트입니다. 현재 계정의 참여 권한을 확인해 주세요.");
		} catch {
			setError("이미 Study-ing Workspace와 연결된 프로젝트입니다. Workspace 목록에서 참여 상태를 확인해 주세요.");
		}
      } else {
        setError(getUserFacingError(requestError, "Workspace를 연결하지 못했습니다."));
      }
      setState("ready");
    }
  }

  return (
    <main className={embedded ? "workspace-connect workspace-connect--embedded" : "workspace-connect workspace-connect--first"}>
      <div className="workspace-connect__inner">
        {embedded ? (
          <Link className="back-link" href={APP_ROUTES.workspaces}>← Workspace</Link>
        ) : <div className="workspace-connect__brand">Study-ing</div>}

        <header className="workspace-connect__header">
		  <div className="workspace-connect__provider"><ProviderIcon provider={provider} size={17} /> {providerDescriptor.repositoryLabel} 연결</div>
          <h1>{embedded ? "새 Workspace 연결" : "첫 Workspace를 연결해볼까요?"}</h1>
		  <p>{demoMode ? "데모 저장소를 선택해 Workspace 연결 흐름을 체험하세요." : `${providerDescriptor.displayName}에서 접근 가능한 저장소를 선택해 학습 공간으로 연결하세요.`}</p>
		  <small>{demoMode ? "실제 계정이나 저장소에는 접근하지 않으며, 이 화면의 정보는 모두 데모 데이터입니다." : "연결한 계정과 GitHub App 설치 범위 안에서 접근 가능한 저장소만 표시합니다."}</small>
        </header>

		{!showStorageOptions ? <>
		{repositoryProviders.length > 1 ? (
		  <div className="workspace-connect__provider-selector" role="tablist" aria-label="저장소 Provider">
			{repositoryProviders.map((item) => (
			  <button key={item} type="button" role="tab" aria-selected={provider === item}
				className={provider === item ? "is-selected" : undefined}
				onClick={() => { setState("loading"); setProvider(item); setSelectedId(null); setAnalysis(null); setShowStorageOptions(false); setError(""); }}>
				<ProviderIcon provider={item} size={16} /> {getProviderDescriptor(item).displayName}
			  </button>
			))}
		  </div>
		) : null}

        <section className="workspace-connect__section" aria-labelledby="repository-select-title">
          <div className="workspace-connect__section-heading">
            <span>1</span>
			<div><h2 id="repository-select-title">{providerDescriptor.repositoryLabel} 선택</h2><p>연결할 저장소를 찾아 선택하세요.</p></div>
          </div>
          <form className="repository-search" onSubmit={handleSearch} role="search">
            <Search size={18} aria-hidden="true" />
			<input aria-label={`${providerDescriptor.repositoryLabel} 검색`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="저장소 이름으로 검색" />
            <button className="button button--secondary" type="submit" disabled={state === "loading"}>검색</button>
          </form>

          {state === "loading" ? (
            <div className="workspace-connect__status" role="status" aria-live="polite"><LoaderCircle className="spin" /> 접근 가능한 프로젝트를 불러오고 있어요.</div>
          ) : repositories.length ? (
			<div className="repository-list" role="listbox" aria-label={`접근 가능한 ${providerDescriptor.repositoryLabel}`}>
              {repositories.map((repository) => {
				const isSelected = repository.externalId === selectedId;
				const linked = existingWorkspaces.some((workspace) => workspace.repository?.provider === repository.provider && workspace.repository.externalRepositoryId === repository.externalId);
				const joinable = discoverable.some((workspace) => workspace.provider === repository.provider && workspace.externalRepositoryId === repository.externalId);
                const denied = !repository.capabilities.canWrite;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={isSelected ? "is-selected" : undefined}
					key={`${repository.provider}:${repository.externalId}`}
                    onClick={() => void selectRepository(repository)}
                  >
                    <span className="repository-list__copy"><strong>{repository.name}</strong><small>{repository.path}</small></span>
                    <span className="repository-list__meta">
                      {linked ? <em className="status-badge success">참여 중</em> : joinable ? <em className="status-badge neutral">Workspace 존재</em> : denied ? <em className="status-badge warning">쓰기 권한 필요</em> : null}
                      <em>{getRepositoryVisibilityLabel(repository.visibility)}</em>
                      {isSelected ? <Check size={18} aria-label="선택됨" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
			<div className="workspace-connect__status">
			  {searched ? `조건에 맞는 ${providerDescriptor.repositoryLabel}가 없어요.` : `현재 계정으로 접근 가능한 ${providerDescriptor.repositoryLabel}가 없어요.`}
			  {provider === "GITHUB" ? <a className="button button--secondary button--small" href="/api/v1/github/installations/new">GitHub App 설치 또는 저장소 선택</a> : null}
			</div>
          )}
        </section>
		</> : null}

        {selected ? (
          <section className="workspace-connect__section" aria-labelledby="connection-check-title">
            <div className="workspace-connect__section-heading">
              <span>{showStorageOptions ? "3" : "2"}</span>
              <div><h2 id="connection-check-title">{showStorageOptions ? "Workspace 설정" : "연결 확인"}</h2><p>{showStorageOptions ? "이름과 학습 기록 저장 방식을 확인하세요." : "저장소 권한과 기존 학습 기록을 확인하세요."}</p></div>
            </div>

            {connectedWorkspace ? (
              <div className="connection-existing" role="status">
                <CheckCircle2 size={20} />
                <div><strong>이미 Workspace와 연결된 프로젝트입니다.</strong><small>{connectedWorkspace.name}에서 이 저장소를 사용하고 있어요.</small></div>
                <button className="button button--primary" type="button" onClick={() => onOpenWorkspace?.(connectedWorkspace)}>Workspace로 이동</button>
              </div>
            ) : joinableWorkspace ? (
				<div className="connection-existing connection-existing--join" role="status">
					<CheckCircle2 size={20} />
					<div><strong>이미 Study-ing Workspace가 있는 프로젝트입니다.</strong><small>{joinableWorkspace.workspaceName}에 멤버로 참여할 수 있어요.</small></div>
					<button className="button button--primary" type="button" disabled={joining} onClick={() => void handleJoin(joinableWorkspace.workspaceId)}>
						{joining ? <><LoaderCircle className="spin" size={16} /> 참여 중…</> : "Workspace 참여하기"}
					</button>
				</div>
            ) : (
              <form className="workspace-connect__create" onSubmit={handleCreate}>
                {showStorageOptions ? <>
                  <div className="workspace-connect__selected-repository">
                    <ProviderIcon provider={selected.provider} size={17} />
                    <span><strong>{selected.name}</strong><small>{getProviderDescriptor(selected.provider).displayName} · {selected.path}</small></span>
                    <button type="button" onClick={(event) => { event.preventDefault(); setShowStorageOptions(false); setError(""); }}>저장소 변경</button>
                  </div>

                  <label className="field">
                    <span>Workspace 이름</span>
                    <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} required />
				    <small>저장소 이름과 다르게 정할 수 있습니다.</small>
                  </label>

                  {analysis && ["EMPTY", "LEGACY", "DETECTED"].includes(analysis.classification) ? (
                    <StorageLayoutBuilder
                      basePath={repositoryBasePath}
                      layout={storageLayout}
                      tree={repositoryTree}
                      treeLoading={repositoryTreeLoading}
                      treeError={repositoryTreeError}
                      detectedRecords={analysis.classification === "DETECTED" ? analysis.detectedRecords : 0}
                      onRetryTree={() => void loadRepositoryFolders(selected)}
                      onBasePathChange={setRepositoryBasePath}
                      onLayoutChange={setStorageLayout}
                    />
                  ) : analysis && ["COMPATIBLE", "PARTIALLY_COMPATIBLE"].includes(analysis.classification) ? (
                    <div className="storage-layout-existing">
                      <CheckCircle2 size={18} />
                      <span><strong>기존 Study-ing 저장 구조를 유지합니다.</strong><small>현재 파일을 이동하지 않고 새 기록도 같은 위치에 저장합니다.</small></span>
                    </div>
                  ) : null}

                  {error ? (
                    <div className="workspace-connect__error" role="alert">
                      <AlertTriangle size={18} /><span><strong>Workspace를 연결하지 못했어요.</strong><small>{error}</small></span>
					  {reconnectRequired ? <a className="button button--secondary button--small" href={provider === "GITHUB" ? "/settings/accounts" : getGitLabReconnectUrl(APP_ROUTES.workspaceNew)}>다시 연결</a> : null}
                    </div>
                  ) : null}

                  {analysis ? (
                    <div className="workspace-connect__actions workspace-connect__actions--wizard">
                      <button className="button button--secondary" type="button" onClick={(event) => { event.preventDefault(); setShowStorageOptions(false); setError(""); }}>이전 단계</button>
                      <button className="button button--primary" type="submit" disabled={!workspaceName.trim() || state === "saving"
                        || (["EMPTY", "LEGACY", "DETECTED"].includes(analysis.classification)
                          && (repositoryTreeLoading || Boolean(repositoryTreeError) || validateStorageLayout(storageLayout).length > 0 || Boolean(validateStorageBasePath(repositoryBasePath)) || storageBaseBlocked))}>
                        {state === "saving" ? <><LoaderCircle className="spin" size={17} /> 연결 중…</> : analysis.classification === "COMPATIBLE" || analysis.classification === "PARTIALLY_COMPATIBLE" ? "기존 학습 기록과 연결하기" : "Workspace 연결하기"}
                      </button>
                    </div>
                  ) : null}
                </> : <>
                  <PermissionCheck
                    state={permission}
                    accessLevel={verifiedAccessLevel}
                    defaultBranch={selected.defaultBranch}
                    webUrl={selected.webUrl}
				    provider={selected.provider}
                  />

                  {state === "checking" ? (
                    <div className="repository-analysis-loading" role="status" aria-live="polite">
                      <LoaderCircle className="spin" />
                      <span><strong>기존 학습 기록을 확인하고 있어요</strong><small>일정과 제출 기록의 호환성을 안전하게 분석합니다.</small></span>
                    </div>
                  ) : null}
                  {analysis ? <RepositoryAnalysisCard analysis={analysis} /> : null}

                  {error ? (
                    <div className="workspace-connect__error" role="alert">
                      <AlertTriangle size={18} /><span><strong>프로젝트를 확인하지 못했어요.</strong><small>{error}</small></span>
					  {reconnectRequired ? <a className="button button--secondary button--small" href={provider === "GITHUB" ? "/settings/accounts" : getGitLabReconnectUrl(APP_ROUTES.workspaceNew)}>다시 연결</a> : <button className="button button--secondary button--small" type="button" onClick={() => void selectRepository(selected)}><RotateCcw size={15} /> 다시 시도</button>}
                    </div>
                  ) : null}

                  {analysis && permission === "ready" ? (
                    <div className="workspace-connect__actions">
                      <span>{analysis.classification === "CONFLICTED" ? "문제를 해결한 뒤 다시 분석해 주세요." : "연결하면 기존 저장소 파일은 그대로 유지됩니다."}</span>
                      <button className="button button--primary" type="button" disabled={analysis.classification === "CONFLICTED"} onClick={(event) => { event.preventDefault(); setShowStorageOptions(true); }}>계속</button>
                    </div>
                  ) : null}
                </>}
              </form>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export function WorkspaceOnboarding(props: Parameters<typeof WorkspaceConnectionFlow>[0]) {
  return <WorkspaceConnectionFlow {...props} />;
}

function PermissionCheck({ state, accessLevel, defaultBranch, webUrl, provider }: { state: PermissionState; accessLevel: number | null; defaultBranch: string | null; webUrl: string | null; provider: ProviderId }) {
	const providerName = getProviderDescriptor(provider).displayName;
	const permissionLabel = provider === "GITLAB"
		? accessLevel == null ? "확인 불가" : accessLevel >= 40 ? "Maintainer" : accessLevel >= 30 ? "Developer" : accessLevel >= 20 ? "Reporter" : "접근 권한 없음"
		: accessLevel != null && accessLevel >= 40 ? "Admin" : accessLevel != null && accessLevel >= 30 ? "Write" : accessLevel != null && accessLevel >= 20 ? "Read" : "확인 불가";
  if (state === "idle") return null;
  if (state === "checking") {
    return <div className="permission-check" role="status"><LoaderCircle className="spin" /><span><strong>프로젝트 권한을 확인하고 있어요</strong><small>Repository 접근과 쓰기 가능 여부를 확인합니다.</small></span></div>;
  }
  if (state === "denied") {
    return (
      <div className="permission-check permission-check--denied" role="alert">
        <AlertTriangle size={20} />
        <span>
          <strong>이 프로젝트를 연결할 권한이 없습니다.</strong>
          <small>현재 권한으로는 저장소에 변경사항을 쓸 수 없습니다.</small>
		  <details className="permission-check__details"><summary>권한 세부 정보</summary><p>현재 {providerName} 권한 · {permissionLabel}<br />필요 권한 · 쓰기 가능</p></details>
        </span>
		{webUrl ? <a href={webUrl} target="_blank" rel="noreferrer">{providerName}에서 권한 확인 <ExternalLink size={14} /></a> : null}
      </div>
    );
  }
  return (
    <div className="permission-check permission-check--ready" role="status">
      <CheckCircle2 size={20} />
      <span>
        <strong>프로젝트 권한을 확인했어요</strong>
        <small>기본 브랜치 · {defaultBranch ?? "main"} · 쓰기 권한 확인됨</small>
		{accessLevel == null ? null : <details className="permission-check__details"><summary>권한 세부 정보</summary><p>현재 {providerName} 권한 · {permissionLabel}</p></details>}
      </span>
    </div>
  );
}

function RepositoryAnalysisCard({ analysis }: { analysis: RepositoryImportAnalysis }) {
  const compatible = analysis.classification === "COMPATIBLE" || analysis.classification === "PARTIALLY_COMPATIBLE";
  const detected = analysis.classification === "DETECTED";
  const conflicted = analysis.classification === "CONFLICTED";
  const empty = analysis.classification === "EMPTY";
  return (
    <section className={`repository-analysis ${conflicted ? "is-conflicted" : ""}`} aria-label="저장소 분석 결과">
      <header>
        <span>{conflicted ? <AlertTriangle size={18} /> : compatible ? <FileCheck2 size={18} /> : <Database size={18} />}</span>
        <div>
          <strong>{conflicted ? "연결하기 전에 확인이 필요해요." : compatible ? "기존 Study-ing 학습 기록을 찾았어요." : detected ? "반복되는 학습 기록 구조를 찾았어요." : empty ? "연결할 준비가 되었어요." : "저장 구조를 직접 확인해주세요."}</strong>
          <small>{conflicted ? `${analysis.issues.length}개의 학습 데이터 문제가 발견되었습니다.` : detected ? "현재 파일을 이동하지 않고 같은 경로 규칙을 사용합니다." : empty ? "추천 저장 방식이 자동으로 설정되었습니다." : "기존 저장소 파일은 변경하지 않습니다."}</small>
        </div>
      </header>
      {compatible ? (
        <dl>
          <div><dt>학습 일정</dt><dd>{analysis.compatibleSessions}개</dd></div>
          <div><dt>제출 기록</dt><dd>{analysis.compatibleSubmissions}건</dd></div>
          <div><dt>기타 파일</dt><dd>그대로 유지</dd></div>
        </dl>
      ) : null}
      {conflicted ? (
        <div className="repository-analysis__problems">
          {analysis.issues.slice(0, 4).map((issue) => (
            <div key={`${issue.path}-${issue.code}`}><AlertTriangle size={15} /><span>{getIssueSummary(issue.code, issue.message)}</span></div>
          ))}
          <details>
            <summary><ChevronDown size={15} /> 문제 상세 보기</summary>
            <div className="repository-analysis__issues">
              {analysis.issues.map((issue) => <span key={`${issue.path}-${issue.code}`}><code>{issue.path}</code>{issue.message}</span>)}
            </div>
          </details>
        </div>
      ) : analysis.totalFiles > 0 ? (
        <details className="repository-analysis__details"><summary>저장소 세부 정보</summary><p>전체 파일 {analysis.totalFiles}개 · 유지되는 기타 파일 {analysis.ignoredFiles}개</p></details>
      ) : null}
    </section>
  );
}

function getIssueSummary(code: string, fallback: string) {
  if (code.includes("MARKER") || code.includes("CONFIG")) return "Workspace 설정 파일 확인 필요";
  if (code.includes("SESSION")) return "학습 일정 파일 형식 확인 필요";
  if (code.includes("RESERVED") || code.includes("PATH")) return "학습 데이터 저장 위치 확인 필요";
  return fallback;
}
