"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Search,
} from "lucide-react";
import { ApiError } from "@/lib/api/client/http";
import {
  getGitLabReconnectUrl,
  getProviderCapabilities,
  listProviderAccounts,
  type ProviderAccount,
} from "@/lib/api/services/authApi";
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
  DEFAULT_STORAGE_BASE_PATH,
  RECOMMENDED_STORAGE_LAYOUT,
  validateStorageBasePath,
  validateStorageLayout,
  validateStorageResolvedPaths,
  type RepositoryStorageLayout,
} from "@/lib/domain/repository-storage-layout";

type FlowState = "loading" | "ready" | "checking" | "saving";
type PermissionState = "idle" | "checking" | "ready" | "denied";
type WorkspaceFlowStep = 0 | 1 | 2 | 3 | 4;

const WORKSPACE_FLOW_STEPS = [
  { step: 1 as const, label: "저장소 선택" },
  { step: 2 as const, label: "연결 확인" },
  { step: 3 as const, label: "기본 정보" },
  { step: 4 as const, label: "저장 방식" },
];
const subscribeToClient = () => () => undefined;

export function WorkspaceConnectionFlow({
  onCreated,
  withinAppShell = false,
  existingWorkspaces = [],
  onOpenWorkspace,
}: {
  onCreated: (workspace: Workspace) => void;
  withinAppShell?: boolean;
  existingWorkspaces?: Workspace[];
  onOpenWorkspace?: (workspace: Workspace) => void;
}) {
  const { mode, identityProvider } = useAuth();
  const demoMode = mode === "demo";
  const [repositories, setRepositories] = useState<Repository[]>(() => demoMode ? listDemoRepositories() : []);
	const [provider, setProvider] = useState<ProviderId>("GITLAB");
  const [repositoryProviders, setRepositoryProviders] = useState<ProviderId[]>(["GITLAB"]);
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const [providerStateReady, setProviderStateReady] = useState(demoMode);
  const clientReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const actionPortalTarget = clientReady ? document.querySelector<HTMLElement>(".app-frame") ?? document.body : null;
  const [step, setStep] = useState<WorkspaceFlowStep>(demoMode ? 1 : 0);
  const [furthestStep, setFurthestStep] = useState<WorkspaceFlowStep>(demoMode ? 1 : 0);
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
  const [repositoryBasePath, setRepositoryBasePath] = useState(DEFAULT_STORAGE_BASE_PATH);
  const [storageLayout, setStorageLayout] = useState<RepositoryStorageLayout>(() => structuredClone(RECOMMENDED_STORAGE_LAYOUT));
  const [reservedFolders, setReservedFolders] = useState<string[]>([DEFAULT_STORAGE_BASE_PATH]);
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
  const usesConfigurableLayout = analysis?.classification === "EMPTY" || analysis?.classification === "LEGACY" || analysis?.classification === "DETECTED";
  const storagePathInvalid = Boolean(repositoryTreeLoading || repositoryTreeError || validateStorageBasePath(repositoryBasePath)
    || storageBaseBlocked || (usesConfigurableLayout && validateStorageResolvedPaths(repositoryBasePath, storageLayout)));
  const storageLayoutInvalid = Boolean(validateStorageLayout(storageLayout).length
    || validateStorageResolvedPaths(repositoryBasePath, storageLayout));
  const workspaceDetailsValid = Boolean(workspaceName.trim() && (!usesConfigurableLayout || !storagePathInvalid));

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
      setSearched(Boolean(query.trim()));
    } catch (requestError) {
      setReconnectRequired(requestError instanceof ApiError && requestError.code === "GITLAB_RECONNECT_REQUIRED");
      setError(getUserFacingError(requestError, "프로젝트를 불러오지 못했습니다."));
    } finally {
      setState("ready");
    }
  }

  useEffect(() => {
	if (demoMode) return;
	const controller = new AbortController();
	void Promise.allSettled([
		getProviderCapabilities(controller.signal),
		listProviderAccounts(controller.signal),
	]).then(([capabilities, accounts]) => {
		if (controller.signal.aborted) return;
		const available: ProviderId[] = capabilities.status === "fulfilled"
			? capabilities.value.repositoryProviders ?? []
			: ["GITLAB"];
		setRepositoryProviders(available);
		if (accounts.status === "fulfilled") setProviderAccounts(accounts.value);
		setProvider((current) => available.includes(current) ? current : available[0] ?? current);
		setProviderStateReady(true);
	}).catch(() => setProviderStateReady(true));
	return () => controller.abort();
	}, [demoMode]);

  useEffect(() => {
	if (demoMode) {
		return;
	}
    if (step !== 1 || !repositoryProviders.includes(provider)) {
      return;
    }
    void listRepositories("", undefined, provider)
		.then((projects) => setRepositories(projects))
      .catch((requestError) => {
		setReconnectRequired(requestError instanceof ApiError && requestError.code.includes("REAUTH"));
		setError(getUserFacingError(requestError, "저장소를 불러오지 못했습니다."));
      })
      .finally(() => setState("ready"));
	}, [demoMode, provider, repositoryProviders, step]);

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

  function returnToRepositorySelection() {
    setStep(1);
    setError("");
    setReconnectRequired(false);
  }

  function resetRepositorySelection() {
    setSelectedId(null);
    setPermission("idle");
    setVerifiedAccessLevel(null);
    setAnalysis(null);
    setRepositoryTree([]);
    setRepositoryTreeLoading(false);
    setRepositoryTreeError("");
    setReservedFolders([DEFAULT_STORAGE_BASE_PATH]);
    setError("");
    setReconnectRequired(false);
  }

  function goToStep(nextStep: WorkspaceFlowStep) {
    setStep(nextStep);
    setFurthestStep((current) => Math.max(current, nextStep) as WorkspaceFlowStep);
    setError("");
  }

  function selectProvider(nextProvider: ProviderId) {
    const linkedAccount = providerAccounts.find((account) => account.provider === nextProvider);
    const connected = linkedAccount ? linkedAccount.status === "CONNECTED" : identityProvider === nextProvider;
    if (!repositoryProviders.includes(nextProvider) || !connected) return;
    resetRepositorySelection();
    setSearch("");
    setSearched(false);
    setState("loading");
    setProvider(nextProvider);
    goToStep(1);
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
    setRepositoryBasePath(DEFAULT_STORAGE_BASE_PATH);
    setStorageLayout(structuredClone(RECOMMENDED_STORAGE_LAYOUT));
    setReservedFolders([DEFAULT_STORAGE_BASE_PATH]);
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
		setReservedFolders([demoAnalysis.repositoryBasePath]);
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
		setReservedFolders([]);
      } else if (repositoryAnalysis.classification === "EMPTY" || repositoryAnalysis.classification === "LEGACY") {
        setStorageLayout(structuredClone(RECOMMENDED_STORAGE_LAYOUT));
        setRepositoryBasePath(DEFAULT_STORAGE_BASE_PATH);
		setReservedFolders([DEFAULT_STORAGE_BASE_PATH]);
      } else {
        setRepositoryBasePath(repositoryAnalysis.repositoryBasePath);
		setReservedFolders([]);
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
      || (usesConfigurableLayout && (repositoryTreeLoading || Boolean(repositoryTreeError) || validateStorageLayout(storageLayout).length > 0 || validateStorageBasePath(repositoryBasePath) || validateStorageResolvedPaths(repositoryBasePath, storageLayout) || storageBaseBlocked))) return;
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

  const pageSubtitle = step === 0
    ? "학습 기록을 가져올 서비스를 선택하세요."
    : step === 1
      ? "연결할 저장소를 선택하세요."
      : step === 2
        ? "권한과 연결 상태를 확인하세요."
        : step === 3
          ? "Workspace 이름과 학습 기록 위치를 정하세요."
          : "학습 기록을 저장할 구조를 확인하세요.";
  const providerChoices: ProviderId[] = ["GITLAB", "GITHUB"];
  const isProviderConnected = (candidate: ProviderId) => {
    if (demoMode) return candidate === "GITLAB";
    const linkedAccount = providerAccounts.find((account) => account.provider === candidate);
    return linkedAccount ? linkedAccount.status === "CONNECTED" : identityProvider === candidate;
  };
  const connectionReady = Boolean(selected && analysis && permission === "ready" && analysis.classification !== "CONFLICTED");
  const showCreationActions = Boolean(selected && !connectedWorkspace && !joinableWorkspace);

  function canOpenStep(target: WorkspaceFlowStep) {
    if (target === 0) return !demoMode;
    if (target === 1) return true;
    if (target === 2) return Boolean(selected);
    if (target === 3) return connectionReady;
    return connectionReady && workspaceDetailsValid;
  }

  function openVisitedStep(target: WorkspaceFlowStep) {
    if (target <= furthestStep && canOpenStep(target)) goToStep(target);
  }

  function goBack() {
    if (step === 1 && !demoMode) {
      goToStep(0);
      return;
    }
    if (step > 1) goToStep((step - 1) as WorkspaceFlowStep);
  }

  const actionBar = step > 0 ? <div className={`workspace-connect__actions workspace-connect__actions--wizard${withinAppShell ? " workspace-connect__actions--embedded" : ""}`}>
    <progress max="4" value={step} aria-label={`Workspace 연결 ${step}/4 단계`} />
    <div className="workspace-connect__action-row">
      <span>{step === 1 && !selected ? "저장소를 선택하면 계속할 수 있어요." : step === 3 && !workspaceDetailsValid ? "이름과 학습 기록 위치를 확인해주세요." : step === 4 && storageLayoutInvalid ? "저장 구조를 확인해주세요." : ""}</span>
      <div>
        {(step > 1 || !demoMode) ? <button className="button button--secondary" type="button" onClick={goBack}>이전</button> : null}
        {step === 1 ? <button className="button button--primary" type="button" disabled={!selected} onClick={() => goToStep(2)}>계속</button> : null}
        {step === 2 && showCreationActions ? <button className="button button--primary" type="button" disabled={!connectionReady} onClick={() => goToStep(3)}>계속</button> : null}
        {step === 3 ? <button className="button button--primary" type="button" disabled={!workspaceDetailsValid} onClick={() => goToStep(4)}>계속</button> : null}
        {step === 4 ? <button className="button button--primary" type="submit" form="workspace-create-form" disabled={state === "saving" || !workspaceDetailsValid || (usesConfigurableLayout && storageLayoutInvalid)}>
          {state === "saving" ? <><LoaderCircle className="spin" size={17} /> 연결 중…</> : usesConfigurableLayout ? "Workspace 연결하기" : "기존 학습 기록과 연결하기"}
        </button> : null}
      </div>
    </div>
  </div> : null;

  return (
    <>
    <main className={`${withinAppShell ? "workspace-connect workspace-connect--embedded" : "workspace-connect"}${step > 0 ? " workspace-connect--has-actions" : ""}`}>
      <div className="workspace-connect__inner">
        <header className="workspace-connect__header">
          <div className="workspace-connect__title-row">
            <h1>새 Workspace 연결</h1>
            {step > 0 ? (
              <nav className="workspace-connect__progress" aria-label="Workspace 연결 단계">
                <ol>
                  {WORKSPACE_FLOW_STEPS.map((item) => {
                    const available = item.step <= furthestStep && canOpenStep(item.step);
                    return <li key={item.step}>
                      <button type="button" aria-current={step === item.step ? "step" : undefined}
                        disabled={!available} onClick={() => openVisitedStep(item.step)}>
                        {item.step} {item.label}
                      </button>
                      {item.step < 4 ? <span aria-hidden="true">·</span> : null}
                    </li>;
                  })}
                </ol>
              </nav>
            ) : null}
          </div>
          <p>{pageSubtitle}</p>
          {demoMode ? <small>실제 계정이나 저장소에는 접근하지 않으며, 모든 정보는 데모 데이터입니다.</small> : null}
        </header>

        <div className="workspace-connect__stage" key={step}>
          {step === 0 ? (
            <section className="workspace-connect__provider-step" aria-labelledby="provider-select-title">
              <h2 id="provider-select-title" className="sr-only">저장소 서비스 선택</h2>
              {!providerStateReady ? (
                <div className="workspace-connect__status" role="status" aria-live="polite"><LoaderCircle className="spin" /> 사용할 수 있는 서비스를 확인하고 있어요.</div>
              ) : (
                <div className="workspace-connect__provider-cards">
                  {providerChoices.map((candidate) => {
                    const descriptor = getProviderDescriptor(candidate);
                    const repositoryReady = repositoryProviders.includes(candidate);
                    const accountConnected = isProviderConnected(candidate);
                    const available = repositoryReady && accountConnected;
                    return <article className={`workspace-connect__provider-card ${available ? "" : "is-disabled"}`} key={candidate}>
                      <button type="button" disabled={!available} onClick={() => selectProvider(candidate)}>
                        <span className="workspace-connect__provider-icon"><ProviderIcon provider={candidate} size={21} aria-hidden="true" /></span>
                        <span><strong>{descriptor.displayName}</strong><small>{available
                          ? `연결한 ${descriptor.displayName} 계정의 저장소를 사용합니다.`
                          : repositoryReady ? "계정을 연결하면 사용할 수 있어요." : "저장소 연결 기능을 아직 사용할 수 없어요."}</small></span>
                        <em>{available ? "저장소 선택하기" : repositoryReady ? "계정 연결 필요" : "사용할 수 없음"}<ChevronRight size={14} aria-hidden="true" /></em>
                      </button>
                      {!available && repositoryReady ? <Link href="/settings/accounts">설정에서 계정 연결</Link> : null}
                    </article>;
                  })}
                </div>
              )}
            </section>
          ) : null}

          {step === 1 ? (
            <section className="workspace-connect__section" aria-labelledby="repository-select-title">
              <h2 id="repository-select-title" className="sr-only">{providerDescriptor.repositoryLabel} 선택</h2>
              <form className="repository-search" onSubmit={handleSearch} role="search">
                <Search size={18} aria-hidden="true" />
                <input aria-label={`${providerDescriptor.repositoryLabel} 검색`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="저장소 이름으로 검색" />
                <button className="button button--secondary" type="submit" disabled={state === "loading"}>검색</button>
              </form>

              {error ? <div className="workspace-connect__error" role="alert">
                <AlertTriangle size={18} /><span><strong>저장소를 불러오지 못했어요.</strong><small>{error}</small></span>
                {reconnectRequired ? <a className="button button--secondary button--small" href={provider === "GITHUB" ? "/settings/accounts" : getGitLabReconnectUrl(APP_ROUTES.workspaceNew)}>다시 연결</a>
                  : <button className="button button--secondary button--small" type="button" onClick={() => void loadRepositories(search)}><RotateCcw size={15} /> 다시 시도</button>}
              </div> : null}

              {state === "loading" ? (
                <div className="workspace-connect__status" role="status" aria-live="polite"><LoaderCircle className="spin" /> 접근 가능한 저장소를 불러오고 있어요.</div>
              ) : repositories.length ? (
                <div className="repository-list" role="listbox" aria-label={`접근 가능한 ${providerDescriptor.repositoryLabel}`}>
                  {repositories.map((repository) => {
                    const isSelected = repository.externalId === selectedId;
                    const linked = existingWorkspaces.some((workspace) => workspace.repository?.provider === repository.provider && workspace.repository.externalRepositoryId === repository.externalId);
                    const joinable = discoverable.some((workspace) => workspace.provider === repository.provider && workspace.externalRepositoryId === repository.externalId);
                    const denied = !repository.capabilities.canWrite;
                    return <button type="button" role="option" aria-selected={isSelected} className={isSelected ? "is-selected" : undefined}
                      key={`${repository.provider}:${repository.externalId}`} onClick={() => void selectRepository(repository)}>
                      <span className="repository-list__copy"><strong>{repository.name}</strong><small>{providerDescriptor.displayName} · {repository.path}</small></span>
                      <span className="repository-list__meta">
                        {linked ? <em className="status-badge success">참여 중</em> : joinable ? <em className="status-badge neutral">Workspace 존재</em> : denied ? <em className="status-badge warning">쓰기 권한 필요</em> : null}
                        <em>{getRepositoryVisibilityLabel(repository.visibility)}</em>
                        <span className={`repository-list__selection${isSelected ? " is-selected" : ""}`} aria-hidden="true">
                          {isSelected ? <Check size={13} /> : null}
                        </span>
                      </span>
                    </button>;
                  })}
                </div>
              ) : (
                <div className="workspace-connect__status">
                  <span>{searched ? `조건에 맞는 ${providerDescriptor.repositoryLabel}가 없어요.` : `현재 계정으로 접근 가능한 ${providerDescriptor.repositoryLabel}가 없어요.`}</span>
                  {provider === "GITHUB" ? <a className="button button--secondary button--small" href="/api/v1/github/installations/new">GitHub App 설치 또는 저장소 선택</a> : null}
                </div>
              )}
            </section>
          ) : null}

          {step === 2 && selected ? (
            <section className="workspace-connect__section" aria-labelledby="connection-check-title">
              <h2 id="connection-check-title" className="sr-only">연결 확인</h2>
              {connectedWorkspace ? (
                <div className="connection-existing" role="status">
                  <CheckCircle2 size={20} /><div><strong>이미 Workspace와 연결된 프로젝트입니다.</strong><small>{connectedWorkspace.name}에서 이 저장소를 사용하고 있어요.</small></div>
                  <button className="button button--primary" type="button" onClick={() => onOpenWorkspace?.(connectedWorkspace)}>Workspace로 이동</button>
                </div>
              ) : joinableWorkspace ? (
                <div className="connection-existing connection-existing--join" role="status">
                  <CheckCircle2 size={20} /><div><strong>참여할 수 있는 Workspace가 있습니다.</strong><small>{joinableWorkspace.workspaceName}에 멤버로 참여할 수 있어요.</small></div>
                  <button className="button button--primary" type="button" disabled={joining} onClick={() => void handleJoin(joinableWorkspace.workspaceId)}>
                    {joining ? <><LoaderCircle className="spin" size={16} /> 참여 중…</> : "Workspace 참여하기"}
                  </button>
                </div>
              ) : <ConnectionSummary repository={selected} permission={permission} accessLevel={verifiedAccessLevel} analysis={analysis} checking={state === "checking"} />}
              {error ? <div className="workspace-connect__error" role="alert">
                <AlertTriangle size={18} /><span><strong>저장소를 확인하지 못했어요.</strong><small>{error}</small></span>
                {reconnectRequired ? <a className="button button--secondary button--small" href={provider === "GITHUB" ? "/settings/accounts" : getGitLabReconnectUrl(APP_ROUTES.workspaceNew)}>다시 연결</a>
                  : <button className="button button--secondary button--small" type="button" onClick={() => void selectRepository(selected)}><RotateCcw size={15} /> 다시 시도</button>}
              </div> : null}
            </section>
          ) : null}

          {step === 3 && selected && analysis ? (
            <section className="workspace-connect__section" aria-labelledby="workspace-details-title">
              <h2 id="workspace-details-title" className="sr-only">기본 정보</h2>
              <div className="workspace-connect__create">
                <label className="field">
                  <span>Workspace 이름</span>
                  <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} maxLength={80} required />
                  <small>저장소 이름과 다르게 정할 수 있습니다.</small>
                </label>
                {usesConfigurableLayout ? <StorageLayoutBuilder section="path" basePath={repositoryBasePath} layout={storageLayout}
                  tree={repositoryTree} treeLoading={repositoryTreeLoading} treeError={repositoryTreeError}
                  reservedFolders={reservedFolders} onReservedFoldersChange={setReservedFolders}
                  onRetryTree={() => void loadRepositoryFolders(selected)} onBasePathChange={setRepositoryBasePath} onLayoutChange={setStorageLayout} />
                  : <label className="field"><span>학습 기록 위치</span><input value={analysis.repositoryBasePath || "저장소 기존 경로"} readOnly /><small>기존 Study-ing 저장 구조와 경로를 그대로 사용합니다.</small></label>}
                <SelectedRepository repository={selected} onChange={returnToRepositorySelection} />
              </div>
            </section>
          ) : null}

          {step === 4 && selected && analysis ? (
            <form id="workspace-create-form" className="workspace-connect__section" aria-labelledby="storage-settings-title" onSubmit={handleCreate}>
              <h2 id="storage-settings-title" className="sr-only">저장 방식</h2>
              <div className="workspace-connect__create">
                {usesConfigurableLayout ? <StorageLayoutBuilder section="layout" basePath={repositoryBasePath} layout={storageLayout}
                  tree={repositoryTree} treeLoading={repositoryTreeLoading} treeError={repositoryTreeError}
                  reservedFolders={reservedFolders} onReservedFoldersChange={setReservedFolders}
                  detectedRecords={analysis.classification === "DETECTED" ? analysis.detectedRecords : 0}
                  onRetryTree={() => void loadRepositoryFolders(selected)} onBasePathChange={setRepositoryBasePath} onLayoutChange={setStorageLayout} />
                  : <div className="storage-layout-existing"><CheckCircle2 size={18} /><span><strong>기존 Study-ing 저장 구조를 유지합니다.</strong><small>현재 파일을 이동하지 않고 새 기록도 같은 위치에 저장합니다.</small></span></div>}
                {error ? <div className="workspace-connect__error" role="alert">
                  <AlertTriangle size={18} /><span><strong>Workspace를 연결하지 못했어요.</strong><small>{error}</small></span>
                  {reconnectRequired ? <a className="button button--secondary button--small" href={provider === "GITHUB" ? "/settings/accounts" : getGitLabReconnectUrl(APP_ROUTES.workspaceNew)}>다시 연결</a> : null}
                </div> : null}
              </div>
            </form>
          ) : null}
        </div>

      </div>
    </main>
    {actionPortalTarget && actionBar ? createPortal(actionBar, actionPortalTarget) : null}
    </>
  );
}

