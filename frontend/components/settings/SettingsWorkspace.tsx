"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FileText,
  GitBranch,
  History,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  MessageSquareText,
  Palette,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Unplug,
  UserRound,
  Users,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppTheme } from "@/components/providers/AppThemeProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useRepositoryConnection } from "@/lib/api/hooks/useRepositoryConnection";
import {
  deleteAccount,
	getGitLabReconnectUrl,
  getProviderAccountLinkUrl,
  getProviderCapabilities,
  listProviderAccounts,
  updateAccountProfile,
  type AccentColor,
  type ProviderAccount,
} from "@/lib/api/services/authApi";
import { ProviderIcon } from "@/components/providers/ProviderIcon";
import { getProviderDescriptor } from "@/lib/providers/provider-descriptors";
import { buildProviderAccountRows, getProviderLinkNotice, parseProviderLinkResult, type ProviderLinkResult } from "@/lib/providers/connected-accounts";
import {
  listAuditEvents,
  listMemberCandidates,
  listSyncJobs,
  type AuditEvent,
  type SyncJob,
} from "@/lib/api/services/workspaceApi";
import { GITLAB_ACCESS_LABEL } from "@/lib/domain/constants";
import { APP_ROLE_LABEL, canDeleteWorkspace, canManageWorkspaceSettings } from "@/lib/domain/permissions";
import type { StudyMember } from "@/lib/domain/types";
import type { CommitRules } from "@/lib/domain/types";
import {
  COMMIT_RULE_VARIABLES,
  DEFAULT_COMMIT_RULES,
  normalizeCommitRules,
  renderCommitMessage,
  validateCommitRules,
} from "@/lib/domain/commitRules";
import { confirmUnsavedChanges, useUnsavedChanges } from "@/lib/navigation/unsavedChanges";
import { APP_ROUTES } from "@/lib/routes";
import { getUserFacingError } from "@/lib/api/errors";
import { formatDateTime } from "@/lib/domain/format";

export type SettingsSection =
  | "general"
  | "study-rules"
  | "commit-rules"
  | "members"
  | "notifications"
  | "repository"
  | "data"
  | "profile"
  | "accounts"
  | "appearance"
  | "account"
  | "security"
  | "danger";

const SETTINGS_GROUPS: Array<{
  label: string;
  items: Array<{ id: SettingsSection; label: string; icon: typeof LayoutGrid }>;
}> = [
  {
    label: "Workspace",
    items: [
      { id: "general", label: "일반", icon: LayoutGrid },
      { id: "study-rules", label: "학습 규칙", icon: BookOpenCheck },
      { id: "commit-rules", label: "커밋 규칙", icon: MessageSquareText },
      { id: "members", label: "멤버", icon: Users },
      { id: "notifications", label: "알림", icon: Bell },
      { id: "repository", label: "저장소 연결", icon: GitBranch },
      { id: "data", label: "데이터 및 동기화", icon: Database },
    ],
  },
  {
    label: "내 설정",
    items: [
      { id: "profile", label: "프로필", icon: UserRound },
      { id: "accounts", label: "연결된 계정", icon: Unplug },
      { id: "appearance", label: "화면 설정", icon: Palette },
      { id: "account", label: "계정 관리", icon: KeyRound },
    ],
  },
  {
    label: "고급",
    items: [
      { id: "security", label: "보안 및 감사", icon: ShieldCheck },
      { id: "danger", label: "위험 영역", icon: AlertTriangle },
    ],
  },
];

const SECTION_COPY: Record<SettingsSection, { title: string; description: string }> = {
  general: { title: "Workspace 일반", description: "현재 Workspace의 이름과 운영 기준 시간을 관리합니다." },
  "study-rules": { title: "학습 규칙", description: "일정과 제출에 적용되는 현재 운영 정책을 확인합니다." },
  "commit-rules": { title: "커밋 규칙", description: "제출할 때 사용할 기본 커밋 메시지와 안내 문구를 관리합니다." },
  members: { title: "Workspace 멤버", description: "Study-ing 역할과 저장소 접근 상태를 구분해 관리합니다." },
  notifications: { title: "Workspace 알림", description: "이 Workspace에서 발생하는 주요 변경 알림을 설정합니다." },
  repository: { title: "저장소 연결", description: "현재 Workspace가 학습 기록을 저장하는 외부 저장소를 확인합니다." },
  data: { title: "데이터 및 동기화", description: "최근 동기화 상태와 학습 데이터 저장 구조를 관리합니다." },
  profile: { title: "프로필", description: "Study-ing에서 표시되는 이름과 개인 시간대를 관리합니다." },
  accounts: { title: "연결된 계정", description: "로그인과 저장소 접근에 사용하는 Provider 계정을 확인합니다." },
  appearance: { title: "화면 설정", description: "내 계정에 적용되는 화면 테마와 강조 색상을 선택합니다." },
  account: { title: "계정 관리", description: "약관을 확인하고 개인 Study-ing 계정의 상태를 관리합니다." },
  security: { title: "보안 및 감사", description: "데이터 작성 원칙과 최근 Workspace 변경 기록을 확인합니다." },
  danger: { title: "위험 영역", description: "현재 Workspace의 삭제와 복원 정책을 확인합니다." },
};

const NOTIFICATIONS = [
  { key: "scheduleChanges" as const, title: "일정 변경 알림", description: "팀 학습 일정이나 항목이 변경되면 알려줍니다." },
  { key: "submissionMismatch" as const, title: "제출 상태 알림", description: "일정 변경으로 기존 제출을 다시 확인해야 할 때 알려줍니다." },
  { key: "syncFailures" as const, title: "저장소 동기화 오류", description: "저장소 동기화가 완료되지 않으면 알려줍니다." },
];

const ACCENT_OPTIONS: Array<{ value: AccentColor; label: string }> = [
  { value: "PURPLE", label: "퍼플" },
  { value: "BLUE", label: "블루" },
  { value: "TEAL", label: "틸" },
  { value: "ORANGE", label: "오렌지" },
  { value: "ROSE", label: "로즈" },
];

