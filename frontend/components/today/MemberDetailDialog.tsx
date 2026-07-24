"use client";

import { ExternalLink } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDateTime } from "@/lib/domain/format";
import { getSubmissionKey } from "@/lib/domain/metrics";
import type { StudyMember, StudySession, Workspace } from "@/lib/domain/types";

export function MemberDetailDialog({
  workspace,
  session,
  member,
  onClose,
}: {
  workspace: Workspace;
  session: StudySession;
  member: StudyMember;
  onClose: () => void;
}) {
  const file = workspace.submissions[getSubmissionKey(session.folder, member.id)];
  const required = session.items.filter(
    (item) => item.required && item.status === "active",
  );
  const done = required.filter((item) =>
    file?.submissions.some((entry) => entry.itemId === item.id),
  ).length;
  const rate = required.length ? Math.round((done / required.length) * 100) : 100;

  return (
    <Modal
      title={`${member.displayName}의 제출`}
      description={`${session.folder}/${member.fileName} · 읽기 전용`}
      onClose={onClose}
    >
      <div className="member-dialog-summary">
        <Avatar member={member} size="large" />
        <div>
          <strong>{done}/{required.length} 완료</strong>
          <ProgressBar value={rate} color={member.color} label={`${member.displayName} 완료율`} />
          <span>마지막 커밋 {file ? formatDateTime(file.updatedAt) : "없음"}</span>
        </div>
      </div>
      <div className="member-submission-list">
        {session.items
          .filter((item) => item.status === "active")
          .map((item, index) => {
            const entry = file?.submissions.find(
              (submission) => submission.itemId === item.id,
            );
            const isLink = entry?.type === "link";
            return (
              <article key={item.id}>
                <span className={`step-number ${entry ? "done" : ""}`}>
                  {index + 1}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  {entry ? (
                    isLink ? (
                      <a href={entry.value} target="_blank" rel="noreferrer">
                        {entry.value} <ExternalLink size={13} />
                      </a>
                    ) : (
                      <p>{entry.value}</p>
                    )
                  ) : (
                    <span className="muted">아직 제출하지 않았습니다.</span>
                  )}
                </div>
                <span className={`status-badge ${entry ? "success" : "neutral"}`}>
                  {entry ? "제출 완료" : "미제출"}
                </span>
              </article>
            );
          })}
      </div>
    </Modal>
  );
}
