"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Users } from "lucide-react";
import { useRepositoryConnection } from "@/lib/api/hooks/useRepositoryConnection";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { StorageDetails } from "@/components/ui/StorageDetails";
import { getStorageDetailsCopy } from "@/lib/domain/storage";
import { MemberDetailDialog } from "@/components/today/MemberDetailDialog";
import { PreSubmissionWarning } from "@/components/review/PreSubmissionWarning";
import { formatDate, getSessionRepositoryPath } from "@/lib/domain/format";
import { getActiveRequiredItems, getMemberProgress, getSubmissionKey } from "@/lib/domain/metrics";
import type { StudyMember } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";

export function LibrarySessionPage({ date }: { date: string }) {
  const { workspace, currentUserId } = useWorkspace();
  const connection = useRepositoryConnection();
  const session = workspace.sessions[date];
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);
  const [pendingMember, setPendingMember] = useState<StudyMember | null>(null);

  if (!session || session.status !== "active") {
    return <div className="page-stack library-route-state" role="alert"><strong>학습 세션을 찾을 수 없어요.</strong><p>라이브러리에서 저장된 세션을 다시 확인해 주세요.</p><Link href={APP_ROUTES.learningLibrary} className="button button--secondary">학습 라이브러리로 돌아가기</Link></div>;
  }

  const activeItems = session.items.filter((item) => item.status === "active" && (item.kind ?? "submission") === "submission");
  const required = getActiveRequiredItems(session);
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const myIncomplete = required.some((item) => !myFile?.submissions.some((entry) => entry.itemId === item.id));
  const members = getMemberProgress(workspace, session);
  const submittedMembers = members.filter((entry) => workspace.submissions[
    getSubmissionKey(session.folder, entry.member.id)
  ]?.submissions.some((submission) => activeItems.some((item) => item.id === submission.itemId)));

  function requestMember(member: StudyMember) {
    const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
    if (!file?.submissions.some((submission) => activeItems.some((item) => item.id === submission.itemId))) return;
    if (member.id !== currentUserId && myIncomplete) setPendingMember(member);
    else setSelectedMember(member);
  }

  return (
    <div className="page-stack library-session-page">
      <header className="library-page-back"><Link href={APP_ROUTES.learningLibrary}><ArrowLeft size={17} /> 학습 세션</Link></header>

      <header className="library-session-header">
        <div>
          <h1>{formatDate(session.date, true)}</h1>
          <p>{activeItems.length}개 제출 항목</p>
        </div>
        <div className="library-session-actions">
          <Link href={APP_ROUTES.scheduleDetail(session.date)} className="button button--secondary">일정 보기</Link>
          {(workspace.repository?.webUrl ?? connection.data?.webUrl) ? <a href={workspace.repository?.webUrl ?? connection.data?.webUrl ?? "#"} target="_blank" rel="noreferrer" className="button button--ghost">{getStorageDetailsCopy(workspace.repository?.provider ?? "GITLAB").originalLabel} <ExternalLink size={15} /></a> : null}
        </div>
      </header>

      <section className="library-archive-section" aria-labelledby="library-learning-items"><header><div><h2 id="library-learning-items">학습 항목</h2></div></header><div className="library-content-items">{activeItems.map((item, index) => (
        <article key={item.id}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div><strong>{item.title}</strong>{item.description ? <p>{item.description}</p> : null}{!item.required ? <span className="sr-only">선택 항목</span> : null}{item.url ? <a href={item.url} target="_blank" rel="noreferrer">학습 자료 열기 <ExternalLink size={13} /></a> : null}</div>
        </article>
      ))}</div></section>

      <section className="library-archive-section" aria-labelledby="library-team-submissions"><header><div><h2 id="library-team-submissions">팀 제출</h2></div><span><Users size={15} /> {submittedMembers.length} / {members.length}명 제출</span></header><div className="library-submission-list">{members.map((entry) => {
        const file = workspace.submissions[getSubmissionKey(session.folder, entry.member.id)];
        const submittedItemCount = activeItems.filter((item) => file?.submissions.some((submission) => submission.itemId === item.id)).length;
        const hasSubmission = submittedItemCount > 0;
        const complete = activeItems.length > 0 && submittedItemCount === activeItems.length;
        return (
          <button type="button" key={entry.member.id} disabled={!hasSubmission} onClick={() => requestMember(entry.member)} aria-label={`${entry.member.displayName}${hasSubmission ? ", 제출 내용과 리뷰 보기" : ", 제출 없음"}`}>
            <Avatar member={entry.member} />
            <span><strong>{entry.member.displayName}{entry.member.id === currentUserId ? " (나)" : ""}</strong></span>
            <em>{submittedItemCount} / {activeItems.length}</em>
            <span className={`status-badge ${complete ? "success" : "neutral"}`}>{complete ? "제출 완료" : hasSubmission ? "일부 제출" : "미제출"}</span>
            {hasSubmission ? <ArrowRight size={17} aria-hidden="true" /> : <span aria-hidden="true" />}
          </button>
        );
      })}</div></section>

      <StorageDetails title={getStorageDetailsCopy(workspace.repository?.provider ?? "GITLAB").title} description="세션 원본 파일과 변경 이력">
        <dl className="storage-metadata"><div><dt>파일</dt><dd>{getSessionRepositoryPath(workspace, session)}</dd></div><div><dt>브랜치</dt><dd>{workspace.defaultBranch}</dd></div><div><dt>커밋</dt><dd>{session.lastCommitId}</dd></div><div><dt>revision</dt><dd>{session.revision}</dd></div></dl>
      </StorageDetails>

      {selectedMember ? <MemberDetailDialog workspace={workspace} session={session} member={selectedMember} currentUserId={currentUserId} onClose={() => setSelectedMember(null)} /> : null}
      {pendingMember ? <PreSubmissionWarning onClose={() => setPendingMember(null)} onProceed={() => { setSelectedMember(pendingMember); setPendingMember(null); }} continueHref={APP_ROUTES.scheduleDetail(session.date)} /> : null}
    </div>
  );
}
