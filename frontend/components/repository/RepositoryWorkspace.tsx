"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  ExternalLink,
  FileText,
  Search,
  Users,
} from "lucide-react";
import { useGitLabConnection } from "@/lib/api/hooks/useGitLabConnection";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MemberDetailDialog } from "@/components/today/MemberDetailDialog";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate, formatDateTime } from "@/lib/domain/format";
import { getActiveRequiredItems, getDashboardMetrics, getMemberProgress, getSubmissionKey } from "@/lib/domain/metrics";
import type { StudyMember, StudySession } from "@/lib/domain/types";
import { TeamDocumentLibrary } from "./TeamDocumentLibrary";

export function RepositoryWorkspace() {
  const { workspace, currentUserId } = useWorkspace();
  const connection = useGitLabConnection();
  const searchParams = useSearchParams();
  const initialDocumentId = searchParams.get("document") ?? undefined;
  const [libraryTab, setLibraryTab] = useState<"sessions" | "documents">(initialDocumentId ? "documents" : "sessions");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const sessions = useMemo(() => Object.values(workspace.sessions)
    .filter((session) => session.status === "active")
    .sort((a, b) => b.date.localeCompare(a.date)), [workspace.sessions]);

  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    if (!normalized) return sessions;
    return sessions.filter((session) => {
      const submissionText = workspace.members.flatMap((member) =>
        workspace.submissions[getSubmissionKey(session.folder, member.id)]?.submissions.map((entry) => entry.value) ?? [],
      );
      return [session.title, session.description, ...session.items.map((item) => item.title), ...submissionText]
        .join(" ")
        .toLocaleLowerCase("ko")
        .includes(normalized);
    });
  }, [query, sessions, workspace]);

  const selected = selectedDate ? workspace.sessions[selectedDate] : undefined;

  if (selected) {
    return <LibrarySessionDocument session={selected} currentUserId={currentUserId} onBack={() => setSelectedDate(null)} projectUrl={connection.data?.project?.webUrl ?? undefined} />;
  }

  return (
    <div className="page-stack library-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LEARNING LIBRARY</p>
          <h1>학습 라이브러리</h1>
          <p>GitLab 파일 경로 대신, 팀이 쌓아온 일정과 제출을 읽기 좋은 학습 자료로 탐색합니다.</p>
        </div>
        {libraryTab === "sessions" && connection.data?.project?.webUrl ? <a className="button button--secondary" href={connection.data.project.webUrl} target="_blank" rel="noreferrer">GitLab 원본 <ExternalLink size={16} /></a> : null}
      </header>

      <nav className="library-tabs" aria-label="학습 라이브러리 분류">
        <button type="button" aria-current={libraryTab === "sessions" ? "page" : undefined} onClick={() => { setLibraryTab("sessions"); setQuery(""); }}><BookOpen size={17} /> 세션 아카이브</button>
        <button type="button" aria-current={libraryTab === "documents" ? "page" : undefined} onClick={() => { setLibraryTab("documents"); setQuery(""); }}><FileText size={17} /> 팀 문서</button>
      </nav>

      <section className="library-toolbar" aria-label="학습 라이브러리 검색">
        <label><Search size={18} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={libraryTab === "sessions" ? "제목, 학습 항목, 제출 내용 검색" : "문서 제목, 본문, 작성자 검색"} /></label>
        <span>{libraryTab === "sessions" ? <><BookOpen size={16} /> 세션 아카이브 <strong>{filteredSessions.length}</strong></> : <><FileText size={16} /> 팀 지식 공간</>}</span>
      </section>

      {libraryTab === "documents" ? <TeamDocumentLibrary query={query} initialDocumentId={initialDocumentId} /> : filteredSessions.length ? (
        <section className="library-session-list" aria-label="세션 아카이브">
          {filteredSessions.map((session) => {
            const meta = SESSION_TYPE_META[session.type];
            const metrics = getDashboardMetrics(workspace, session);
            const activeItems = session.items.filter((item) => item.status === "active");
            const latestSubmission = workspace.members
              .map((member) => workspace.submissions[getSubmissionKey(session.folder, member.id)])
              .filter(Boolean)
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
            return (
              <button key={session.date} type="button" className="library-session-card" onClick={() => setSelectedDate(session.date)}>
                <span className="library-session-date"><strong>{new Date(`${session.date}T00:00:00`).getDate()}</strong><small>{formatDate(session.date, true).split(" ").slice(0, 3).join(" ")}</small></span>
                <span className="library-session-main">
                  <span><em className={`type-chip type-chip--${meta.tone}`}>{meta.short} · {meta.label}</em><small>{activeItems.length}개 학습 항목</small></span>
                  <strong>{session.title}</strong>
                  <p>{session.description}</p>
                  <small>{activeItems.map((item) => item.title).join(" · ")}</small>
                </span>
                <span className="library-session-stats">
                  <span><Users size={15} /> {metrics.completedMembers}/{metrics.totalMembers}명 완료</span>
                  <ProgressBar value={metrics.submissionRate} label={`${session.title} 제출률`} />
                  <small>{latestSubmission ? `최근 업데이트 ${formatDateTime(latestSubmission.updatedAt)}` : "아직 제출 없음"}</small>
                </span>
                <ArrowRight size={19} />
              </button>
            );
          })}
        </section>
      ) : (
        <section className="surface library-empty"><Search size={27} /><strong>검색 결과가 없습니다</strong><p>다른 제목이나 제출 내용으로 다시 검색해 보세요.</p></section>
      )}
    </div>
  );
}

