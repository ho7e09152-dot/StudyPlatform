"use client";

import { ExternalLink } from "lucide-react";
import { SubmissionReviewPanel } from "@/components/review/SubmissionReviewPanel";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { StorageDetails } from "@/components/ui/StorageDetails";
import { formatDateTime, getSubmissionRepositoryPath } from "@/lib/domain/format";
import { getSubmissionKey } from "@/lib/domain/metrics";
import type { StudyMember, StudySession, Workspace } from "@/lib/domain/types";

export function MemberDetailDialog({
  workspace,
  session,
  member,
  currentUserId,
  onClose,
}: {
  workspace: Workspace;
  session: StudySession;
  member: StudyMember;
  currentUserId: string;
  onClose: () => void;
}) {
  const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
  const required = session.items.filter(
    (item) => item.required && item.status === "active",
  );
  const done = required.filter((item) =>
    file?.submissions.some((entry) => entry.itemId === item.id),
  ).length;
  return (
    <Modal
      title={`${member.displayName}의 제출`}
      description={file ? `${formatDateTime(file.updatedAt)} 제출` : "아직 제출한 학습 항목이 없습니다."}
      onClose={onClose}
      size="large"
    >
      <div className="member-detail-content">
        <div className="member-dialog-meta" aria-label={`${done} / ${required.length}개 항목 완료`}>
          <Avatar member={member} size="large" />
          <div>
            <strong>{member.displayName}</strong>
            <span>{done} / {required.length}개 항목 완료</span>
          </div>
        </div>

        <div className="member-submission-list" aria-label={`${member.displayName}의 학습 제출 내용`}>
          {session.items
            .filter((item) => item.status === "active")
            .map((item) => {
              const entry = file?.submissions.find(
                (submission) => submission.itemId === item.id,
              );
              const isLink = entry?.type === "link";
              return (
                <article key={item.id}>
                  <header>
                    <h3>{item.title}</h3>
                    <span className={`status-badge member-item-status ${entry ? "success" : "neutral"}`}>
                      {entry ? "완료" : "미제출"}
                    </span>
                  </header>
                  {entry ? (
                    isLink ? (
                      <a href={entry.value} target="_blank" rel="noreferrer">
                        {entry.value} <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : entry.type === "code" ? (
                      <pre className="member-submission-code"><code>{entry.value}</code></pre>
                    ) : (
                      <p>{entry.value}</p>
                    )
                  ) : (
                    <span className="muted">아직 제출하지 않았습니다.</span>
                  )}
                </article>
              );
            })}
        </div>

        {file ? (
          <div className="member-storage-details">
            <StorageDetails
              title="저장소 원본 정보"
              description="GitLab의 원본 파일과 커밋"
            >
              <dl className="storage-metadata">
                <div>
                  <dt>파일</dt>
                  <dd>{getSubmissionRepositoryPath(workspace, session, member.fileName)}</dd>
                </div>
                <div>
                  <dt>커밋</dt>
                  <dd>{file.lastCommitId}</dd>
                </div>
              </dl>
            </StorageDetails>
          </div>
        ) : null}

        {file ? (
          <SubmissionReviewPanel
            key={member.id}
            workspaceId={workspace.id}
            date={session.date}
            memberId={member.id}
            currentGitLabUserId={workspace.members.find((candidate) => candidate.id === currentUserId)?.gitlabUserId ?? 0}
            currentUserName={workspace.members.find((candidate) => candidate.id === currentUserId)?.displayName ?? "나"}
            memberName={member.displayName}
            filePath={getSubmissionRepositoryPath(workspace, session, member.fileName)}
            commitId={file.lastCommitId}
          />
        ) : null}
      </div>
    </Modal>
  );
}
