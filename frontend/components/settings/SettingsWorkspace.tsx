"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  GitBranch,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Users,
  UserPlus,
  RefreshCcw,
  CheckCheck,
  History,
  Unplug,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { useGitLabConnection } from "@/lib/api/hooks/useGitLabConnection";
import { GITLAB_ACCESS_LABEL } from "@/lib/domain/constants";
import {
  listMemberCandidates,
  listNotifications,
  markNotificationRead,
  listAuditEvents,
  type InAppNotification,
  type AuditEvent,
} from "@/lib/api/services/workspaceApi";
import type { StudyMember } from "@/lib/domain/types";
import { deleteAccount, getGitLabReconnectUrl } from "@/lib/api/services/authApi";
import { Modal } from "@/components/ui/Modal";

const notifications = [
  {
    key: "scheduleChanges" as const,
    title: "일정 변경",
    description: "항목 교체와 일정 수정 내용을 알려줍니다.",
  },
  {
    key: "submissionMismatch" as const,
    title: "제출 기준 불일치",
    description: "session revision과 기존 제출이 어긋나면 경고합니다.",
  },
  {
    key: "syncFailures" as const,
    title: "GitLab 동기화 실패",
    description: "권한·네트워크·충돌 오류가 발생하면 알려줍니다.",
  },
];

