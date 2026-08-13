"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  Link2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StorageDetails } from "@/components/ui/StorageDetails";
import { getStorageDetailsCopy } from "@/lib/domain/storage";
import { SUBMISSION_TYPE_LABEL } from "@/lib/domain/constants";
import { getSubmissionKey } from "@/lib/domain/metrics";
import { getSubmissionRepositoryPath } from "@/lib/domain/format";
import type {
  SessionItem,
  StudySession,
  SubmissionDraft,
  Workspace,
} from "@/lib/domain/types";
import { getUserFacingError } from "@/lib/api/errors";

const typeIcon = {
  link: Link2,
  text: FileText,
  code: Code2,
  mixed: FileText,
};

function getDefaultCommitMessage(
  updating: boolean,
  memberName: string,
  folder: string,
  itemId: string,
) {
  return `${updating ? "update" : "submit"}: ${memberName} ${folder} ${itemId}`;
}

export function SubmissionDialog({
  workspace,
  session,
  currentUserId,
  initialItemId,
  onSubmit,
  onClose,
}: {
  workspace: Workspace;
  session: StudySession;
  currentUserId: string;
  initialItemId: string;
  onSubmit: (
    date: string,
    itemId: string,
    draft: SubmissionDraft,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const items = session.items.filter((item) => item.status === "active");
  const submissionFile =
    workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
  const me = workspace.members.find((member) => member.id === currentUserId)!;
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0];
  const existing = submissionFile?.submissions.find(
    (submission) => submission.itemId === selectedItem.id,
  );
  const [value, setValue] = useState(existing?.value ?? "");
  const [language, setLanguage] = useState(existing?.language ?? "typescript");
  const [commitMessage, setCommitMessage] = useState(
    getDefaultCommitMessage(
      Boolean(existing),
      me.displayName,
      session.folder,
      selectedItem.id,
    ),
  );
  const [error, setError] = useState("");
  const [commitMessageError, setCommitMessageError] = useState("");
  const [saving, setSaving] = useState(false);

  const completedItemIds = useMemo(
    () => new Set(submissionFile?.submissions.map((submission) => submission.itemId)),
    [submissionFile],
  );

  function selectItem(item: SessionItem) {
    const next = submissionFile?.submissions.find(
      (submission) => submission.itemId === item.id,
    );
    setSelectedItemId(item.id);
    setValue(next?.value ?? "");
    setLanguage(next?.language ?? "typescript");
    setCommitMessage(
      getDefaultCommitMessage(
        Boolean(next),
        me.displayName,
        session.folder,
        item.id,
      ),
    );
    setError("");
    setCommitMessageError("");
  }

  function validate() {
    const trimmed = value.trim();
    if (!trimmed) return "제출 내용을 입력해 주세요.";
    if (
      selectedItem.submitType === "link" &&
      !/^https?:\/\/[^\s]+$/i.test(trimmed)
    ) {
      return "http:// 또는 https://로 시작하는 주소를 입력해 주세요.";
    }
    return "";
  }

  async function submit() {
    const message = validate();
    const nextCommitMessageError = commitMessage.trim()
      ? ""
      : "커밋 메시지를 입력해 주세요.";
    setError(message);
    setCommitMessageError(nextCommitMessageError);
    if (message || nextCommitMessageError) {
      return;
    }
    setSaving(true);
    try {
      await onSubmit(session.date, selectedItem.id, {
        type: selectedItem.submitType,
        value: selectedItem.submitType === "code" ? value : value.trim(),
        language:
          selectedItem.submitType === "code" ? language : undefined,
        commitMessage: commitMessage.trim(),
      });
      const next = items.find(
        (item) =>
          item.id !== selectedItem.id && !completedItemIds.has(item.id),
      );
      if (next) selectItem(next);
      else onClose();
    } catch (submissionError) {
      setError(getUserFacingError(submissionError, "제출에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  const TypeIcon = typeIcon[selectedItem.submitType];

  return (
    <Modal
      title="학습 항목 제출"
      description="제출 내용을 저장하면 팀 진행 상황에 바로 반영됩니다."
      onClose={onClose}
      size="large"
    >
      <div className="submission-layout">
        <aside className="submission-items" aria-label="제출 항목">
          {items.map((item, index) => {
            const done = completedItemIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={item.id === selectedItem.id ? "active" : undefined}
                onClick={() => selectItem(item)}
              >
                <span className={`step-number ${done ? "done" : ""}`}>
                  {done ? <Check size={14} /> : index + 1}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{done ? "제출 완료" : "미제출"}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            );
          })}
        </aside>

        <div className="submission-mobile-selector">
          <span>항목 {items.findIndex((item) => item.id === selectedItem.id) + 1} / {items.length}</span>
          <label className="field">
            <span>제출할 학습 항목</span>
            <select
              value={selectedItem.id}
              onChange={(event) => {
                const item = items.find((candidate) => candidate.id === event.target.value);
                if (item) selectItem(item);
              }}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {completedItemIds.has(item.id) ? "완료 · " : "미제출 · "}{item.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="submission-form">
          <div className="submission-title-row">
            <span className="type-symbol">
              <TypeIcon size={18} />
            </span>
            <div>
              <h3>{selectedItem.title}</h3>
              <p>제출 방식 · {SUBMISSION_TYPE_LABEL[selectedItem.submitType]}</p>
            </div>
            {selectedItem.url ? (
              <a href={selectedItem.url} target="_blank" rel="noreferrer">
                문제 보기 <ExternalLink size={14} />
              </a>
            ) : null}
          </div>

          {selectedItem.submitType === "code" ? (
            <label className="field">
              <span>언어</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
            </label>
          ) : null}

          <label
            className={`field${selectedItem.submitType === "link" ? "" : " field--grow"}`}
          >
            <span>
              {selectedItem.submitType === "link"
                ? "제출 링크"
                : selectedItem.submitType === "code"
                  ? "코드"
                  : selectedItem.submitType === "mixed"
                    ? "Markdown 내용"
                    : "제출 내용"}
            </span>
            {selectedItem.submitType === "link" ? (
              <input
                type="url"
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError("");
                }}
                placeholder="https://blog.example.com/my-study"
                aria-invalid={Boolean(error)}
              />
            ) : (
              <textarea
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError("");
                }}
                placeholder={
                  selectedItem.submitType === "mixed"
                    ? "## 요약\n\n핵심 내용과 참고 링크를 Markdown으로 작성하세요."
                    : "학습한 내용을 입력하세요."
                }
                aria-invalid={Boolean(error)}
              />
            )}
          </label>
          {error ? <p className="field-error" role="alert">{error}</p> : null}

          <StorageDetails
            title={getStorageDetailsCopy(workspace.repository?.provider ?? "GITLAB").title}
            description="파일 위치와 저장 메시지"
          >
              <label className="field">
                <span>저장 메시지</span>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(event) => {
                    setCommitMessage(event.target.value);
                    setCommitMessageError("");
                  }}
                  placeholder="submit: member-a 260723 item-b712dd"
                  aria-invalid={Boolean(commitMessageError)}
                />
                <small className="field-hint">
                  기본 규칙을 그대로 사용하거나 알아보기 쉽게 수정할 수 있습니다.
                </small>
              </label>
              {commitMessageError ? (
                <p className="field-error" role="alert">{commitMessageError}</p>
              ) : null}

              <section className="commit-preview">
                <div>
                  <strong>저장 위치 미리보기</strong>
                </div>
                <dl>
                  <div>
                    <dt>파일</dt>
                    <dd>{getSubmissionRepositoryPath(workspace, session, me.fileName)}</dd>
                  </div>
                  <div>
                    <dt>작성자</dt>
                    <dd>{me.displayName}</dd>
                  </div>
                  <div>
                    <dt>메시지</dt>
                    <dd>{commitMessage || "저장 메시지를 입력해 주세요."}</dd>
                  </div>
                </dl>
              </section>
          </StorageDetails>

          <div className="modal-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={submit}
              disabled={saving}
            >
              {saving ? "저장 중…" : "제출하기"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
