"use client";

import {
  AlertTriangle,
  Bell,
  GitBranch,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { GITLAB_ACCESS_LABEL } from "@/lib/domain/constants";

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
  const { workspace, toggleNotification } = useWorkspace();

  return (
    <div className="page-stack settings-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE CONFIGURATION</p>
          <h1>설정</h1>
          <p>앱의 권한과 GitLab 프로젝트 권한을 분리해 관리합니다.</p>
        </div>
      </header>

      <nav className="settings-subnav" aria-label="설정 섹션">
        <a href="#connection-settings">연결</a>
        <a href="#member-settings">멤버</a>
        <a href="#notification-settings">알림</a>
        <a href="#security-settings">보안</a>
        <a href="#danger-settings">삭제</a>
      </nav>

      <section id="connection-settings" className="surface settings-section" aria-labelledby="connection-title">
        <header className="section-heading">
          <span className="settings-icon"><GitBranch size={19} /></span>
          <div><h2 id="connection-title">저장소 연결</h2><p>Workspace는 아래 프로젝트 하나에만 접근합니다.</p></div>
          <span className="status-badge success">연결됨</span>
        </header>
        <dl className="settings-definition-grid">
          <div><dt>GitLab 프로젝트</dt><dd>{workspace.gitlabProjectPath}</dd></div>
          <div><dt>Project ID</dt><dd>{workspace.gitlabProjectId}</dd></div>
          <div><dt>기본 브랜치</dt><dd>{workspace.defaultBranch}</dd></div>
          <div><dt>시간대</dt><dd>{workspace.settings.timezone}</dd></div>
        </dl>
        <div className="security-note"><LockKeyhole size={17} /><span><strong>토큰은 브라우저에 저장하지 않습니다.</strong>백엔드가 암호화한 OAuth 토큰으로 연결된 프로젝트만 호출합니다.</span></div>
      </section>

      <section id="member-settings" className="surface settings-section" aria-labelledby="members-settings-title">
        <header className="section-heading">
          <span className="settings-icon"><Users size={19} /></span>
          <div><h2 id="members-settings-title">Workspace 멤버</h2><p>모든 활성 멤버는 앱에서 동등한 관리 권한을 가집니다.</p></div>
          <button
            type="button"
            className="button button--secondary button--small"
            disabled
            title="멤버 동기화 API 연동 후 사용할 수 있습니다."
          >
            GitLab 멤버 동기화
          </button>
        </header>
        <div className="settings-member-list">
          {workspace.members.map((member) => (
            <article key={member.id}>
              <Avatar member={member} />
              <span><strong>{member.displayName}</strong><small>@{member.username} · {member.fileName}</small></span>
              <span className="permission-pair"><em>앱</em>동등 권한</span>
              <span className="permission-pair"><em>GitLab</em>{GITLAB_ACCESS_LABEL[member.accessLevel] ?? member.accessLevel}</span>
              <span className={`status-badge ${member.status === "ACTIVE" ? "success" : "danger"}`}>{member.status === "ACTIVE" ? "활성" : "접근 상실"}</span>
            </article>
          ))}
        </div>
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
      </section>

      <section id="danger-settings" className="surface danger-zone" aria-labelledby="danger-title">
        <div><Trash2 size={19} /><span><h2 id="danger-title">Workspace 삭제</h2><p>GitLab 파일은 삭제하지 않고 7일 동안 복구 가능한 상태로 전환합니다.</p></span></div>
        <button
          type="button"
          className="button button--danger"
          disabled
          title="Workspace 삭제 API 연동 후 사용할 수 있습니다."
        >
          소프트 삭제
        </button>
      </section>
    </div>
  );
}