function SelectedRepository({ repository, onChange }: { repository: Repository; onChange: () => void }) {
  return <div className="workspace-connect__selected-repository">
    <ProviderIcon provider={repository.provider} size={17} aria-hidden="true" />
    <span><strong>{repository.name}</strong><small>{getProviderDescriptor(repository.provider).displayName} · {repository.path}</small></span>
    <button type="button" onClick={onChange}>저장소 변경</button>
  </div>;
}

function ConnectionSummary({ repository, permission, accessLevel, analysis, checking }: {
  repository: Repository;
  permission: PermissionState;
  accessLevel: number | null;
  analysis: RepositoryImportAnalysis | null;
  checking: boolean;
}) {
  const providerName = getProviderDescriptor(repository.provider).displayName;
  const permissionLabel = repository.provider === "GITLAB"
    ? accessLevel == null ? "확인 중" : accessLevel >= 40 ? "Maintainer" : accessLevel >= 30 ? "Developer" : accessLevel >= 20 ? "Reporter" : "접근 권한 없음"
    : accessLevel != null && accessLevel >= 40 ? "Admin" : accessLevel != null && accessLevel >= 30 ? "Write" : accessLevel != null && accessLevel >= 20 ? "Read" : "확인 중";

  if (permission === "denied") {
    return (
      <div className="connection-summary connection-summary--denied" role="alert">
        <AlertTriangle size={20} />
        <div>
          <strong>이 저장소를 연결할 권한이 없습니다.</strong>
          <small>저장소에 쓸 수 있는 권한이 필요합니다.</small>
          <details><summary>세부 정보 보기</summary><p>현재 권한 · {permissionLabel}<br />필요 권한 · 쓰기 가능</p></details>
        </div>
        {repository.webUrl ? <a href={repository.webUrl} target="_blank" rel="noreferrer">{providerName}에서 확인 <ExternalLink size={14} /></a> : null}
      </div>
    );
  }

  if (permission === "idle" && !checking && !analysis) return null;

  if (permission === "checking" || checking || !analysis) {
    return (
      <div className="connection-summary" role="status" aria-live="polite">
        <LoaderCircle className="spin" size={20} />
        <div><strong>연결 상태를 확인하고 있어요</strong><small>{repository.name}의 권한과 학습 기록을 확인합니다.</small></div>
      </div>
    );
  }

  const compatible = analysis.classification === "COMPATIBLE" || analysis.classification === "PARTIALLY_COMPATIBLE";
  const detected = analysis.classification === "DETECTED";
  const conflicted = analysis.classification === "CONFLICTED";
  return (
    <section className={`connection-summary ${conflicted ? "connection-summary--denied" : "connection-summary--ready"}`} aria-label="저장소 연결 상태">
      {conflicted ? <AlertTriangle size={20} /> : <CheckCircle2 size={20} />}
      <div>
        <strong>{conflicted ? "연결하기 전에 확인이 필요해요." : "연결할 수 있어요"}</strong>
        <span className="connection-summary__repository"><b>{repository.name}</b><small>{providerName} · {repository.path}</small></span>
        <small>{conflicted ? `${analysis.issues.length}개의 학습 데이터 문제를 확인해주세요.` : `쓰기 권한 있음 · 기본 브랜치 ${repository.defaultBranch ?? "main"}`}</small>
        <details>
          <summary>세부 정보 보기</summary>
          <dl>
            <div><dt>Provider</dt><dd>{providerName}</dd></div>
            <div><dt>권한</dt><dd>{permissionLabel}</dd></div>
            <div><dt>공개 범위</dt><dd>{getRepositoryVisibilityLabel(repository.visibility)}</dd></div>
            <div><dt>기본 브랜치</dt><dd>{repository.defaultBranch ?? "main"}</dd></div>
            <div><dt>저장소 ID</dt><dd>{repository.externalId}</dd></div>
            <div><dt>학습 기록</dt><dd>{compatible ? `일정 ${analysis.compatibleSessions}개 · 제출 ${analysis.compatibleSubmissions}건` : detected ? `${analysis.detectedRecords}개 감지` : "새 설정 사용"}</dd></div>
          </dl>
        </details>
      </div>
      {conflicted ? (
        <div className="connection-summary__problems">
          {analysis.issues.slice(0, 4).map((issue) => (
            <div key={`${issue.path}-${issue.code}`}><AlertTriangle size={15} /><span>{getIssueSummary(issue.code, issue.message)}</span></div>
          ))}
        </div>
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
