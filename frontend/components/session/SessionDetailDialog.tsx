"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import {
  Code2,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  FileCode2,
  Link2,
  Send,
  TextQuote,
  MessageCircle,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Avatar } from "@/components/ui/Avatar";
import { MemberDetailDialog } from "@/components/today/MemberDetailDialog";
import {
  SESSION_TYPE_META,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/domain/constants";
import { formatDate, formatDateTime, formatTime, getSessionRepositoryPath } from "@/lib/domain/format";
import { getSubmissionKey } from "@/lib/domain/metrics";
import type {
  StudySession,
  SubmissionEntry,
  Workspace,
  StudyMember,
} from "@/lib/domain/types";

function MarkdownLink({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const external = href?.startsWith("http://") || href?.startsWith("https://");
  return (
    <a
      {...props}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {children}
    </a>
  );
}

const markdownComponents: Components = { a: MarkdownLink };

function linkHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "외부 링크";
  }
}

function SubmissionContent({ entry }: { entry: SubmissionEntry }) {
  if (entry.type === "code") {
    return (
      <div className="session-detail__code-block">
        <div className="session-detail__code-caption">
          <span>{entry.language ?? "code"}</span>
          <span>Code</span>
        </div>
        <pre className="session-detail__code">
          <code data-language={entry.language}>{entry.value}</code>
        </pre>
      </div>
    );
  }
  if (entry.type === "link") {
    return (
      <a
        className="session-detail__link"
        href={entry.value}
        target="_blank"
        rel="noreferrer"
      >
        <span className="session-detail__link-icon"><Link2 size={17} /></span>
        <span className="session-detail__link-copy">
          <strong>{linkHostname(entry.value)}</strong>
          <small>{entry.value}</small>
        </span>
        <ExternalLink size={14} />
      </a>
    );
  }
  if (entry.type === "mixed") {
    return (
      <div className="session-detail__markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {entry.value}
        </ReactMarkdown>
      </div>
    );
  }
  return <p className="session-detail__text">{entry.value}</p>;
}

