"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { PreSubmissionWarning } from "@/components/review/PreSubmissionWarning";
import { MemberDetailDialog } from "./MemberDetailDialog";
import { SubmissionDialog } from "./SubmissionDialog";
import { TodayNotice } from "./TodayNotice";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate, formatDateTime, formatTime } from "@/lib/domain/format";
import {
  getActiveRequiredItems,
  getDashboardMetrics,
  getMemberProgress,
  getSubmissionKey,
} from "@/lib/domain/metrics";
import type { MemberProgress, StudyMember, StudySession } from "@/lib/domain/types";

export function TodayWorkspace() {
  const { workspace, referenceDate } = useWorkspace();
  const session = workspace.sessions[referenceDate];

  if (!session) {
    return (
      <div className="page-stack">
        <header className="page-heading page-heading--today">
          <div>
            <p className="eyebrow">{formatDate(referenceDate, true)}</p>
            <h1>오늘 함께 공부하기</h1>
            <p>지금 해야 할 학습을 확인하고 바로 시작해 보세요.</p>
          </div>
        </header>
        <section className="surface schedule-empty today-empty" aria-labelledby="today-empty-title">
          <CalendarDays size={30} aria-hidden="true" />
          <strong id="today-empty-title">오늘 등록된 학습 일정이 없습니다</strong>
          <p>새 일정을 만들거나 활동함에서 놓친 학습을 확인해 보세요.</p>
          <Link href="/schedule" className="button button--primary"><CalendarDays size={16} /> 일정 열기</Link>
        </section>
      </div>
    );
  }

  return <TodaySession session={session} />;
}

function getMemberStatus(progress: MemberProgress, currentUserId: string) {
  if (progress.member.id !== currentUserId && progress.status === "COMPLETE") {
    return { label: "리뷰 필요", tone: "warning" };
  }
  if (progress.status === "COMPLETE") return { label: "완료", tone: "success" };
  if (progress.status === "PARTIAL") return { label: "진행 중", tone: "neutral" };
  return { label: "시작 전", tone: "neutral" };
}

