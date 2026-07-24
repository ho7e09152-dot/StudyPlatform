"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  FileCode2,
  FolderGit2,
  GitBranch,
  History,
  Send,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MemberDetailDialog } from "./MemberDetailDialog";
import { SubmissionDialog } from "./SubmissionDialog";
import {
  REFERENCE_DATE,
  SESSION_TYPE_META,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/domain/constants";
import { formatDate, formatDateTime, formatTime } from "@/lib/domain/format";
import {
  getActiveRequiredItems,
  getDashboardMetrics,
  getMemberProgress,
  getSubmissionKey,
} from "@/lib/domain/metrics";
import type { StudyMember } from "@/lib/domain/types";

export function TodayWorkspace() {
  const { workspace, currentUserId, submitItem } = useWorkspace();
  const session =
    workspace.sessions[REFERENCE_DATE] ??
    Object.values(workspace.sessions)
      .filter((candidate) => candidate.status === "active")
      .sort((a, b) => b.date.localeCompare(a.date))[0];
  const [submissionItemId, setSubmissionItemId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);

  const requiredItems = useMemo(() => getActiveRequiredItems(session), [session]);
  const metrics = useMemo(
    () => getDashboardMetrics(workspace, session),
    [session, workspace],
  );
  const members = useMemo(
    () => getMemberProgress(workspace, session),
    [session, workspace],
  );
  const myProgress = members.find((progress) => progress.member.id === currentUserId)!;
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const meta = SESSION_TYPE_META[session.type];
  const nextItem = requiredItems.find(
    (item) => !myFile?.submissions.some((entry) => entry.itemId === item.id),
  );

  return (
    <div className="page-stack">
      <header className="page-heading page-heading--today">
        <div>
          <p className="eyebrow">{formatDate(session.date, true)} · TODAY</p>
          <h1>오늘의 학습</h1>
          <p>{session.description}</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setSubmissionItemId(nextItem?.id ?? requiredItems[0]?.id)}
        >
          <Send size={17} />
          {nextItem ? "이어서 제출하기" : "제출 내용 확인"}
        </button>
      </header>

      {session.change?.changed ? (
        <section className="change-notice" aria-labelledby="change-title">
          <span className="change-notice__icon">
            <History size={19} />
          </span>
          <div>
            <strong id="change-title">오늘 일정이 변경되었습니다</strong>
            <p>{session.change.message}</p>
            <span>변경 사유 · {session.change.reason} · revision {session.revision}</span>
          </div>
          <span className="status-badge warning">확인 필요</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="오늘의 진행 지표">
        <article className="metric-card metric-card--accent">
          <span className="metric-icon"><Users size={20} /></span>
          <div>
            <span>팀 완료</span>
            <strong>{metrics.completedMembers}<small>/{metrics.totalMembers}명</small></strong>
            <p>모든 필수 항목을 제출한 멤버</p>
          </div>
          <div className="metric-ring" style={{ "--progress": `${metrics.memberCompletionRate * 3.6}deg` } as React.CSSProperties}>
            <span>{metrics.memberCompletionRate}%</span>
          </div>
        </article>

        <article className="metric-card">
          <span className="metric-icon metric-icon--soft"><FileCode2 size={20} /></span>
          <div className="metric-card__wide">
            <span>전체 제출</span>
            <strong>{metrics.submittedItems}<small>/{metrics.totalRequiredSubmissions}건</small></strong>
            <ProgressBar value={metrics.submissionRate} label="전체 제출률" />
            <p>활성 멤버 × 필수 활성 항목 기준</p>
          </div>
        </article>

        <article className="metric-card">
          <span className="metric-icon metric-icon--mint"><Check size={20} /></span>
          <div className="metric-card__wide">
            <span>내 진행</span>
            <strong>{myProgress.completedItems}<small>/{myProgress.requiredItems}개</small></strong>
            <ProgressBar value={myProgress.completionRate} color="#2e7d62" label="내 완료율" />
            <p>{myProgress.status === "COMPLETE" ? "오늘 학습 완료" : `${myProgress.requiredItems - myProgress.completedItems}개 항목이 남았습니다`}</p>
          </div>
        </article>
      </section>

      <div className="today-columns">
        <section className="surface session-card" aria-labelledby="session-title">
          <header className="section-heading">
            <div>
              <span className={`type-chip type-chip--${meta.tone}`}>{meta.short} · {meta.label}</span>
              <h2 id="session-title">{session.title}</h2>
            </div>
            <div className="session-meta">
              {session.secondaryDeadline ? (
                <>
                  <span><Clock3 size={15} /> 1차 {formatTime(session.deadline)} 마감</span>
                  <span><Clock3 size={15} /> 2차 {formatTime(session.secondaryDeadline)} 마감</span>
                </>
              ) : (
                <span><Clock3 size={15} /> {formatTime(session.deadline)} 마감</span>
              )}
              <span><FileCode2 size={15} /> {session.folder}/session.yml</span>
            </div>
          </header>

          <div className="session-items">
            {session.items
              .filter((item) => item.status === "active")
              .map((item, index) => {
                const submitted = myFile?.submissions.some(
                  (entry) => entry.itemId === item.id,
                );
                return (
                  <article key={item.id} className="session-item">
                    <span className={`step-number ${submitted ? "done" : ""}`}>
                      {submitted ? <Check size={15} /> : index + 1}
                    </span>
                    <div>
                      <div className="session-item__title">
                        <strong>{item.title}</strong>
                        <span className={`status-badge ${submitted ? "success" : "danger"}`}>
                          {submitted ? "제출 완료" : "미제출"}
                        </span>
                      </div>
                      <p>
                        {item.source ?? "직접 학습"} · {SUBMISSION_TYPE_LABEL[item.submitType]} 제출
                        {!item.required ? " · 선택 항목" : ""}
                      </p>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer">
                          학습 자료 <ExternalLink size={13} />
                        </a>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={submitted ? "button button--secondary" : "button button--primary"}
                      onClick={() => setSubmissionItemId(item.id)}
                    >
                      {submitted ? "수정" : "제출"}
                    </button>
                  </article>
                );
              })}
          </div>
        </section>

        <aside className="surface repo-preview" aria-labelledby="repo-preview-title">
          <header>
            <span className="repo-badge"><FolderGit2 size={18} /></span>
            <div>
              <h2 id="repo-preview-title">저장소 미리보기</h2>
              <p>{workspace.gitlabProjectPath}</p>
            </div>
          </header>
          <div className="branch-row"><GitBranch size={15} /> {workspace.defaultBranch}</div>
          <div className="file-tree">
            <strong>📁 {session.folder}/</strong>
            <span>├─ session.yml <em>rev.{session.revision}</em></span>
            {workspace.members.map((member, index) => {
              const progress = members.find((item) => item.member.id === member.id)!;
              const prefix = index === workspace.members.length - 1 ? "└─" : "├─";
              return (
                <span key={member.id}>
                  {prefix} {member.fileName}
                  <em className={progress.status === "COMPLETE" ? "complete" : ""}>
                    {progress.completedItems}/{progress.requiredItems}
                  </em>
                </span>
              );
            })}
          </div>
          <div className="repo-preview__commit">
            <span>최근 변경</span>
            <strong>{session.updatedBy}</strong>
            <small>{formatDateTime(session.updatedAt)}</small>
          </div>
          <Link href="/repository" className="text-link">
            저장소 전체 보기 <ArrowRight size={15} />
          </Link>
        </aside>
      </div>

      <section className="surface members-section" aria-labelledby="members-title">
        <header className="section-heading">
          <div>
            <p className="eyebrow">MEMBER PROGRESS</p>
            <h2 id="members-title">멤버 진행 현황</h2>
            <p>모든 활성 멤버가 동등한 관리 권한을 가지며, 제출 파일은 본인만 수정합니다.</p>
          </div>
        </header>
        <div className="member-table" role="table" aria-label="멤버 진행 현황">
          <div className="member-table__head" role="row">
            <span role="columnheader">멤버</span>
            <span role="columnheader">완료율</span>
            <span role="columnheader">상태</span>
            <span role="columnheader">최근 제출</span>
          </div>
          {members.map((progress) => (
            <button
              key={progress.member.id}
              type="button"
              className="member-row"
              role="row"
              onClick={() => setSelectedMember(progress.member)}
            >
              <span className="member-cell member-cell--profile" role="cell">
                <Avatar member={progress.member} />
                <span>
                  <strong>{progress.member.displayName}{progress.member.id === currentUserId ? " (나)" : ""}</strong>
                  <small>{progress.member.fileName}</small>
                </span>
              </span>
              <span className="member-cell member-cell--progress" role="cell">
                <ProgressBar value={progress.completionRate} color={progress.member.color} />
                <strong>{progress.completedItems}/{progress.requiredItems}</strong>
              </span>
              <span role="cell">
                <span className={`status-badge ${progress.status === "COMPLETE" ? "success" : progress.status === "PARTIAL" ? "warning" : "neutral"}`}>
                  {progress.status === "COMPLETE" ? "완료" : progress.status === "PARTIAL" ? "진행 중" : "미제출"}
                </span>
              </span>
              <span className="member-cell member-cell--date" role="cell">
                {progress.lastSubmittedAt ? formatDateTime(progress.lastSubmittedAt) : "—"}
                <ArrowRight size={16} />
              </span>
            </button>
          ))}
        </div>
      </section>

      {submissionItemId ? (
        <SubmissionDialog
          workspace={workspace}
          session={session}
          currentUserId={currentUserId}
          initialItemId={submissionItemId}
          onSubmit={submitItem}
          onClose={() => setSubmissionItemId(null)}
        />
      ) : null}
      {selectedMember ? (
        <MemberDetailDialog
          workspace={workspace}
          session={session}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      ) : null}
    </div>
  );
}