export function SettingsWorkspace() {
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
    deleteCurrentWorkspace,
  } = useWorkspace();
  const [deleting, setDeleting] = useState(false);
  const [memberBusy, setMemberBusy] = useState(false);
  const [candidates, setCandidates] = useState<StudyMember[]>([]);
  const [inbox, setInbox] = useState<InAppNotification[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [confirmation, setConfirmation] = useState<"workspace" | "account" | null>(null);
  const [accountDeleting, setAccountDeleting] = useState(false);
  const [actionError, setActionError] = useState("");
  const connection = useGitLabConnection();
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = currentMember?.role === "OWNER" || currentMember?.role === "MANAGER";
  const isOwner = currentMember?.role === "OWNER";

  const refreshOperationalData = useMemo(() => async () => {
    const [candidateResult, notificationResult, auditResult] = await Promise.allSettled([
      canManage ? listMemberCandidates(workspace.id) : Promise.resolve([]),
      listNotifications(),
      canManage ? listAuditEvents(workspace.id) : Promise.resolve([]),
    ]);
    if (candidateResult.status === "fulfilled") setCandidates(candidateResult.value);
    if (notificationResult.status === "fulfilled") setInbox(notificationResult.value);
    if (auditResult.status === "fulfilled") setAuditEvents(auditResult.value);
  }, [canManage, workspace.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshOperationalData(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshOperationalData, syncing]);
  const connected =
    connection.state === "ready" &&
    connection.data?.status === "CONNECTED" &&
    Boolean(connection.data.project);
  const project = connection.data?.project;
  const connectionLabel =
    connection.state === "loading"
      ? "확인 중"
      : connection.state === "error"
        ? "연결 실패"
        : connected
          ? "연결됨"
          : "설정 필요";
  const connectionClass =
    connection.state === "error"
      ? "danger"
      : connected
        ? "success"
        : connection.state === "loading"
          ? "neutral"
          : "warning";

  return (
    <div className="page-stack settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>설정</h1>
          <p>Workspace 연결과 멤버, 알림을 관리합니다.</p>
        </div>
      </header>

      <nav className="settings-subnav" aria-label="설정 섹션">
        <a href="#connection-settings">연결</a>
        <a href="#member-settings">멤버</a>
        <a href="#notification-settings">알림</a>
        <a href="#security-settings">보안</a>
        <a href="#account-settings">계정</a>
        <a href="#danger-settings">삭제</a>
      </nav>

      <section id="connection-settings" className="surface settings-section" aria-labelledby="connection-title">
        <header className="section-heading">
          <span className="settings-icon"><GitBranch size={19} /></span>
          <div><h2 id="connection-title">저장소 연결</h2><p>Workspace는 아래 프로젝트 하나에만 접근합니다.</p></div>
          <span className={`status-badge ${connectionClass}`}>{connectionLabel}</span>
          <button
            type="button"
            className="button button--secondary button--small"
            disabled={syncing || !connected}
            onClick={() => void syncWorkspace()}
          >
            {syncing ? "일정 동기화 중…" : "GitLab 일정 동기화"}
          </button>
        </header>
        <dl className="settings-definition-grid">
          <div><dt>GitLab 프로젝트</dt><dd>{project?.pathWithNamespace ?? "연결 전"}</dd></div>
          <div><dt>Project ID</dt><dd>{project?.id ?? "—"}</dd></div>
          <div><dt>기본 브랜치</dt><dd>{project?.defaultBranch ?? "—"}</dd></div>
          <div><dt>시간대</dt><dd>{workspace.settings.timezone}</dd></div>
          <div><dt>GitLab 사용자</dt><dd>{connection.data?.user ? `@${connection.data.user.username}` : "—"}</dd></div>
          <div><dt>연결 상태</dt><dd>{connection.error ?? connection.data?.message ?? "백엔드 응답 대기 중"}</dd></div>
        </dl>
        {lastSyncFailures.length ? (
          <div className="sync-failure-list" role="alert">
            <strong>최근 동기화에서 확인할 항목</strong>
            {lastSyncFailures.map((failure) => (
              <span key={`${failure.path}-${failure.code}`}><code>{failure.path}</code>{failure.message}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section id="member-settings" className="surface settings-section" aria-labelledby="members-settings-title">
        <header className="section-heading">
          <span className="settings-icon"><Users size={19} /></span>
          <div><h2 id="members-settings-title">Workspace 멤버</h2><p>Owner와 Manager만 멤버를 관리하며 GitLab 프로젝트 권한을 기준으로 검증합니다.</p></div>
          {canManage ? (
            <button
              type="button"
              className="button button--secondary button--small"
              disabled={memberBusy}
              onClick={() => {
                setMemberBusy(true);
                void syncMembers().then(refreshOperationalData).finally(() => setMemberBusy(false));
              }}
            ><RefreshCcw size={15} /> {memberBusy ? "동기화 중…" : "GitLab 멤버 동기화"}</button>
          ) : null}
        </header>
        <div className="settings-member-list">
          {workspace.members.map((member) => (
            <article key={member.id}>
              <Avatar member={member} />
              <span><strong>{member.displayName}</strong><small>@{member.username} · {member.fileName}</small></span>
              <span className="permission-pair"><em>앱</em>{isOwner ? (
                <select
                  aria-label={`${member.displayName} Workspace 역할`}
                  value={member.role}
                  disabled={memberBusy}
                  onChange={(event) => {
                    setMemberBusy(true);
                    void updateMemberRole(member.id, event.target.value as StudyMember["role"])
                      .catch((error) => setActionError(error instanceof Error ? error.message : "역할을 변경하지 못했습니다."))
                      .finally(() => setMemberBusy(false));
                  }}
                ><option value="OWNER">Owner</option><option value="MANAGER">Manager</option><option value="MEMBER">Member</option></select>
              ) : member.role === "OWNER" ? "Owner" : member.role === "MANAGER" ? "Manager" : "Member"}</span>
              <span className="permission-pair"><em>GitLab</em>{GITLAB_ACCESS_LABEL[member.accessLevel] ?? member.accessLevel}</span>
              <span className={`status-badge ${member.status === "ACTIVE" ? "success" : "danger"}`}>{member.status === "ACTIVE" ? "활성" : "접근 상실"}</span>
            </article>
          ))}
        </div>
        {canManage && candidates.length ? (
          <div className="member-candidates">
            <strong>추가 가능한 GitLab 프로젝트 멤버</strong>
            {candidates.map((candidate) => (
              <article key={candidate.gitlabUserId}>
                <Avatar member={candidate} />
                <span><strong>{candidate.displayName}</strong><small>@{candidate.username} · {GITLAB_ACCESS_LABEL[candidate.accessLevel] ?? candidate.accessLevel}</small></span>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  disabled={memberBusy}
                  onClick={() => {
                    setMemberBusy(true);
                    void addMember(Number(candidate.gitlabUserId)).then(refreshOperationalData).finally(() => setMemberBusy(false));
                  }}
                ><UserPlus size={15} /> 추가</button>
              </article>
            ))}
          </div>
        ) : null}
        {!confirmation && actionError ? <div className="onboarding-error" role="alert">{actionError}</div> : null}
      </section>

      <section id="notification-settings" className="surface settings-section" aria-labelledby="notification-title">
        <header className="section-heading">
          <span className="settings-icon"><Bell size={19} /></span>
          <div><h2 id="notification-title">알림</h2><p>중요한 저장소 상태 변화만 선택해서 받습니다.</p></div>
        </header>
        <div className="toggle-list">
          {notifications.map((item) => {
            const checked = workspace.settings.notifications[item.key];
            return (
              <label key={item.key}>
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleNotification(item.key)}
                />
                <i aria-hidden="true" />
              </label>
            );
          })}
        </div>
        {inbox.length ? (
          <div className="notification-inbox">
            <strong>앱 알림</strong>
            {inbox.map((notification) => (
              <article className={notification.readAt ? "is-read" : ""} key={notification.id}>
                <span><strong>{notification.title}</strong><small>{notification.message} · {new Date(notification.createdAt).toLocaleString("ko-KR")}</small></span>
                {!notification.readAt ? (
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={() => void markNotificationRead(notification.id).then((updated) => setInbox((current) => current.map((item) => item.id === updated.id ? updated : item)))}
                  ><CheckCheck size={14} /> 읽음</button>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section id="security-settings" className="surface settings-section settings-section--security" aria-labelledby="security-title">
        <header className="section-heading">
          <span className="settings-icon"><ShieldCheck size={19} /></span>
          <div><h2 id="security-title">보안 원칙</h2><p>프론트엔드는 임의의 project_id나 파일 경로를 쓰기 요청으로 보내지 않습니다.</p></div>
        </header>
        <div className="security-principles">
          <article><KeyRound size={18} /><span><strong>사용자 계정 커밋</strong><small>로그인 사용자의 GitLab 권한과 보호 브랜치 규칙을 재검증합니다.</small></span></article>
          <article><LockKeyhole size={18} /><span><strong>파일 경로 제한</strong><small>본인에게 매핑된 날짜별 제출 파일만 수정할 수 있습니다.</small></span></article>
          <article><AlertTriangle size={18} /><span><strong>충돌 방지</strong><small>last_commit_id와 session revision이 다르면 덮어쓰지 않습니다.</small></span></article>
        </div>
        {canManage && auditEvents.length ? (
          <div className="audit-event-list">
            <strong><History size={15} /> 최근 감사 로그</strong>
            {auditEvents.slice(0, 10).map((event) => (
              <span key={event.id}><code>{event.eventType}</code><small>{event.targetType} {event.targetId} · {new Date(event.createdAt).toLocaleString("ko-KR")}</small></span>
            ))}
          </div>
        ) : null}
      </section>

      <section id="account-settings" className="surface settings-section" aria-labelledby="account-title">
        <header className="section-heading">
          <span className="settings-icon"><Unplug size={19} /></span>
          <div><h2 id="account-title">계정과 GitLab 승인</h2><p>권한이 철회되었거나 scope가 바뀐 경우 GitLab 승인을 다시 받을 수 있습니다.</p></div>
          <a className="button button--secondary button--small" href={getGitLabReconnectUrl()}><RefreshCcw size={15} /> GitLab 다시 승인</a>
        </header>
        <div className="account-policy-links">
          <a href="/terms">이용약관</a>
          <a href="/privacy">개인정보 처리 안내</a>
          <button type="button" onClick={() => { setActionError(""); setConfirmation("account"); }}>계정 탈퇴</button>
        </div>
      </section>

      <section id="danger-settings" className="surface danger-zone" aria-labelledby="danger-title">
        <div><Trash2 size={19} /><span><h2 id="danger-title">Workspace 삭제</h2><p>GitLab 파일은 삭제하지 않고 7일 동안 복구 가능한 상태로 전환합니다.</p></span></div>
        <button
          type="button"
          className="button button--danger"
          disabled={deleting}
          onClick={() => { setActionError(""); setConfirmation("workspace"); }}
        >
          {deleting ? "삭제 중…" : "소프트 삭제"}
        </button>
      </section>

      {confirmation ? (
        <Modal
          title={confirmation === "workspace" ? "Workspace를 삭제할까요?" : "Study Workspace 계정을 탈퇴할까요?"}
          description={confirmation === "workspace"
            ? "GitLab 파일은 그대로 두고 서비스 DB 상태만 7일간 복원 가능하게 전환합니다."
            : "OAuth 승인을 폐기하고 계정 정보를 삭제합니다. GitLab commit과 파일은 삭제되지 않습니다."}
          onClose={() => { setActionError(""); setConfirmation(null); }}
        >
          <div className="destructive-confirmation">
            <p>{confirmation === "workspace"
              ? `“${workspace.name}”은 삭제 후 첫 Workspace 화면의 복원 목록에서 되돌릴 수 있습니다.`
              : "활성 Workspace의 Owner라면 안전을 위해 탈퇴가 거부됩니다. 먼저 소유한 Workspace를 모두 삭제해 주세요."}</p>
            {actionError ? <div className="onboarding-error" role="alert">{actionError}</div> : null}
            <div className="modal-actions">
              <button type="button" className="button button--ghost" onClick={() => setConfirmation(null)}>취소</button>
              <button
                type="button"
                className="button button--danger"
                disabled={deleting || accountDeleting}
                onClick={() => {
                  if (confirmation === "workspace") {
                    setDeleting(true);
                    void deleteCurrentWorkspace()
                      .then(() => setConfirmation(null))
                      .catch((error) => setActionError(error instanceof Error ? error.message : "Workspace를 삭제하지 못했습니다."))
                      .finally(() => setDeleting(false));
                    return;
                  }
                  setAccountDeleting(true);
                  void deleteAccount()
                    .then(() => { window.location.href = "/login"; })
                    .catch((error) => setActionError(error instanceof Error ? error.message : "계정을 삭제하지 못했습니다."))
                    .finally(() => setAccountDeleting(false));
                }}
              >{deleting || accountDeleting ? "처리 중…" : confirmation === "workspace" ? "Workspace 삭제" : "계정 탈퇴"}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