function TodaySession({ session }: { session: StudySession }) {
  const { workspace, currentUserId, submitItem } = useWorkspace();
  const [submissionItemId, setSubmissionItemId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);
  const [pendingMember, setPendingMember] = useState<StudyMember | null>(null);

  const requiredItems = useMemo(() => getActiveRequiredItems(session), [session]);
  const activeItems = useMemo(
    () => session.items.filter((item) => item.status === "active"),
    [session.items],
  );
  const metrics = useMemo(() => getDashboardMetrics(workspace, session), [session, workspace]);
  const members = useMemo(() => getMemberProgress(workspace, session), [session, workspace]);
  const myProgress = members.find((progress) => progress.member.id === currentUserId)!;
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const nextItem = requiredItems.find(
    (item) => !myFile?.submissions.some((entry) => entry.itemId === item.id),
  );
  const meta = SESSION_TYPE_META[session.type];
  const started = Boolean(myFile?.submissions.length);
  const focusActionLabel = nextItem
    ? started
      ? "계속 학습하기"
      : "학습 시작하기"
    : "내 제출 보기";
  const changedBy = workspace.members.find(
    (member) => member.id === session.updatedBy || member.username === session.updatedBy,
  )?.displayName ?? session.updatedBy;

  function openFocusAction() {
    const itemId = nextItem?.id ?? requiredItems[0]?.id ?? activeItems[0]?.id;
    if (itemId) setSubmissionItemId(itemId);
  }

  function requestMember(member: StudyMember) {
    const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
    if (!file) return;
    if (member.id !== currentUserId && nextItem) {
      setPendingMember(member);
      return;
    }
    setSelectedMember(member);
  }

  return (
    <div className="page-stack today-collab-page">
      <header className="page-heading page-heading--today">
        <div>
          <p className="eyebrow">{formatDate(session.date, true)}</p>
          <h1>오늘 함께 공부하기</h1>
          <p>지금 해야 할 학습을 확인하고 가장 빠르게 다음 행동을 시작해 보세요.</p>
        </div>
      </header>

      <section className="surface today-focus" aria-labelledby="today-focus-title">
        <div className="today-focus__heading">
          <span className={`type-chip type-chip--${meta.tone}`}>{meta.label}</span>
          <div>
            <p>지금 해야 할 학습</p>
            <h2 id="today-focus-title">{session.title}</h2>
          </div>
        </div>

        <div className="today-focus__progress">
          <div>
            <span>{myProgress.completedItems} / {myProgress.requiredItems} 완료</span>
          </div>
          <ProgressBar value={myProgress.completionRate} label="내 오늘 학습 완료율" />
        </div>

        <div className="today-focus__next">
          <div>
            <small>{nextItem ? "다음 학습" : "오늘 학습"}</small>
            <strong>{nextItem?.title ?? "필수 학습을 모두 마쳤어요"}</strong>
            <span><Clock3 size={14} aria-hidden="true" /> 1차 마감 {formatTime(session.deadline)}</span>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={!activeItems.length}
            onClick={openFocusAction}
          >
            {focusActionLabel}<ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {session.change?.changed ? (
        <details className="today-change-notice">
          <summary>
            <span className="today-change-notice__marker" aria-hidden="true">!</span>
            <span>
              <strong>오늘 일정이 변경되었어요.</strong>
              <small>{session.change.message}</small>
            </span>
            <span className="today-change-notice__action">변경 내용 보기 <ChevronRight size={15} aria-hidden="true" /></span>
          </summary>
          <div className="today-change-notice__details">
            <dl>
              <div><dt>변경 요약</dt><dd>{session.change.message}</dd></div>
              <div><dt>변경 사유</dt><dd>{session.change.reason}</dd></div>
              <div><dt>변경자</dt><dd>{changedBy}</dd></div>
              <div><dt>변경 시각</dt><dd>{formatDateTime(session.updatedAt)}</dd></div>
            </dl>
          </div>
        </details>
      ) : null}

      <div className="today-collab-grid">
        <section className="surface today-plan" aria-labelledby="today-plan-title">
          <header className="today-section-head">
            <div>
              <h2 id="today-plan-title">오늘 학습 계획</h2>
              <p>{activeItems.length}개 학습 항목 · {formatTime(session.deadline)} 마감</p>
            </div>
          </header>
          <div className="today-plan-list">
            {activeItems.map((item) => {
              const submitted = myFile?.submissions.some((entry) => entry.itemId === item.id);
              const current = item.id === nextItem?.id;
              return (
                <article key={item.id} className={current ? "is-current" : undefined}>
                  <span className={`today-plan-status ${submitted ? "is-done" : ""}`} aria-hidden="true">
                    {submitted ? <Check size={15} /> : <Circle size={15} />}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span className="sr-only">{submitted ? "완료" : current ? "다음 학습" : "미제출"}{!item.required ? ", 선택 항목" : ""}</span>
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer">학습 자료 열기 <ExternalLink size={13} aria-hidden="true" /></a> : null}
                  </div>
                  <button
                    type="button"
                    className={current ? "button button--secondary button--small" : `today-row-action${submitted ? " today-row-action--edit" : ""}`}
                    aria-label={submitted ? `${item.title} 제출 수정` : undefined}
                    onClick={() => setSubmissionItemId(item.id)}
                  >
                    {submitted ? "제출 수정" : current ? "계속하기" : "제출"}
                  </button>
                </article>
              );
            })}
          </div>
          <footer className="today-section-footer">
            <Link href="/schedule">전체 일정 보기 <ArrowRight size={15} aria-hidden="true" /></Link>
          </footer>
        </section>

        <section className="surface today-team" aria-labelledby="today-team-title">
          <header className="today-section-head today-team__head">
            <div>
              <h2 id="today-team-title">팀 진행 상황</h2>
              <p>{metrics.completedMembers}명 / {metrics.totalMembers}명 완료</p>
            </div>
          </header>
          <div className="today-team__progress">
            <ProgressBar value={metrics.submissionRate} label="오늘 팀 전체 학습 완료율" />
          </div>
          <div className="today-team-list">
            {members.length ? members.map((progress) => {
              const file = workspace.submissions[getSubmissionKey(session.folder, progress.member.id)];
              const status = getMemberStatus(progress, currentUserId);
              return (
                <button
                  type="button"
                  key={progress.member.id}
                  disabled={!file}
                  aria-label={`${progress.member.displayName}, ${progress.completedItems}/${progress.requiredItems}, ${status.label}${file ? ", 제출과 리뷰 보기" : ""}`}
                  onClick={() => requestMember(progress.member)}
                >
                  <Avatar member={progress.member} />
                  <span>
                    <strong>{progress.member.displayName}{progress.member.id === currentUserId ? " (나)" : ""}</strong>
                  </span>
                  <em>{progress.completedItems} / {progress.requiredItems}</em>
                  <span className={`status-badge ${status.tone}`}>{status.label}</span>
                  {file ? <ChevronRight size={16} aria-hidden="true" /> : <span aria-hidden="true" />}
                </button>
              );
            }) : (
              <div className="today-team-empty"><Users size={23} aria-hidden="true" /><strong>팀원이 없습니다</strong><p>팀원이 참여하면 오늘 진행 상태를 함께 볼 수 있어요.</p></div>
            )}
          </div>
        </section>
      </div>

      <TodayNotice />

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
          currentUserId={currentUserId}
          onClose={() => setSelectedMember(null)}
        />
      ) : null}
      {pendingMember ? <PreSubmissionWarning onClose={() => setPendingMember(null)} onProceed={() => { setSelectedMember(pendingMember); setPendingMember(null); }} onContinueLearning={() => { if (nextItem) setSubmissionItemId(nextItem.id); setPendingMember(null); }} /> : null}
    </div>
  );
}