export function SessionDetailDialog({
  workspace,
  session,
  currentUserId,
  onOpenSubmission,
  onClose,
}: {
  workspace: Workspace;
  session: StudySession;
  currentUserId: string;
  onOpenSubmission?: (itemId: string) => void;
  onClose: () => void;
}) {
  const meta = SESSION_TYPE_META[session.type];
  const activeItems = session.items.filter((item) => item.status === "active");
  const requiredItems = activeItems.filter((item) => item.required);
  const file = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const entries = new Map(file?.submissions.map((entry) => [entry.itemId, entry]));
  const completedRequired = requiredItems.filter((item) => entries.has(item.id)).length;
  const completionRate = requiredItems.length
    ? Math.round((completedRequired / requiredItems.length) * 100)
    : 100;
  const [reviewMember, setReviewMember] = useState<StudyMember | null>(null);

  return (
    <>
    <Modal
      title={session.title}
      description={`${formatDate(session.date, true)} · 내 학습 및 제출 상세`}
      onClose={onClose}
      size="large"
    >
      <div className="session-detail">
        <section className="session-detail__summary" aria-label="일정 요약">
          <div className="session-detail__summary-copy">
            <div className="session-detail__chips">
              <span className={`type-chip type-chip--${meta.tone}`}>
                {meta.short} · {meta.label}
              </span>
              <span className={`status-badge ${session.status === "cancelled" ? "neutral" : "success"}`}>
                {session.status === "cancelled" ? "취소된 일정" : "진행 일정"}
              </span>
            </div>
            <p>{session.description || "등록된 일정 설명이 없습니다."}</p>
            <div className="session-detail__meta">
              <span><CalendarDays size={14} /> 학습 항목 {activeItems.length}개</span>
              <span><Clock3 size={14} /> 1차 {formatTime(session.deadline)}</span>
              {session.secondaryDeadline ? (
                <span><Clock3 size={14} /> 2차 {formatTime(session.secondaryDeadline)}</span>
              ) : null}
              <span><FileCode2 size={14} /> {getSessionRepositoryPath(workspace, session)}</span>
            </div>
          </div>
          <div className="session-detail__progress">
            <div>
              <span>내 필수 항목</span>
              <strong>{completedRequired}<small>/{requiredItems.length}</small></strong>
            </div>
            <ProgressBar value={completionRate} label="내 필수 항목 완료율" />
            <p>{completionRate === 100 ? "필수 학습 완료" : `${requiredItems.length - completedRequired}개 남음`}</p>
          </div>
        </section>

        {session.change?.changed ? (
          <div className="session-detail__change">
            <strong>revision {session.revision}에서 변경됨</strong>
            <span>{session.change.message} · {session.change.reason}</span>
          </div>
        ) : null}

        <section className="session-detail__items" aria-label="학습 항목과 내 제출">
          {activeItems.map((item, index) => {
            const entry = entries.get(item.id);
            const SubmissionIcon = entry?.type === "code"
              ? Code2
              : entry?.type === "link"
                ? Link2
                : TextQuote;
            return (
              <article key={item.id} className="session-detail__item">
                <header>
                  <span className={`step-number ${entry ? "done" : ""}`}>
                    {entry ? <Check size={15} /> : index + 1}
                  </span>
                  <div>
                    <div className="session-detail__item-title">
                      <h3>{item.title}</h3>
                      <span className={`status-badge ${entry ? "success" : "neutral"}`}>
                        {entry ? "제출 완료" : "미제출"}
                      </span>
                    </div>
                    <p>
                      {item.source ?? "직접 학습"} · {SUBMISSION_TYPE_LABEL[item.submitType]}
                      {item.required ? " · 필수" : " · 선택"}
                    </p>
                  </div>
                  <div className="session-detail__item-actions">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        자료 보기 <ExternalLink size={13} />
                      </a>
                    ) : null}
                    {onOpenSubmission && session.status !== "cancelled" ? (
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        onClick={() => onOpenSubmission(item.id)}
                      >
                        <Send size={14} /> {entry ? "제출 수정" : "제출하기"}
                      </button>
                    ) : null}
                  </div>
                </header>
                {entry ? (
                  <div className="session-detail__submission">
                    <div className="session-detail__submission-heading">
                      <div className="session-detail__submission-title">
                        <span className="session-detail__submission-icon">
                          <SubmissionIcon size={15} />
                        </span>
                        <div>
                          <strong>내가 제출한 내용</strong>
                          <span>{formatDateTime(entry.updatedAt)}에 마지막으로 수정</span>
                        </div>
                      </div>
                      <span className="session-detail__submission-property">
                        {entry.language ?? SUBMISSION_TYPE_LABEL[entry.type]}
                      </span>
                    </div>
                    <SubmissionContent entry={entry} />
                  </div>
                ) : (
                  <div className="session-detail__empty-submission">
                    아직 이 항목에 제출한 내용이 없습니다.
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section className="session-detail__team-review" aria-labelledby="session-team-review-title">
          <header>
            <div>
              <span className="session-detail__review-icon"><MessageCircle size={17} /></span>
              <div><h3 id="session-team-review-title">팀 제출 리뷰</h3><p>멤버의 제출을 확인하고 저장소 커밋에 댓글을 남길 수 있습니다.</p></div>
            </div>
          </header>
          <div className="session-detail__review-members">
            {workspace.members.map((member) => {
              const submission = workspace.submissions[getSubmissionKey(session.folder, member.id)];
              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={!submission}
                  onClick={() => setReviewMember(member)}
                >
                  <Avatar member={member} />
                  <span>
                    <strong>{member.displayName}{member.id === currentUserId ? " (나)" : ""}</strong>
                    <small>{submission ? `${submission.submissions.length}개 항목 제출` : "아직 제출 없음"}</small>
                  </span>
                  <em>{submission ? "리뷰 보기" : "대기"}</em>
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </Modal>
    {reviewMember ? (
      <MemberDetailDialog
        workspace={workspace}
        session={session}
        member={reviewMember}
        currentUserId={currentUserId}
        onClose={() => setReviewMember(null)}
      />
    ) : null}
    </>
  );
}