function LibrarySessionDocument({ session, currentUserId, onBack, projectUrl }: { session: StudySession; currentUserId: string; onBack: () => void; projectUrl?: string }) {
  const { workspace } = useWorkspace();
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);
  const [pendingMember, setPendingMember] = useState<StudyMember | null>(null);
  const required = getActiveRequiredItems(session);
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const myIncomplete = required.some((item) => !myFile?.submissions.some((entry) => entry.itemId === item.id));
  const progress = getMemberProgress(workspace, session);
  const meta = SESSION_TYPE_META[session.type];

  function requestMember(member: StudyMember) {
    if (member.id !== currentUserId && myIncomplete) setPendingMember(member);
    else setSelectedMember(member);
  }

  return (
    <div className="page-stack library-document-page">
      <header className="library-document-nav">
        <button type="button" onClick={onBack}><ArrowLeft size={17} /> 세션 아카이브</button>
        {projectUrl ? <a href={projectUrl} target="_blank" rel="noreferrer">GitLab 원본 <ExternalLink size={14} /></a> : null}
      </header>

      <article className="surface library-document">
        <header className="library-document-header">
          <p className="eyebrow">{formatDate(session.date, true)}</p>
          <span className={`type-chip type-chip--${meta.tone}`}>{meta.short} · {meta.label}</span>
          <h1>{session.title}</h1>
          <p>{session.description}</p>
          <div><span><CalendarDays size={15} /> 학습 항목 {session.items.filter((item) => item.status === "active").length}개</span><span><Users size={15} /> 참여 멤버 {progress.length}명</span><span><FileText size={15} /> revision {session.revision}</span></div>
        </header>

        <section className="library-document-section">
          <h2>오늘의 학습 항목</h2>
          <div className="library-item-outline">
            {session.items.filter((item) => item.status === "active").map((item, index) => <div key={item.id}><span>{index + 1}</span><strong>{item.title}</strong><small>{item.source ?? "직접 학습"} · {item.required ? "필수" : "선택"}</small></div>)}
          </div>
        </section>

        <section className="library-document-section">
          <div className="library-document-section__head"><div><h2>팀 제출 모아보기</h2><p>멤버별 제출과 커밋 리뷰를 한 문서처럼 이어서 확인합니다.</p></div></div>
          <div className="library-member-notes">
            {progress.map((entry) => {
              const file = workspace.submissions[getSubmissionKey(session.folder, entry.member.id)];
              return (
                <button type="button" key={entry.member.id} disabled={!file} onClick={() => requestMember(entry.member)}>
                  <Avatar member={entry.member} />
                  <span>
                    <strong>{entry.member.displayName}{entry.member.id === currentUserId ? " (나)" : ""}<em>{entry.completedItems}/{entry.requiredItems}</em></strong>
                    <p>{file?.submissions.map((submission) => submission.value).join(" · ") ?? "아직 제출하지 않았습니다."}</p>
                    <small>{file ? `${formatDateTime(file.updatedAt)} · 제출과 리뷰 열기` : "제출 대기 중"}</small>
                  </span>
                  {file ? <ArrowRight size={17} /> : null}
                </button>
              );
            })}
          </div>
        </section>
      </article>

      {selectedMember ? <MemberDetailDialog workspace={workspace} session={session} member={selectedMember} currentUserId={currentUserId} onClose={() => setSelectedMember(null)} /> : null}
      {pendingMember ? <Modal title="내 제출 전에 팀원의 답을 볼까요?" description="먼저 스스로 풀어본 뒤 비교해서 보는 것을 권장합니다." onClose={() => setPendingMember(null)}><div className="submission-warning-dialog"><p>이 세션에는 아직 제출하지 않은 필수 항목이 있습니다. 열람을 막지는 않으며, 계속하면 {pendingMember.displayName}님의 제출을 볼 수 있습니다.</p><div className="modal-actions"><button type="button" className="button button--secondary" onClick={() => setPendingMember(null)}>돌아가기</button><button type="button" className="button button--primary" onClick={() => { setSelectedMember(pendingMember); setPendingMember(null); }}>그래도 보기</button></div></div></Modal> : null}
    </div>
  );
}
