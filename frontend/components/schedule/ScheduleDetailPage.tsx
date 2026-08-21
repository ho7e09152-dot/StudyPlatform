"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  Clock3,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { MemberDetailDialog } from "@/components/today/MemberDetailDialog";
import { SubmissionDialog } from "@/components/today/SubmissionDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StorageDetails } from "@/components/ui/StorageDetails";
import { getStorageDetailsCopy } from "@/lib/domain/storage";
import { PreSubmissionWarning } from "@/components/review/PreSubmissionWarning";
import { getUserFacingError } from "@/lib/api/errors";
import { formatDate, formatDateTime, getSessionRepositoryPath } from "@/lib/domain/format";
import { getDashboardMetrics, getMemberProgress, getSubmissionKey } from "@/lib/domain/metrics";
import { canManageSchedules } from "@/lib/domain/permissions";
import type { MemberProgress, StudyMember } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";

function getStatus(date: string, status: "active" | "cancelled", referenceDate: string, secondaryDeadline?: string) {
  if (status === "cancelled") return { label: "취소됨", tone: "danger" };
  if (date === referenceDate) return { label: "오늘", tone: "primary" };
  if (date > referenceDate) return { label: "예정", tone: "neutral" };
  if (secondaryDeadline && secondaryDeadline.slice(0, 10) >= referenceDate) return { label: "지각 제출 가능", tone: "warning" };
  return { label: "마감", tone: "neutral" };
}

function getMemberStatus(progress: MemberProgress, currentUserId: string) {
  if (progress.member.id !== currentUserId && progress.status === "COMPLETE") return { label: "리뷰 필요", tone: "warning" };
  if (progress.status === "COMPLETE") return { label: "완료", tone: "success" };
  if (progress.status === "PARTIAL") return { label: "진행 중", tone: "neutral" };
  return { label: "시작 전", tone: "neutral" };
}