const TIMEZONE_OPTIONS = (() => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] };
  try {
    return intl.supportedValuesOf?.("timeZone") ?? ["Asia/Seoul", "Asia/Tokyo", "UTC"];
  } catch {
    return ["Asia/Seoul", "Asia/Tokyo", "UTC"];
  }
})();

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("ko-KR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function currentSectionLabel(section: SettingsSection) {
  return SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => item.id === section)?.label ?? "일반";
}

function SettingsNavigation({ section, isOwner }: { section: SettingsSection; isOwner: boolean }) {
  const router = useRouter();
  return (
    <>
      <label className="settings-mobile-selector">
        <span>설정 항목</span>
        <select
          aria-label="설정 항목 선택"
          value={section}
          onChange={(event) => {
            if (event.target.value !== section && confirmUnsavedChanges()) router.push(APP_ROUTES.settingsSection(event.target.value));
          }}
        >
          {SETTINGS_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.filter((item) => item.id !== "danger" || isOwner).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <nav className="settings-local-nav" aria-label="설정 메뉴">
        {SETTINGS_GROUPS.map((group) => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.items.filter((item) => item.id !== "danger" || isOwner).map((item) => {
              const Icon = item.icon;
              const active = item.id === section;
              return (
                <Link key={item.id} href={APP_ROUTES.settingsSection(item.id)} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </>
  );
}

function TimezoneSelect({ value, onChange, disabled, describedBy }: { value: string; onChange: (value: string) => void; disabled?: boolean; describedBy?: string }) {
  const options = TIMEZONE_OPTIONS.includes(value) ? TIMEZONE_OPTIONS : [value, ...TIMEZONE_OPTIONS];
  return <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-describedby={describedBy}>{options.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select>;
}

function RestrictedSettings({ title, description }: { title: string; description: string }) {
  return <section className="settings-restricted" role="status"><LockKeyhole size={21} /><div><strong>{title}</strong><p>{description}</p></div></section>;
}

function SettingRows({ children }: { children: ReactNode }) {
  return <div className="settings-rows">{children}</div>;
}

function SettingRow({ label, description, value, children }: { label: string; description?: string; value?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <div><strong>{label}</strong>{description ? <p>{description}</p> : null}</div>
      {children ?? <span className="settings-row__value">{value}</span>}
    </div>
  );
}

function statusLabel(status?: string) {
  if (status === "SUCCESS") return "완료";
  if (status === "PARTIAL") return "일부 확인 필요";
  if (status === "FAILED") return "실패";
  if (status === "RUNNING") return "진행 중";
  return "확인 전";
}

function auditLabel(type: string) {
  const labels: Record<string, string> = {
    WORKSPACE_CREATED: "Workspace 생성",
    WORKSPACE_UPDATED: "Workspace 설정 변경",
    WORKSPACE_SOFT_DELETED: "Workspace 삭제",
    WORKSPACE_RESTORED: "Workspace 복원",
    MEMBER_ADDED: "멤버 추가",
    MEMBER_ROLE_UPDATED: "멤버 역할 변경",
    MEMBERS_SYNCED: "GitLab 멤버 동기화",
    NOTIFICATION_SETTINGS_UPDATED: "알림 설정 변경",
    REPOSITORY_SYNCED: "저장소 동기화",
    REPOSITORY_SYNC_PARTIAL: "일부 저장소 동기화",
    REPOSITORY_SCHEMA_MIGRATED: "저장 구조 이전",
    SESSION_CREATED: "일정 생성",
    SESSION_UPDATED: "일정 수정",
    SESSION_CANCELLED: "일정 취소",
  };
  return labels[type] ?? "Workspace 변경";
}

function ConnectedAccountsSettings({
	linkResult,
	mode,
	demoUsername,
	demoDisplayName,
}: {
	linkResult: ProviderLinkResult;
	mode: "oauth" | "demo";
	demoUsername: string;
	demoDisplayName: string | null;
}) {
	const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
	const [accountLinkProviders, setAccountLinkProviders] = useState<Array<ProviderAccount["provider"]>>([]);
	const [resolved, setResolved] = useState(mode === "demo");
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (mode === "demo") return;
		const controller = new AbortController();
		void Promise.allSettled([
			listProviderAccounts(controller.signal),
			getProviderCapabilities(controller.signal),
		]).then(([accountResult, capabilityResult]) => {
			if (controller.signal.aborted) return;
			if (accountResult.status === "fulfilled") {
				setAccounts(accountResult.value);
				setAccountLinkProviders(capabilityResult.status === "fulfilled"
					? capabilityResult.value.accountLinkProviders ?? []
					: accountResult.value.map((account) => account.provider));
			} else {
				setAccounts([]);
				setAccountLinkProviders([]);
			}
			setFailed(accountResult.status === "rejected" || capabilityResult.status === "rejected");
			setResolved(true);
		});
		return () => controller.abort();
	}, [mode]);

	const demoAccount = {
		id: "demo",
		provider: "GITLAB",
		externalUserId: "demo",
		username: demoUsername,
		displayName: demoDisplayName,
		avatarUrl: null,
		webUrl: null,
		status: "CONNECTED",
	} satisfies ProviderAccount;
	const visibleAccounts = mode === "demo" ? [demoAccount] : buildProviderAccountRows(accounts, accountLinkProviders);
	const linkNotice = mode === "demo" ? null : getProviderLinkNotice(linkResult);

	return <section className="settings-section-block" aria-busy={!resolved}>
		{!resolved ? <p className="settings-scope-note" role="status">연결된 계정을 확인하고 있어요.</p> : null}
		{resolved ? visibleAccounts.map((account) => {
			const descriptor = getProviderDescriptor(account.provider);
			const connected = account.status === "CONNECTED";
			const connectUrl = getProviderAccountLinkUrl(account.provider, APP_ROUTES.settingsSection("accounts"));
			return <div className="provider-account-row" key={account.provider}>
				<span className="provider-account-icon"><ProviderIcon provider={account.provider} size={21} /></span>
				<div><strong>{descriptor.displayName} 계정</strong><small>{account.username ? `@${account.username}` : "연결되지 않음"}</small></div>
				<span className={`status-badge ${connected ? "success" : "neutral"}`}>{connected ? "연결됨" : "연결되지 않음"}</span>
				{mode === "demo"
					? <span className="settings-scope-note">데모 계정</span>
					: <a className="button button--secondary button--small" href={connectUrl}><RefreshCcw size={14} /> {connected ? descriptor.reconnectLabel : descriptor.connectLabel}</a>}
			</div>;
		}) : null}
		{linkNotice ? <div className={`onboarding-error provider-link-result${linkNotice.tone === "neutral" ? " is-neutral" : ""}`} role={linkNotice.tone === "neutral" ? "status" : "alert"}><span>{linkNotice.message}</span>{linkNotice.retry ? <a className="button button--secondary button--small" href={getProviderAccountLinkUrl("GITHUB")}>다시 시도</a> : null}</div> : null}
		{failed ? <p className="settings-scope-note" role="alert">연결된 계정을 모두 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.</p> : null}
		<p className="settings-scope-note">{mode === "demo" ? "표시된 계정은 체험용 목업이며 실제 Provider 계정과 연결되지 않습니다." : "재승인은 개인 Provider 권한만 갱신하며 Workspace 저장소 연결은 바뀌지 않습니다."}</p>
	</section>;
}

export function SettingsWorkspace({ section = "general" }: { section?: SettingsSection }) {
	const searchParams = useSearchParams();
  const { mode, user, setUser } = useAuth();
  const { themeMode, accentColor, setThemeMode, setAccentColor, saving: themeSaving } = useAppTheme();
  const {
    workspace,
    syncing,
    syncWorkspace,
    syncMembers,
    addMember,
    updateMemberRole,
    lastSyncFailures,
    currentUserId,
    toggleNotification,
    saveWorkspaceGeneral,
    saveCommitRules,
    deleteCurrentWorkspace,
		notify,
  } = useWorkspace();
  const connection = useRepositoryConnection();
  const repositoryProvider = workspace.repository?.provider ?? "GITLAB";
  const repositoryProviderLabel = getProviderDescriptor(repositoryProvider).displayName;
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = canManageWorkspaceSettings(currentMember);
  const isOwner = canDeleteWorkspace(currentMember);
  const [candidates, setCandidates] = useState<StudyMember[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [memberBusy, setMemberBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmation, setConfirmation] = useState<"workspace" | "account" | null>(null);
  const [deleting, setDeleting] = useState(false);
	const [providerLinkResult] = useState<ProviderLinkResult>(() =>
		parseProviderLinkResult(searchParams.get("providerLink")),
	);
	const providerLinkHandled = useRef(false);
  const requestWorkspaceId = useRef(workspace.id);
  requestWorkspaceId.current = workspace.id;

  const refreshMembers = useMemo(() => async () => {
    if (mode === "demo" || !canManage || repositoryProvider !== "GITLAB") { setCandidates([]); return; }
    const workspaceId = workspace.id;
    try {
      const next = await listMemberCandidates(workspaceId);
      if (requestWorkspaceId.current === workspaceId) setCandidates(next);
    } catch {
      if (requestWorkspaceId.current === workspaceId) setCandidates([]);
    }
  }, [canManage, mode, repositoryProvider, workspace.id]);

  useEffect(() => {
    const workspaceId = workspace.id;
    setCandidates([]);
    setAuditEvents([]);
    setSyncJobs([]);
    if (section === "members") void refreshMembers();
    if (section === "security" && canManage && mode !== "demo") {
			void listAuditEvents(workspaceId)
				.then((items) => { if (requestWorkspaceId.current === workspaceId) setAuditEvents(items); })
				.catch(() => { if (requestWorkspaceId.current === workspaceId) setAuditEvents([]); });
    }
    if (section === "data" && canManage && mode !== "demo") {
			void listSyncJobs(workspaceId)
				.then((items) => { if (requestWorkspaceId.current === workspaceId) setSyncJobs(items); })
				.catch(() => { if (requestWorkspaceId.current === workspaceId) setSyncJobs([]); });
    }
  }, [canManage, mode, refreshMembers, section, workspace.id]);

	useEffect(() => {
		if (mode === "demo" || section !== "accounts" || !providerLinkResult || providerLinkHandled.current) return;
		providerLinkHandled.current = true;
		if (providerLinkResult === "success") notify("GitHub 계정을 연결했어요.");
		window.history.replaceState(window.history.state, "", APP_ROUTES.settingsSection("accounts"));
	}, [mode, notify, providerLinkResult, section]);

  const copy = SECTION_COPY[section];
  return (
    <div className="page-stack settings-page settings-hub-page">
      <header className="page-heading settings-page-heading">
        <div><h1>설정</h1><p>Workspace와 내 Study-ing 사용 환경을 관리하세요.</p></div>
      </header>
      <div className="settings-shell">
        <SettingsNavigation section={section} isOwner={isOwner} />
        <main key={section} className="settings-content motion-content-swap" aria-labelledby="settings-content-title">
          <header className="settings-content-header">
            <p>{currentSectionLabel(section)}</p>
            <h2 id="settings-content-title">{copy.title}</h2>
            <span>{copy.description}</span>
          </header>
          {section === "general" ? <GeneralSettings canManage={canManage} /> : null}
          {section === "study-rules" ? <StudyRulesSettings workspaceRequiresChangeNote={workspace.settings.requireChangeNoteWhenSubmitted} /> : null}
          {section === "commit-rules" ? <CommitRulesSettings canManage={canManage} /> : null}
          {section === "members" ? <MemberSettings canManage={canManage} isOwner={isOwner} candidates={candidates} busy={memberBusy} setBusy={setMemberBusy} refresh={refreshMembers} error={actionError} setError={setActionError} /> : null}
          {section === "notifications" ? <NotificationSettings canManage={canManage} /> : null}
          {section === "repository" ? <RepositorySettings /> : null}
          {section === "data" ? <DataSettings syncJobs={syncJobs} canManage={canManage} /> : null}
          {section === "profile" ? <ProfileSettings /> : null}
          {section === "accounts" ? <ConnectedAccountsSettings
				linkResult={providerLinkResult}
				mode={mode}
				demoUsername={user?.username ?? currentMember?.username ?? "demo"}
				demoDisplayName={user?.name ?? null}
			/> : null}
          {section === "appearance" ? <AppearanceSettings /> : null}
          {section === "account" ? <AccountSettings demoMode={mode === "demo"} onDelete={() => setConfirmation("account")} /> : null}
          {section === "security" ? <SecuritySettings canManage={canManage} events={auditEvents} /> : null}
          {section === "danger" ? isOwner ? <DangerSettings isOwner={isOwner} onDelete={() => setConfirmation("workspace")} /> : <RestrictedSettings title="소유자만 접근할 수 있어요" description="Workspace 삭제와 복원 정책은 소유자만 관리할 수 있습니다." /> : null}
        </main>
      </div>
      {confirmation ? (
        <Modal
          title={confirmation === "workspace" ? "Workspace를 삭제할까요?" : "Study-ing 계정을 탈퇴할까요?"}
          description={confirmation === "workspace"
            ? `Study-ing에서 Workspace가 삭제 상태로 전환됩니다. ${repositoryProviderLabel} 저장소 원본은 삭제되지 않습니다.`
            : "Study-ing 계정과 OAuth 연결 정보가 삭제됩니다."}
          onClose={() => { if (!deleting) { setActionError(""); setConfirmation(null); } }}
        >
          <div className="destructive-confirmation">
            <p>{confirmation === "workspace"
              ? `“${workspace.name}”은 7일 동안 Workspace Hub에서 복원할 수 있습니다.`
              : "Workspace의 공동 기록과 일부 운영 기록, 연결한 저장소의 학습 파일과 commit은 남을 수 있습니다. 활성 Workspace의 소유자라면 먼저 해당 Workspace를 삭제하거나 소유권을 정리해야 합니다."}</p>
            {actionError ? <div className="onboarding-error" role="alert">{actionError}</div> : null}
            <div className="modal-actions">
              <button type="button" className="button button--ghost" disabled={deleting} onClick={() => setConfirmation(null)}>취소</button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true); setActionError("");
                  const action = confirmation === "workspace" ? deleteCurrentWorkspace() : deleteAccount();
                  void action.then(() => {
                    if (confirmation === "account") window.location.href = "/login";
                    else setConfirmation(null);
                  }).catch((error) => setActionError(getUserFacingError(error, "요청을 처리하지 못했습니다.")))
                    .finally(() => setDeleting(false));
                }}
              >{deleting ? "처리 중…" : confirmation === "workspace" ? "Workspace 삭제" : "계정 탈퇴"}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );

  function GeneralSettings({ canManage: editable }: { canManage: boolean }) {
    const [name, setName] = useState(workspace.name);
    const [timezone, setTimezone] = useState(workspace.settings.timezone);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const dirty = name.trim() !== workspace.name || timezone !== workspace.settings.timezone;
    const validTimezone = isValidTimezone(timezone);
    useUnsavedChanges(editable && dirty && !saving);
    async function submit(event: FormEvent) {
      event.preventDefault();
      if (!dirty || !validTimezone) return;
      setSaving(true); setError("");
      try { await saveWorkspaceGeneral(name, timezone); setName(name.trim()); }
      catch (requestError) { setError(getUserFacingError(requestError, "Workspace 정보를 저장하지 못했습니다.")); }
      finally { setSaving(false); }
    }
    return (
      <form className="settings-form" onSubmit={submit}>
        <section className="settings-section-block">
          <h3>기본 정보</h3>
          <p>Workspace의 기본 정보이며 저장소 연결 정보와는 별개입니다.</p>
          <div className="settings-form-fields">
            <label><span>Workspace 이름</span><input value={name} onChange={(event) => setName(event.target.value)} disabled={!editable} required minLength={2} /></label>
            <label><span>Workspace 시간대</span><TimezoneSelect value={timezone} onChange={setTimezone} disabled={!editable} describedBy="workspace-timezone-help" /><small id="workspace-timezone-help">일정과 마감 시간을 계산하는 Workspace 공통 기준입니다.</small></label>
          </div>
        </section>
        <section className="settings-section-block">
          <h3>현재 상태</h3>
          <SettingRows>
            <SettingRow label="상태" description="Workspace의 운영 상태입니다." value={<span className={`status-badge ${workspace.status === "ACTIVE" ? "success" : "danger"}`}>{workspace.status === "ACTIVE" ? "활성" : "삭제 상태"}</span>} />
            <SettingRow label="내 Study-ing 역할" description="저장소 권한과 별개로 Study-ing 안에서 적용됩니다." value={currentMember ? APP_ROLE_LABEL[currentMember.role] : "멤버"} />
          </SettingRows>
        </section>
        {error ? <div className="onboarding-error" role="alert">{error}</div> : null}
        {editable ? <footer className="settings-form-actions"><span className="settings-save-state" aria-live="polite">{dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다."}</span><button className="button button--primary" type="submit" disabled={!dirty || saving || name.trim().length < 2 || !validTimezone}>{saving ? "저장 중…" : "저장"}</button></footer> : null}
      </form>
    );
  }

  function StudyRulesSettings({ workspaceRequiresChangeNote }: { workspaceRequiresChangeNote: boolean }) {
    return (
      <div className="settings-sections">
        <section className="settings-section-block"><h3>일정 변경</h3><SettingRows><SettingRow label="제출 후 일정 변경" description="제출이 있는 일정을 수정할 때 팀원에게 변경 사유를 남깁니다." value={workspaceRequiresChangeNote ? "변경 사유 필요" : "선택"} /></SettingRows></section>
        <section className="settings-section-block"><h3>점수 규칙</h3><p>현재 모든 Workspace에 동일하게 적용되는 고정 정책입니다.</p><SettingRows><SettingRow label="1차 마감 내 제출" value="10P" /><SettingRow label="2차 마감 내 제출" value="6P" /><SettingRow label="미제출 또는 최종 마감 이후" value="0P" /></SettingRows><div className="settings-info-note"><SlidersHorizontal size={17} /><span><strong>현재 변경할 수 없는 정책입니다</strong><small>점수 사용 여부와 팀 순위 표시는 아직 Workspace별 설정을 지원하지 않습니다.</small></span></div></section>
      </div>
    );
  }

  function CommitRulesSettings({ canManage: editable }: { canManage: boolean }) {
    const storedRules = normalizeCommitRules(workspace.settings.commitRules);
    const [rules, setRules] = useState<CommitRules>(storedRules);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const templateRef = useRef<HTMLInputElement>(null);
    const dirty = rules.submissionTemplate !== storedRules.submissionTemplate
      || rules.submissionGuidance !== storedRules.submissionGuidance;
    const validationError = validateCommitRules(rules);
    const preview = renderCommitMessage(rules.submissionTemplate, {
      action: "submit",
      name: currentMember?.displayName ?? "김서연",
      date: "2026-08-13",
      item: "그래프 탐색 문제 풀이",
      itemId: "item-a1b2c3d4",
      session: "그래프 집중 학습",
    });
    useUnsavedChanges(editable && dirty && !saving);

    function insertVariable(token: string) {
      if (!editable) return;
      const field = templateRef.current;
      const start = field?.selectionStart ?? rules.submissionTemplate.length;
      const end = field?.selectionEnd ?? start;
      const next = `${rules.submissionTemplate.slice(0, start)}${token}${rules.submissionTemplate.slice(end)}`;
      setRules((current) => ({ ...current, submissionTemplate: next }));
      requestAnimationFrame(() => {
        field?.focus();
        field?.setSelectionRange(start + token.length, start + token.length);
      });
    }

    async function submit(event: FormEvent) {
      event.preventDefault();
      if (!dirty || validationError) return;
      setSaving(true);
      setError("");
      try {
        await saveCommitRules({
          submissionTemplate: rules.submissionTemplate.trim(),
          submissionGuidance: rules.submissionGuidance.trim(),
        });
      } catch (requestError) {
        setError(getUserFacingError(requestError, "커밋 규칙을 저장하지 못했습니다."));
      } finally {
        setSaving(false);
      }
    }

    return (
      <form className="settings-form" onSubmit={submit}>
        <section className="settings-section-block">
          <h3>자동 커밋 메시지</h3>
          <p>학습 항목을 제출할 때 아래 규칙으로 기본 메시지를 만들며, 제출자는 저장 전에 수정할 수 있습니다.</p>
          <div className="settings-form-fields commit-rules-fields">
            <label>
              <span>메시지 규칙</span>
              <input
                ref={templateRef}
                type="text"
                value={rules.submissionTemplate}
                onChange={(event) => { setRules((current) => ({ ...current, submissionTemplate: event.target.value })); setError(""); }}
                disabled={!editable}
                maxLength={200}
                aria-describedby={validationError ? "commit-template-help commit-template-error" : "commit-template-help"}
              />
              <small id="commit-template-help">원하는 텍스트와 아래 변수를 함께 사용할 수 있습니다.</small>
            </label>
            <div className="commit-rule-variables" aria-label="커밋 메시지 변수">
              {COMMIT_RULE_VARIABLES.map((variable) => (
                <button key={variable.key} type="button" disabled={!editable} onClick={() => insertVariable(variable.token)}>
                  <span>{variable.label}</span><code>{variable.token}</code>
                </button>
              ))}
            </div>
            <div className="commit-rule-preview" aria-live="polite">
              <span>미리보기</span>
              <code>{preview || "커밋 메시지 미리보기"}</code>
            </div>
          </div>
        </section>
        <section className="settings-section-block">
          <h3>제출 화면 안내</h3>
          <p>사용자가 제출 화면에서 커밋 메시지를 확인하거나 수정할 때 보여줄 문구입니다.</p>
          <div className="settings-form-fields commit-rules-fields">
            <label>
              <span>안내 문구</span>
              <input
                type="text"
                value={rules.submissionGuidance}
                onChange={(event) => { setRules((current) => ({ ...current, submissionGuidance: event.target.value })); setError(""); }}
                disabled={!editable}
                maxLength={240}
              />
              <small>{rules.submissionGuidance.length} / 240</small>
            </label>
          </div>
        </section>
        {validationError ? <div id="commit-template-error" className="onboarding-error" role="alert">{validationError}</div> : null}
        {error ? <div className="onboarding-error" role="alert">{error}</div> : null}
        {!editable ? <RestrictedSettings title="소유자와 관리자만 변경할 수 있어요" description="멤버는 현재 Workspace의 커밋 규칙을 확인할 수 있습니다." /> : null}
        {editable ? (
          <footer className="settings-form-actions">
            <span className="settings-save-state" aria-live="polite">{dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다."}</span>
            <button
              className="button button--secondary"
              type="button"
              disabled={saving || (
                !dirty
                && rules.submissionTemplate === DEFAULT_COMMIT_RULES.submissionTemplate
                && rules.submissionGuidance === DEFAULT_COMMIT_RULES.submissionGuidance
              )}
              onClick={() => { setRules(DEFAULT_COMMIT_RULES); setError(""); }}
            >기본값으로 되돌리기</button>
            <button className="button button--primary" type="submit" disabled={!dirty || saving || Boolean(validationError)}>{saving ? "저장 중…" : "저장"}</button>
          </footer>
        ) : null}
      </form>
    );
  }

  function MemberSettings({ canManage: manageable, isOwner: owner, candidates: available, busy, setBusy, refresh, error, setError }: { canManage: boolean; isOwner: boolean; candidates: StudyMember[]; busy: boolean; setBusy: (value: boolean) => void; refresh: () => Promise<void>; error: string; setError: (value: string) => void }) {
    return (
      <div className="settings-sections">
        <section className="settings-section-block">
          <div className="settings-section-heading"><div><h3>멤버 목록</h3><p>Study-ing 역할과 {repositoryProviderLabel} 저장소 권한은 서로 다른 권한입니다.</p></div>{manageable && repositoryProvider === "GITLAB" ? <button className="button button--secondary button--small" type="button" disabled={busy} onClick={() => { setBusy(true); void syncMembers().then(refresh).catch((e) => setError(getUserFacingError(e, "멤버를 동기화하지 못했습니다."))).finally(() => setBusy(false)); }}><RefreshCcw size={15} /> {busy ? "동기화 중…" : "GitLab 멤버 동기화"}</button> : null}</div>
          <div className="settings-member-rows">
            {workspace.members.length ? workspace.members.map((member) => (
              <article key={member.id}>
                <Avatar member={member} />
                <div className="settings-member-identity"><strong>{member.displayName}{member.id === currentUserId ? " (나)" : ""}</strong><small>@{member.username}</small></div>
                <div className="settings-member-scope"><small>Study-ing 역할</small>{owner ? <select aria-label={`${member.displayName} Study-ing 역할`} value={member.role} disabled={busy} onChange={(event) => { setBusy(true); setError(""); void updateMemberRole(member.id, event.target.value as StudyMember["role"]).catch((e) => setError(getUserFacingError(e, "역할을 변경하지 못했습니다."))).finally(() => setBusy(false)); }}><option value="OWNER">소유자</option><option value="MANAGER">관리자</option><option value="MEMBER">멤버</option></select> : <strong>{APP_ROLE_LABEL[member.role]}</strong>}</div>
                <div className="settings-member-scope"><small>{repositoryProviderLabel} 권한</small><span>{repositoryProvider === "GITLAB" ? (GITLAB_ACCESS_LABEL[member.accessLevel] ?? member.accessLevel) : member.accessLevel >= 40 ? "관리" : member.accessLevel >= 30 ? "쓰기" : "읽기"}</span></div>
                <span className={`status-badge ${member.status === "ACTIVE" ? "success" : "danger"}`}>{member.status === "ACTIVE" ? "활성" : "접근 상실"}</span>
              </article>
            )) : <div className="settings-empty"><Users size={22} /><strong>등록된 멤버가 없어요</strong></div>}
          </div>
          {error ? <div className="onboarding-error" role="alert">{error}</div> : null}
        </section>
        {manageable && available.length ? <section className="settings-section-block"><h3>GitLab에서 확인된 멤버</h3><p>연결된 프로젝트에서 확인된 사용자만 Workspace에 추가할 수 있습니다.</p><div className="settings-candidate-rows">{available.map((candidate) => <article key={candidate.gitlabUserId}><Avatar member={candidate} /><span><strong>{candidate.displayName}</strong><small>@{candidate.username} · {GITLAB_ACCESS_LABEL[candidate.accessLevel] ?? candidate.accessLevel}</small></span><button type="button" className="button button--secondary button--small" disabled={busy} onClick={() => { setBusy(true); void addMember(Number(candidate.gitlabUserId)).then(refresh).finally(() => setBusy(false)); }}><UserPlus size={14} /> 추가</button></article>)}</div></section> : null}
        {repositoryProvider === "GITHUB" ? <p className="settings-scope-note">GitHub Workspace 참여는 연결된 저장소의 쓰기 권한을 서버에서 확인한 뒤 사용자가 직접 진행합니다.</p> : null}
      </div>
    );
  }

  function NotificationSettings({ canManage: manageable }: { canManage: boolean }) {
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [error, setError] = useState("");
    return <section className="settings-section-block"><div className="settings-scope-label">Workspace 전체 설정</div><div className="settings-toggle-rows">{NOTIFICATIONS.map((item) => { const checked = workspace.settings.notifications[item.key]; return <label key={item.key}><span><strong>{item.title}</strong><small>{item.description}{busyKey === item.key ? " · 저장 중…" : ""}</small></span>{manageable ? <><input type="checkbox" role="switch" aria-label={item.title} aria-describedby={error ? "notification-save-error" : undefined} checked={checked} disabled={Boolean(busyKey)} onChange={() => { setBusyKey(item.key); setError(""); void toggleNotification(item.key).catch((requestError) => setError(getUserFacingError(requestError, "알림 설정을 저장하지 못했습니다."))).finally(() => setBusyKey(null)); }} /><i aria-hidden="true" /></> : <strong className="settings-readonly-value">{checked ? "켜짐" : "꺼짐"}</strong>}</label>; })}</div>{error ? <div id="notification-save-error" className="onboarding-error" role="alert">{error}</div> : null}<p className="settings-scope-note">{manageable ? "변경사항은 즉시 저장되며 이 Workspace의 알림 정책에 적용됩니다." : "알림 정책은 소유자와 관리자만 변경할 수 있습니다."}</p></section>;
  }

  function RepositorySettings() {
    const connected = connection.state === "ready" && connection.data?.connectionState === "AVAILABLE";
    const project = connection.data;
    const status = connection.state === "loading" ? "확인 중" : connected ? `${repositoryProviderLabel} 연결 정상` : connection.state === "error" ? `${repositoryProviderLabel} 연결 오류` : `${repositoryProviderLabel} 재승인 필요`;
    const reconnectUrl = repositoryProvider === "GITHUB"
      ? getProviderAccountLinkUrl("GITHUB", APP_ROUTES.settingsSection("repository"))
      : getGitLabReconnectUrl(APP_ROUTES.settingsSection("repository"));
    return <div className="settings-sections"><section className={`repository-status-surface ${connected ? "is-healthy" : "is-attention"}`}><div className="repository-status-icon"><ProviderIcon provider={repositoryProvider} size={21} /></div><div><small>현재 Provider</small><h3>{repositoryProviderLabel}</h3><p>{project?.fullName ?? workspace.repository?.fullName ?? workspace.gitlabProjectPath}</p></div><span className={`status-badge ${connected ? "success" : connection.state === "loading" ? "neutral" : "warning"}`}>{status}</span></section><section className="settings-section-block"><h3>연결 정보</h3><SettingRows><SettingRow label="기본 브랜치" value={project?.defaultBranch ?? workspace.defaultBranch} /></SettingRows><details className="settings-details"><summary>저장소 세부 정보</summary><dl><div><dt>최근 동기화</dt><dd>{workspace.lastSyncedAt ? formatDateTime(workspace.lastSyncedAt, workspace.settings.timezone) : "기록 없음"}</dd></div><div><dt>Repository ID</dt><dd>{project?.externalId ?? workspace.repository?.externalRepositoryId ?? workspace.gitlabProjectId}</dd></div><div><dt>학습 데이터 경로</dt><dd>{workspace.repositorySchemaVersion >= 2 ? ".study-workspace/sessions" : workspace.repositoryBasePath || "저장소 루트"}</dd></div><div><dt>권한</dt><dd>{project?.capabilities.canManage ? "관리" : project?.capabilities.canWrite ? "쓰기" : project?.capabilities.canRead ? "읽기" : "확인 전"}</dd></div></dl></details></section>{!connected && connection.state !== "loading" ? <section className="settings-warning-surface"><AlertTriangle size={18} /><span><strong>{repositoryProviderLabel} 연결을 다시 확인해주세요</strong><small>연결이 만료되었거나 필요한 권한을 확인할 수 없습니다.</small></span><a className="button button--secondary button--small" href={reconnectUrl}>다시 연결</a></section> : null}</div>;
  }

  function DataSettings({ syncJobs: jobs, canManage: manageable }: { syncJobs: SyncJob[]; canManage: boolean }) {
    return (
      <div className="settings-sections">
        <section className="settings-section-block">
          <div className="settings-section-heading">
            <div><h3>저장소 동기화</h3><p>{repositoryProviderLabel}의 일정 파일과 현재 Workspace 데이터를 다시 확인합니다.</p></div>
            {manageable ? <button type="button" className="button button--primary button--small" disabled={syncing} onClick={() => void syncWorkspace()}><RefreshCcw className={syncing ? "spin" : undefined} size={15} />{syncing ? "동기화 중…" : "지금 동기화"}</button> : null}
          </div>
          {lastSyncFailures.length ? (
            <div className="sync-failure-list" role="alert">
              <strong>최근 동기화에서 확인할 항목</strong>
              {lastSyncFailures.map((failure) => (
                <span key={`${failure.path}-${failure.code}`}>
                  {failure.message}
                  <details className="settings-details"><summary>기술 정보</summary><code>{failure.path}</code><code>{failure.code}</code></details>
                </span>
              ))}
            </div>
          ) : <p className="repository-layout-status"><CheckCircle2 size={15} /> 최근 확인된 동기화 문제가 없습니다.</p>}
          {jobs.length ? (
            <div className="settings-sync-history">
              <strong>최근 동기화</strong>
              {jobs.slice(0, 5).map((job) => <span key={job.id}><i className={`status-dot ${job.status === "FAILED" ? "status-dot--danger" : job.status === "PARTIAL" ? "status-dot--warning" : ""}`} /><b>{statusLabel(job.status)}</b><small>{formatDateTime(job.startedAt, workspace.settings.timezone)}</small></span>)}
            </div>
          ) : null}
          {!manageable ? <p className="settings-scope-note">저장소 동기화는 소유자와 관리자만 실행할 수 있습니다.</p> : null}
        </section>
        <section className="settings-section-block">
          <h3>학습 데이터 저장 구조</h3>
          <p>기본 사용에는 변경할 필요가 없는 고급 데이터 작업입니다.</p>
          <SettingRows>
            <SettingRow label="현재 구조" description={workspace.repositorySchemaVersion >= 2 ? "서비스 전용 경로에 정리되어 있습니다." : "기존 날짜 폴더 구조를 사용 중입니다."} value={`버전 ${workspace.repositorySchemaVersion}`} />
            {isOwner && workspace.repositorySchemaVersion < 2 ? <SettingRow label="저장 구조 이전" description="대상 파일과 이동 경로를 확인한 뒤 별도 페이지에서 실행합니다."><Link className="button button--secondary button--small" href={APP_ROUTES.settingsMigration}>이전 검토 <ChevronRight size={14} /></Link></SettingRow> : null}
          </SettingRows>
        </section>
      </div>
    );
  }

  function ProfileSettings() {
    const member = workspace.members.find((candidate) => candidate.id === currentUserId);
    const [displayName, setDisplayName] = useState(user?.name ?? member?.displayName ?? "");
    const [recordName, setRecordName] = useState((user?.repositoryFileName ?? member?.fileName ?? "").replace(/\.md$/i, ""));
    const [timezone, setTimezone] = useState(user?.timezone ?? "Asia/Seoul");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const originalRecordName = (user?.repositoryFileName ?? member?.fileName ?? "").replace(/\.md$/i, "");
    const originalTimezone = user?.timezone ?? "Asia/Seoul";
    const dirty = displayName.trim() !== (user?.name ?? member?.displayName ?? "") || recordName.trim() !== originalRecordName || timezone !== originalTimezone;
    const validTimezone = isValidTimezone(timezone);
    useUnsavedChanges(dirty && !saving);
    async function submit(event: FormEvent) { event.preventDefault(); if (mode === "demo") { setError("데모 모드에서는 프로필을 변경할 수 없습니다."); return; } setSaving(true); setError(""); try { const updated = await updateAccountProfile({ displayName, repositoryFileName: recordName, timezone, acceptTerms: false, acceptPrivacy: false, confirmMinimumAge: false }); setUser(updated); await syncMembers(); } catch (e) { setError(getUserFacingError(e, "프로필을 저장하지 못했습니다.")); } finally { setSaving(false); } }
    return <form className="settings-form" onSubmit={submit}><section className="settings-section-block"><h3>기본 정보</h3><div className="settings-form-fields"><label className="is-primary"><span>표시 이름</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required /><small>Workspace, 일정, 제출과 리뷰에서 표시됩니다.</small></label><label><span>학습 기록 이름</span><div className="settings-file-input"><FileText size={16} /><input value={recordName} onChange={(event) => setRecordName(event.target.value)} required maxLength={80} /><em>.md</em></div><small>새 학습 기록 파일 이름에 사용됩니다. 기존 제출 파일 경로는 유지됩니다.</small></label><label><span>개인 시간대</span><TimezoneSelect value={timezone} onChange={setTimezone} describedBy="profile-timezone-help" /><small id="profile-timezone-help">내 화면에서 날짜와 시간을 표시할 때 사용됩니다. Workspace 마감 기준 시간대와는 별개입니다.</small></label></div></section>{error ? <div className="onboarding-error" role="alert">{error}</div> : null}<footer className="settings-form-actions"><span className="settings-save-state" aria-live="polite">{dirty ? "저장하지 않은 변경사항이 있습니다." : "모든 변경사항이 저장되었습니다."}</span><button className="button button--primary" type="submit" disabled={!dirty || saving || displayName.trim().length < 2 || !recordName.trim() || !validTimezone}>{saving ? "저장 중…" : "프로필 저장"}</button></footer></form>;
  }

  function AppearanceSettings() {
    return <div className="settings-sections"><section className="settings-section-block"><h3>화면 테마</h3><div className="settings-mode-control" role="radiogroup" aria-label="화면 테마"><button type="button" role="radio" aria-checked={themeMode === "LIGHT"} disabled={themeSaving} onClick={() => void setThemeMode("LIGHT")}><Eye size={16} /> 라이트</button><button type="button" role="radio" aria-checked={themeMode === "DARK"} disabled={themeSaving} onClick={() => void setThemeMode("DARK")}><Eye size={16} /> 다크</button></div></section><section className="settings-section-block"><h3>강조 색상</h3><p>버튼, 선택 상태와 주요 안내에 적용됩니다.</p><div className="accent-options settings-accent-options" role="radiogroup" aria-label="강조 색상">{ACCENT_OPTIONS.map((option) => <button key={option.value} className="accent-option" data-accent-option={option.value.toLowerCase()} type="button" role="radio" aria-checked={accentColor === option.value} disabled={themeSaving} onClick={() => void setAccentColor(option.value)}><i>{accentColor === option.value ? <Check size={14} /> : null}</i><span>{option.label}</span></button>)}</div></section></div>;
  }

  function AccountSettings({ demoMode: demo, onDelete }: { demoMode: boolean; onDelete: () => void }) {
    return <div className="settings-sections"><section className="settings-section-block"><h3>약관 및 개인정보</h3><SettingRows><SettingRow label="이용약관"><Link className="settings-text-link" href="/terms?returnTo=/settings/account">보기 <ChevronRight size={14} /></Link></SettingRow><SettingRow label="개인정보 처리 안내"><Link className="settings-text-link" href="/privacy?returnTo=/settings/account">보기 <ChevronRight size={14} /></Link></SettingRow></SettingRows></section><section className="personal-danger-section"><div><h3>Study-ing 계정 탈퇴</h3><p>{demo ? "데모에는 실제 Study-ing 계정이나 OAuth 연결 정보가 없습니다." : "Study-ing 계정과 OAuth 연결 정보가 삭제되고, Workspace 멤버 정보는 탈퇴한 사용자로 바뀝니다. Workspace의 공동 기록과 일부 운영 기록, 연결한 저장소에 이미 저장된 파일은 남을 수 있습니다."}</p></div><button type="button" className="button button--danger" disabled={demo} onClick={onDelete}>{demo ? "데모 계정" : "계정 탈퇴"}</button></section></div>;
  }

  function SecuritySettings({ canManage: manageable, events }: { canManage: boolean; events: AuditEvent[] }) {
    return <div className="settings-sections"><section className="settings-section-block"><h3>데이터 작성 원칙</h3><div className="security-principle-rows"><article><KeyRound size={18} /><span><strong>사용자 계정으로 기록</strong><small>작업할 때 로그인한 사용자의 {repositoryProviderLabel} 권한을 다시 확인합니다.</small></span></article><article><LockKeyhole size={18} /><span><strong>허용된 경로만 변경</strong><small>Workspace의 학습 데이터 경로와 본인 제출 범위 안에서만 기록합니다.</small></span></article><article><ShieldCheck size={18} /><span><strong>변경 충돌 방지</strong><small>저장소가 바뀌었으면 덮어쓰지 않고 최신 상태를 다시 확인합니다.</small></span></article></div></section><section className="settings-section-block"><h3>최근 감사 기록</h3><p>Study-ing에서 수행된 주요 Workspace 관리 작업입니다.</p>{!manageable ? <p className="settings-scope-note">감사 기록은 소유자와 관리자만 확인할 수 있습니다.</p> : events.length ? <div className="settings-audit-rows">{events.slice(0, 10).map((event) => <article key={event.id}><span className="settings-audit-icon"><History size={15} /></span><div><strong>{auditLabel(event.eventType)}</strong><small>{formatDateTime(event.createdAt, workspace.settings.timezone)}</small></div></article>)}</div> : <div className="settings-empty"><History size={22} /><strong>표시할 감사 기록이 없어요</strong></div>}</section></div>;
  }

  function DangerSettings({ isOwner: owner, onDelete }: { isOwner: boolean; onDelete: () => void }) {
    return <section className="workspace-danger-section"><div><h3>Workspace 삭제</h3><p>Study-ing에서 현재 Workspace 연결을 삭제 상태로 전환합니다. {repositoryProviderLabel} 저장소와 원본 학습 파일은 삭제되지 않으며, 7일 동안 Workspace Hub에서 복원할 수 있습니다.</p></div>{owner ? <button type="button" className="button button--danger" onClick={onDelete}>Workspace 삭제</button> : <p className="settings-scope-note">Workspace 삭제는 소유자만 할 수 있습니다.</p>}</section>;
  }
}
