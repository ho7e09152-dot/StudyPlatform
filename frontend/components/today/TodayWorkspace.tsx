"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  MessageCircle,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { TeamFeed } from "@/components/feed/TeamFeed";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MemberDetailDialog } from "./MemberDetailDialog";
import { SubmissionDialog } from "./SubmissionDialog";
import { SESSION_TYPE_META, SUBMISSION_TYPE_LABEL } from "@/lib/domain/constants";
import { formatDate, formatDateTime, formatTime } from "@/lib/domain/format";
import {
  getActiveRequiredItems,
  getDashboardMetrics,
  getMemberProgress,
  getSubmissionKey,
} from "@/lib/domain/metrics";
import type { MemberSubmissionFile, StudyMember, StudySession } from "@/lib/domain/types";

export function TodayWorkspace() {
  const { workspace, referenceDate } = useWorkspace();
  const session = workspace.sessions[referenceDate];

  if (!session) {
    return (
      <div className="page-stack">
        <header className="page-heading page-heading--today">
          <div><p className="eyebrow">{formatDate(referenceDate, true)} · TODAY</p><h1>오늘 함께 공부하기</h1><p>내 학습과 팀의 흐름을 한곳에서 확인합니다.</p></div>
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

function TodaySession({ session }: { session: StudySession }) {
  const { workspace, currentUserId, referenceDate, submitItem } = useWorkspace();
  const [submissionItemId, setSubmissionItemId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<StudyMember | null>(null);
  const [pendingMember, setPendingMember] = useState<StudyMember | null>(null);

  const requiredItems = useMemo(() => getActiveRequiredItems(session), [session]);
  const metrics = useMemo(() => getDashboardMetrics(workspace, session), [session, workspace]);
  const members = useMemo(() => getMemberProgress(workspace, session), [session, workspace]);
  const myProgress = members.find((progress) => progress.member.id === currentUserId)!;
  const myFile = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const nextItem = requiredItems.find((item) => !myFile?.submissions.some((entry) => entry.itemId === item.id));
  const meta = SESSION_TYPE_META[session.type];

  const submittedMembers = members
    .map((progress) => ({
      progress,
      file: workspace.submissions[getSubmissionKey(session.folder, progress.member.id)],
    }))
    .filter((entry): entry is { progress: typeof members[number]; file: MemberSubmissionFile } => Boolean(entry.file))
    .sort((a, b) => b.file.updatedAt.localeCompare(a.file.updatedAt));

  const recommended = submittedMembers.find((entry) => entry.progress.member.id !== currentUserId);
  const missedSessions = Object.values(workspace.sessions)
    .filter((candidate) => candidate.status === "active" && candidate.date < referenceDate)
    .map((candidate) => {
      const required = getActiveRequiredItems(candidate);
      const file = workspace.submissions[getSubmissionKey(candidate.folder, currentUserId)];
      const missing = required.filter((item) => !file?.submissions.some((entry) => entry.itemId === item.id));
      return { session: candidate, missing };
    })
    .filter((entry) => entry.missing.length)
    .sort((a, b) => b.session.date.localeCompare(a.session.date));

  function requestMember(member: StudyMember) {
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
          <p className="eyebrow">{formatDate(session.date, true)} · TOGETHER</p>
          <h1>오늘 함께 공부하기</h1>
          <p>내 할 일을 끝내고, 팀원의 풀이와 리뷰에서 한 번 더 배워보세요.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setSubmissionItemId(nextItem?.id ?? requiredItems[0]?.id)}>
          <Send size={17} /> {nextItem ? "이어서 제출하기" : "내 제출 확인"}
        </button>
      </header>

      <section className="today-focus" aria-labelledby="today-focus-title">
        <div className="today-focus__icon"><Sparkles size={22} /></div>
        <div>
          <span>지금 가장 먼저 할 일</span>
          <h2 id="today-focus-title">{nextItem?.title ?? "오늘 필수 학습을 모두 마쳤어요"}</h2>
          <p>{nextItem ? `${SUBMISSION_TYPE_LABEL[nextItem.submitType]} 제출 · ${formatTime(session.deadline)} 마감` : "팀원의 제출을 읽고 짧은 리뷰를 남겨보세요."}</p>
        </div>
        <div className="today-focus__progress">
          <strong>{myProgress.completedItems}/{myProgress.requiredItems}</strong>
          <ProgressBar value={myProgress.completionRate} label="내 오늘 학습 완료율" />
        </div>
        <button type="button" className="button button--secondary" onClick={() => nextItem ? setSubmissionItemId(nextItem.id) : recommended && requestMember(recommended.progress.member)}>
          {nextItem ? "학습 시작" : "팀 제출 보기"}<ArrowRight size={16} />
        </button>
      </section>

      {session.change?.changed ? (
        <section className="today-change-inline">
          <strong>revision {session.revision}에서 변경됨</strong><span>{session.change.message}</span><small>{session.change.reason}</small>
        </section>
      ) : null}

      <div className="today-collab-grid">
        <section className="surface today-plan" aria-labelledby="today-plan-title">
          <header className="today-section-head">
            <div><span className={`type-chip type-chip--${meta.tone}`}>{meta.short} · {meta.label}</span><h2 id="today-plan-title">{session.title}</h2><p>{session.description}</p></div>
            <span><Clock3 size={15} /> {formatTime(session.deadline)} 마감</span>
          </header>
          <div className="today-plan-list">
            {session.items.filter((item) => item.status === "active").map((item, index) => {
              const submitted = myFile?.submissions.some((entry) => entry.itemId === item.id);
              return (
                <article key={item.id}>
                  <span className={`step-number ${submitted ? "done" : ""}`}>{submitted ? <Check size={15} /> : index + 1}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.source ?? "직접 학습"} · {SUBMISSION_TYPE_LABEL[item.submitType]}{!item.required ? " · 선택" : ""}</p>
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer">학습 자료 열기 <ExternalLink size={13} /></a> : null}
                  </div>
                  <button type="button" className={submitted ? "button button--secondary button--small" : "button button--primary button--small"} onClick={() => setSubmissionItemId(item.id)}>{submitted ? "수정" : "제출"}</button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="surface today-team" aria-labelledby="today-team-title">
          <header className="today-section-head">
            <div><p className="eyebrow">TEAM ACTIVITY</p><h2 id="today-team-title">오늘의 팀 제출</h2><p>{metrics.submittedItems}/{metrics.totalRequiredSubmissions}건 제출 · {metrics.completedMembers}/{metrics.totalMembers}명 완료</p></div>
            <Users size={20} />
          </header>
          <div className="today-team-list">
            {submittedMembers.length ? submittedMembers.map(({ progress, file }) => {
              const preview = file.submissions.at(-1)?.value ?? "제출 내용을 확인해 보세요.";
              return (
                <button type="button" key={progress.member.id} onClick={() => requestMember(progress.member)}>
                  <Avatar member={progress.member} />
                  <span>
                    <strong>{progress.member.displayName}{progress.member.id === currentUserId ? " (나)" : ""}<em>{progress.completedItems}/{progress.requiredItems}</em></strong>
                    <p>{preview}</p>
                    <small>{formatDateTime(file.updatedAt)} · 제출과 리뷰 보기</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              );
            }) : <div className="today-team-empty"><Users size={23} /><strong>아직 팀 제출이 없습니다</strong><p>첫 제출이 올라오면 여기에서 함께 확인할 수 있어요.</p></div>}
          </div>
        </section>
      </div>

      <TeamFeed date={session.date} />

      <div className="today-followup-grid">
        <section className="surface today-review-recommendation">
          <span className="today-followup-icon"><MessageCircle size={19} /></span>
          <div>
            <p className="eyebrow">RECOMMENDED REVIEW</p>
            <h2>{recommended ? `${recommended.progress.member.displayName}님의 제출을 읽어볼까요?` : "팀원의 첫 제출을 기다리고 있어요"}</h2>
            <p>{recommended ? "풀이를 비교하고 도움이 되는 점이나 질문을 댓글로 남겨보세요." : "제출이 올라오면 바로 리뷰할 항목을 추천해 드립니다."}</p>
          </div>
          {recommended ? <button type="button" className="button button--secondary" onClick={() => requestMember(recommended.progress.member)}>리뷰 열기 <ArrowRight size={16} /></button> : null}
        </section>

        <section className="surface today-missed-summary">
          <span><CalendarDays size={18} /></span>
          <div><strong>{missedSessions.length ? `놓친 일정 ${missedSessions.length}일` : "밀린 학습 없음"}</strong><p>{missedSessions.length ? `가장 최근: ${missedSessions[0].session.title} · ${missedSessions[0].missing.length}개 남음` : "이전 필수 학습을 모두 제출했습니다."}</p></div>
          <Link href="/schedule">확인하기 <ArrowRight size={15} /></Link>
        </section>
      </div>

      {submissionItemId ? <SubmissionDialog workspace={workspace} session={session} currentUserId={currentUserId} initialItemId={submissionItemId} onSubmit={submitItem} onClose={() => setSubmissionItemId(null)} /> : null}
      {selectedMember ? <MemberDetailDialog workspace={workspace} session={session} member={selectedMember} currentUserId={currentUserId} onClose={() => setSelectedMember(null)} /> : null}
      {pendingMember ? (
        <Modal title="내 학습을 마치기 전에 볼까요?" description="다른 사람의 답을 먼저 보면 내 풀이 과정에 영향을 받을 수 있습니다." onClose={() => setPendingMember(null)}>
          <div className="submission-warning-dialog">
            <p><strong>{nextItem?.title}</strong> 항목이 아직 미제출 상태입니다. 제출 후 비교해서 보는 것을 권장하지만, 지금 열어보아도 괜찮습니다.</p>
            <div className="modal-actions">
              <button type="button" className="button button--secondary" onClick={() => setPendingMember(null)}>내 학습으로 돌아가기</button>
              <button type="button" className="button button--primary" onClick={() => { setSelectedMember(pendingMember); setPendingMember(null); }}>그래도 보기</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