export function ScheduleDetailPage({ date }: { date: string }) {
  const { workspace, referenceDate, currentUserId, submitItem, toggleChecklistItem, cancelSession } = useWorkspace();
  const session = workspace.sessions[date];
  const [submissionItemId, setSubmissionItemId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);
  const [pendingMember, setPendingMember] = useState<StudyMember | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [checkingItemId, setCheckingItemId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState("");

  const activeItems = useMemo(() => session?.items.filter((item) => item.status === "active") ?? [], [session]);
  const members = useMemo(() => session ? getMemberProgress(workspace, session) : [], [session, workspace]);
  const metrics = useMemo(() => session ? getDashboardMetrics(workspace, session) : null, [session, workspace]);

  if (!session) {
    return (
      <div className="page-stack schedule-route-state" role="alert">
        <strong>일정을 찾을 수 없어요.</strong>
        <p>일정 목록을 새로 확인해 주세요.</p>
        <Link href={APP_ROUTES.schedule} className="button button--secondary">학습 일정으로 돌아가기</Link>
      </div>
    );
  }

  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = canManageSchedules(currentMember);
  const latestSecondaryDeadline = activeItems
    .map((item) => item.secondaryDeadline)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const status = getStatus(session.date, session.status, referenceDate, latestSecondaryDeadline);
  const myProgress = members.find((progress) => progress.member.id === currentUserId);
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const completionRate = myProgress?.completionRate ?? 0;
  const hasTrackableItems = activeItems.some((item) => (item.kind ?? "submission") !== "event" && item.required);
  const completedSchedule = session.status === "cancelled" || session.date < referenceDate;
  const changedBy = workspace.members.find(
    (member) => member.id === session.updatedBy || member.username === session.updatedBy,
  )?.displayName ?? session.updatedBy;

  function requestMember(member: StudyMember) {
    const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
    if (!file) return;
    if (member.id !== currentUserId && completionRate < 100) setPendingMember(member);
    else setSelectedMember(member);
  }

  async function cancelCurrentSession() {
    setCancelling(true);
    setCancelError("");
    try {
      await cancelSession(session.date);
      setConfirmCancel(false);
      setMenuOpen(false);
    } catch (error) {
      setCancelError(getUserFacingError(error, "일정을 취소하지 못했습니다."));
    } finally {
      setCancelling(false);
    }
  }

  async function updateChecklist(itemId: string, completed: boolean) {
    setCheckingItemId(itemId);
    setCheckError("");
    try {
      await toggleChecklistItem(session.date, itemId, completed);
    } catch (error) {
      setCheckError(getUserFacingError(error, "체크 상태를 변경하지 못했습니다."));
    } finally {
      setCheckingItemId(null);
    }
  }

  function closeCancelConfirmation() {
    setConfirmCancel(false);
    setMenuOpen(false);
  }

  return (
    <div className="page-stack schedule-detail-page">
      <header className="schedule-page-back"><Link href={APP_ROUTES.schedule}><ArrowLeft size={17} /> 학습 일정</Link></header>

      <header className="schedule-detail-header">
        <div>
          <div className="schedule-detail-header__badges">
            <span className={`status-badge ${status.tone}`}>{status.label}</span>
            {session.change?.changed ? <span className="status-badge warning">변경됨</span> : null}
          </div>
          <h1>{formatDate(session.date, true)}</h1>
          <div className="schedule-detail-header__meta">
            <span><CalendarDays size={15} /> 등록된 항목 {activeItems.length}개</span>
          </div>
        </div>
        {canManage ? (
          <div className="schedule-detail-actions">
            {session.status !== "cancelled" ? <Link href={APP_ROUTES.scheduleEdit(session.date)} className="button button--secondary"><Pencil size={15} /> 편집</Link> : null}
            <div className="schedule-overflow">
              <button type="button" className="icon-button" aria-label="일정 관리 메뉴" aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><MoreHorizontal size={20} /></button>
              {menuOpen ? <div className="schedule-overflow__menu" role="menu">{session.status !== "cancelled" ? <button type="button" role="menuitem" onClick={() => setConfirmCancel(true)}>일정 취소</button> : <span>취소된 일정입니다</span>}</div> : null}
            </div>
          </div>
        ) : null}
      </header>

      {session.change?.changed ? (
        <details className="today-change-notice schedule-change-notice">
          <summary>
            <span className="today-change-notice__marker" aria-hidden="true">!</span>
            <span><strong>일정이 변경되었어요.</strong><small>{session.change.message}</small></span>
            <span className="today-change-notice__action">변경 내용 보기 <ChevronRight size={15} /></span>
          </summary>
          <div className="today-change-notice__details"><dl><div><dt>변경 내용</dt><dd>{session.change.message}</dd></div><div><dt>변경 사유</dt><dd>{session.change.reason}</dd></div><div><dt>변경자</dt><dd>{changedBy}</dd></div><div><dt>변경 시각</dt><dd>{formatDateTime(session.updatedAt)}</dd></div></dl></div>
        </details>
      ) : null}

      {hasTrackableItems ? <section className="schedule-my-progress" aria-labelledby="schedule-my-progress-title">
        <header><div><h2 id="schedule-my-progress-title">내 진행</h2><p>{myProgress?.completedItems ?? 0} / {myProgress?.requiredItems ?? 0} 완료</p></div></header>
        <ProgressBar value={completionRate} label="내 일정 완료율" />
      </section> : null}

      <div className="schedule-detail-grid">
        <section className="surface today-plan schedule-learning-items" aria-labelledby="schedule-learning-items-title">
          <header className="today-section-head"><div><h2 id="schedule-learning-items-title">항목</h2><p>제출, 체크, 시간 항목 {activeItems.length}개</p></div></header>
          <div className="today-plan-list">
            {activeItems.map((item) => {
              const entry = myFile?.submissions.find((candidate) => candidate.itemId === item.id);
              const kind = item.kind ?? "submission";
              const checked = kind === "check" && Boolean(entry);
              return (
                <article key={item.id}>
                  <span className={`today-plan-status ${entry ? "is-done" : ""}`} aria-hidden="true">{kind === "event" ? <Clock3 size={15} /> : entry ? <Check size={15} /> : <Circle size={15} />}</span>
                  <div>
                    <strong>{item.title}</strong>
                    {item.description ? <small>{item.description}</small> : null}
                    <span className="sr-only">{kind === "event" ? "시간 일정" : entry ? "완료" : "미완료"}{item.required ? "" : ", 선택 항목"}</span>
                    {kind === "event" ? <small>{item.startTime}–{item.endTime}</small> : null}
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer">학습 자료 열기 <ExternalLink size={13} /></a> : null}
                  </div>
                  {session.status !== "cancelled" && kind === "submission" ? <button type="button" className={entry ? "today-row-action today-row-action--edit" : "button button--secondary button--small"} onClick={() => setSubmissionItemId(item.id)}>{entry ? "제출 보기" : "학습하기"}</button> : null}
                  {session.status !== "cancelled" && kind === "check" ? <button type="button" className={checked ? "today-row-action today-row-action--edit" : "button button--secondary button--small"} disabled={checkingItemId === item.id} onClick={() => void updateChecklist(item.id, !checked)}>{checked ? "완료 취소" : "완료 체크"}</button> : null}
                </article>
              );
            })}
          </div>
          {checkError ? <p className="field-error" role="alert">{checkError}</p> : null}
        </section>

        {hasTrackableItems ? <section className="surface today-team schedule-team-progress" aria-labelledby="schedule-team-progress-title">
          <header className="today-section-head today-team__head"><div><h2 id="schedule-team-progress-title">팀 진행 상황</h2><p>{metrics?.completedMembers ?? 0}명 / {metrics?.totalMembers ?? 0}명 완료</p></div></header>
          <div className="today-team__progress"><ProgressBar value={metrics?.submissionRate ?? 0} label="팀 일정 완료율" /></div>
          <div className="today-team-list">
            {members.length ? members.map((progress) => {
              const file = workspace.submissions[getSubmissionKey(session.folder, progress.member.id)];
              const memberStatus = getMemberStatus(progress, currentUserId);
              return <button type="button" key={progress.member.id} disabled={!file} aria-label={`${progress.member.displayName}, ${progress.completedItems}/${progress.requiredItems}, ${memberStatus.label}${file ? ", 제출과 리뷰 보기" : ""}`} onClick={() => requestMember(progress.member)}><Avatar member={progress.member} /><span><strong>{progress.member.displayName}{progress.member.id === currentUserId ? " (나)" : ""}</strong></span><em>{progress.completedItems} / {progress.requiredItems}</em><span className={`status-badge ${memberStatus.tone}`}>{memberStatus.label}</span>{file ? <ChevronRight size={16} /> : <span aria-hidden="true" />}</button>;
            }) : <div className="today-team-empty"><Users size={23} /><strong>팀원이 없습니다</strong></div>}
          </div>
        </section> : null}
      </div>

      {completedSchedule ? <section className="schedule-library-link"><div><strong>학습 결과를 다시 보고 싶나요?</strong><p>완료된 제출 콘텐츠는 학습 라이브러리에서 이어서 탐색할 수 있어요.</p></div><Link href={APP_ROUTES.librarySession(session.date)}>학습 결과 보기 <ArrowRight size={15} /></Link></section> : null}

      <StorageDetails title={getStorageDetailsCopy(workspace.repository?.provider ?? "GITLAB").title} description="원본 파일과 변경 이력">
        <dl className="storage-metadata"><div><dt>파일</dt><dd>{getSessionRepositoryPath(workspace, session)}</dd></div><div><dt>브랜치</dt><dd>{workspace.defaultBranch}</dd></div><div><dt>커밋</dt><dd>{session.lastCommitId}</dd></div><div><dt>revision</dt><dd>{session.revision}</dd></div></dl>
      </StorageDetails>

      {submissionItemId ? <SubmissionDialog workspace={workspace} session={session} currentUserId={currentUserId} initialItemId={submissionItemId} onSubmit={submitItem} onClose={() => setSubmissionItemId(null)} /> : null}
      {selectedMember ? <MemberDetailDialog workspace={workspace} session={session} member={selectedMember} currentUserId={currentUserId} onClose={() => setSelectedMember(null)} /> : null}
      {pendingMember ? <PreSubmissionWarning onClose={() => setPendingMember(null)} onProceed={() => { setSelectedMember(pendingMember); setPendingMember(null); }} onContinueLearning={() => { const next = activeItems.find((item) => !myFile?.submissions.some((entry) => entry.itemId === item.id)); if (next) setSubmissionItemId(next.id); setPendingMember(null); }} /> : null}
      {confirmCancel ? <Modal title="이 일정을 취소할까요?" description="공개된 일정과 제출 기록은 삭제되지 않습니다." onClose={closeCancelConfirmation}><div className="schedule-cancel-dialog"><p>일정은 취소됨 상태로 보존되고 팀원은 더 이상 새 제출을 할 수 없습니다.</p>{cancelError ? <p className="field-error" role="alert">{cancelError}</p> : null}<div className="modal-actions"><button type="button" className="button button--ghost" onClick={closeCancelConfirmation}>돌아가기</button><button type="button" className="button button--danger" disabled={cancelling} onClick={cancelCurrentSession}>{cancelling ? "취소 중…" : "일정 취소"}</button></div></div></Modal> : null}
    </div>
  );
}
