"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  GitCommitHorizontal,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import {
  SESSION_TYPE_META,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/domain/constants";
import { formatDate, newStableItemId } from "@/lib/domain/format";
import { getMemberProgress } from "@/lib/domain/metrics";
import type {
  SessionDraft,
  SessionItem,
  StudySession,
  Workspace,
} from "@/lib/domain/types";

function emptyItem(): SessionItem {
  return {
    id: newStableItemId(),
    order: 1,
    title: "",
    submitType: "link",
    required: true,
    status: "active",
  };
}

function nextDayDeadline(deadline: string) {
  if (!deadline) return "";
  const date = new Date(`${deadline.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.toISOString().slice(0, 10)}T23:59`;
}

function withTimezone(deadline: string) {
  return deadline.includes("+") ? deadline : `${deadline}:00+09:00`;
}

function makeDraft(session?: StudySession): SessionDraft {
  if (session) {
    return {
      date: session.date,
      type: session.type,
      title: session.title,
      description: session.description,
      deadline: session.deadline.slice(0, 16),
      secondaryDeadline: session.secondaryDeadline?.slice(0, 16),
      changeReason: "",
      items: session.items
        .filter((item) => item.status === "active")
        .map((item) => ({ ...item })),
    };
  }
  return {
    date: "2026-07-25",
    type: "algorithm",
    title: "",
    description: "",
    deadline: "2026-07-25T23:59",
    secondaryDeadline: undefined,
    changeReason: "",
    items: [emptyItem()],
  };
}

export function SessionEditorDialog({
  workspace,
  session,
  onSave,
  onClose,
}: {
  workspace: Workspace;
  session?: StudySession;
  onSave: (draft: SessionDraft, expectedRevision?: number) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => makeDraft(session));
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(draft.items[0]?.id ? [draft.items[0].id] : []),
  );
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [error, setError] = useState("");
  const submissionCount = useMemo(
    () =>
      session
        ? getMemberProgress(workspace, session).filter(
            (progress) => progress.completedItems > 0,
          ).length
        : 0,
    [session, workspace],
  );

  function patchDraft(patch: Partial<SessionDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  }

  function patchItem(itemId: string, patch: Partial<SessionItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }));
    setError("");
  }

  function addItem() {
    const item = { ...emptyItem(), order: draft.items.length + 1 };
    setDraft((current) => ({ ...current, items: [...current.items, item] }));
    setExpandedItemIds((current) => new Set(current).add(item.id));
    setError("");
  }

  function removeItem(itemId: string) {
    const remaining = draft.items
      .filter((item) => item.id !== itemId)
      .map((item, index) => ({ ...item, order: index + 1 }));
    setDraft((current) => ({ ...current, items: remaining }));
    setExpandedItemIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    setError("");
  }

  async function save() {
    setShowValidation(true);
    if (
      !draft.date ||
      !draft.deadline ||
      !draft.title.trim() ||
      !draft.description.trim()
    ) {
      setError("날짜, 마감, 제목, 설명을 모두 입력해 주세요.");
      return;
    }
    if (!draft.items.length || draft.items.some((item) => !item.title.trim())) {
      setError("학습 항목을 한 개 이상 추가하고 제목을 입력해 주세요.");
      const invalidItem = draft.items.find((item) => !item.title.trim());
      const invalidItemId = invalidItem?.id ?? draft.items[0]?.id;
      if (invalidItemId) {
        setExpandedItemIds((current) => new Set(current).add(invalidItemId));
      }
      return;
    }
    if (
      draft.secondaryDeadline &&
      draft.secondaryDeadline <= draft.deadline
    ) {
      setError("2차 마감일은 1차 마감일보다 늦게 설정해 주세요.");
      return;
    }
    if (session && submissionCount > 0 && !draft.changeReason.trim()) {
      setError("이미 제출이 있으므로 변경 사유를 입력해야 합니다.");
      return;
    }
    setSaving(true);
    try {
      await onSave(
        {
          ...draft,
          deadline: withTimezone(draft.deadline),
          secondaryDeadline: draft.secondaryDeadline
            ? withTimezone(draft.secondaryDeadline)
            : undefined,
        },
        session?.revision,
      );
      onClose();
    } catch (saveError) {
      const code = saveError instanceof Error ? saveError.message : "UNKNOWN";
      setError(
        code === "SESSION_REVISION_CONFLICT"
          ? "다른 사용자가 일정을 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요."
          : code === "CHANGE_REASON_REQUIRED"
            ? "기존 제출이 있는 일정은 변경 사유가 필요합니다."
            : "일정을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={session ? "일정 편집" : "새 일정 만들기"}
      description={
        session
          ? `${formatDate(session.date, true)} · revision ${session.revision}`
          : "새 학습 일정과 제출 항목을 구성합니다."
      }
      onClose={onClose}
      size="editor"
    >
      <div className="session-editor session-editor--simple">
        <div className="session-editor__content">
          <div className="session-editor__form">
            {submissionCount > 0 ? (
              <div className="inline-warning">
                <AlertTriangle size={17} />
                <span>
                  <strong>기존 제출 {submissionCount}건</strong>
                  항목을 제거해도 제출 기록은 안전하게 보관됩니다.
                </span>
              </div>
            ) : null}

            <section className="editor-section" aria-labelledby="basic-section-title">
              <header className="editor-section__heading">
                <span><CalendarDays size={16} /></span>
                <div>
                  <strong id="basic-section-title">기본 정보</strong>
                  <small>날짜, 유형, 제목과 마감을 설정하세요.</small>
                </div>
              </header>

              <div className="form-grid">
                <label className="field">
                  <span>날짜</span>
                  <input
                    type="date"
                    value={draft.date}
                    disabled={Boolean(session)}
                    aria-invalid={showValidation && !draft.date}
                    onChange={(event) => patchDraft({ date: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>마감</span>
                  <input
                    type="datetime-local"
                    value={draft.deadline.slice(0, 16)}
                    aria-invalid={showValidation && !draft.deadline}
                    onChange={(event) => patchDraft({ deadline: event.target.value })}
                  />
                </label>
              </div>

              <div className="secondary-deadline">
                <label className="secondary-deadline__toggle">
                  <span>
                    <strong>2차 마감일</strong>
                    <small>필요한 경우 추가 마감 시간을 설정합니다.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(draft.secondaryDeadline)}
                    onChange={(event) =>
                      patchDraft({
                        secondaryDeadline: event.target.checked
                          ? nextDayDeadline(draft.deadline)
                          : undefined,
                      })
                    }
                  />
                  <i aria-hidden="true" />
                </label>
                {draft.secondaryDeadline ? (
                  <label className="field secondary-deadline__field">
                    <span>2차 마감</span>
                    <input
                      type="datetime-local"
                      value={draft.secondaryDeadline.slice(0, 16)}
                      aria-invalid={
                        showValidation &&
                        draft.secondaryDeadline <= draft.deadline
                      }
                      onChange={(event) =>
                        patchDraft({ secondaryDeadline: event.target.value })
                      }
                    />
                  </label>
                ) : null}
              </div>

              <fieldset className="type-options">
                <legend>학습 유형</legend>
                {Object.entries(SESSION_TYPE_META).map(([type, meta]) => (
                  <label key={type}>
                    <input
                      type="radio"
                      name="sessionType"
                      value={type}
                      checked={draft.type === type}
                      onChange={() =>
                        patchDraft({ type: type as SessionDraft["type"] })
                      }
                    />
                    <span>
                      <strong>{meta.short}</strong>
                      <small>{meta.label}</small>
                    </span>
                  </label>
                ))}
              </fieldset>

              <label className="field">
                <span>일정 제목</span>
                <input
                  value={draft.title}
                  aria-invalid={showValidation && !draft.title.trim()}
                  onChange={(event) => patchDraft({ title: event.target.value })}
                  placeholder="예: 큐와 배열 집중 학습"
                />
              </label>
              <label className="field">
                <span>설명</span>
                <textarea
                  className="textarea--short"
                  value={draft.description}
                  aria-invalid={showValidation && !draft.description.trim()}
                  onChange={(event) => patchDraft({ description: event.target.value })}
                  placeholder="멤버가 해야 할 일을 짧게 설명하세요."
                />
              </label>
            </section>

            <section className="editor-items" aria-labelledby="editor-items-title">
              <div className="editor-items__heading">
                <div>
                  <strong id="editor-items-title">학습 항목</strong>
                  <span>{draft.items.length}개</span>
                </div>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  onClick={addItem}
                >
                  <Plus size={15} /> 추가
                </button>
              </div>

              <div className="editor-item-list">
                {draft.items.map((item, index) => {
                  const expanded = expandedItemIds.has(item.id);
                  return (
                    <article
                      className={`editor-item ${expanded ? "editor-item--expanded" : ""}`}
                      key={item.id}
                    >
                      <header className="editor-item__header">
                        <button
                          type="button"
                          className="editor-item__toggle"
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedItemIds((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) {
                                next.delete(item.id);
                              } else {
                                next.add(item.id);
                              }
                              return next;
                            })
                          }
                        >
                          <span className="step-number">{index + 1}</span>
                          <span>
                            <strong>{item.title.trim() || `새 학습 항목 ${index + 1}`}</strong>
                            <small>
                              {SUBMISSION_TYPE_LABEL[item.submitType]} ·{" "}
                              {item.required ? "필수" : "선택"}
                            </small>
                          </span>
                          <ChevronDown size={17} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-button icon-button--danger"
                          aria-label={`${item.title || index + 1} 항목 제거`}
                          disabled={draft.items.length === 1}
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </header>

                      {expanded ? (
                        <div className="editor-item__body">
                          <div className="form-grid form-grid--item">
                            <label className="field">
                              <span>항목 제목</span>
                              <input
                                value={item.title}
                                aria-invalid={showValidation && !item.title.trim()}
                                onChange={(event) =>
                                  patchItem(item.id, { title: event.target.value })
                                }
                                placeholder="학습할 내용을 입력하세요."
                              />
                            </label>
                            <label className="field">
                              <span>제출 방식</span>
                              <select
                                value={item.submitType}
                                onChange={(event) =>
                                  patchItem(item.id, {
                                    submitType: event.target
                                      .value as SessionItem["submitType"],
                                  })
                                }
                              >
                                {Object.entries(SUBMISSION_TYPE_LABEL).map(
                                  ([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>
                          <div className="form-grid form-grid--item-secondary">
                            <label className="field">
                              <span>출처 <small>선택</small></span>
                              <input
                                value={item.source ?? ""}
                                onChange={(event) =>
                                  patchItem(item.id, { source: event.target.value })
                                }
                                placeholder="예: programmers"
                              />
                            </label>
                            <label className="field">
                              <span>학습 URL <small>선택</small></span>
                              <input
                                type="url"
                                value={item.url ?? ""}
                                onChange={(event) =>
                                  patchItem(item.id, { url: event.target.value })
                                }
                                placeholder="https://"
                              />
                            </label>
                          </div>
                          <div className="editor-item__meta">
                            <label className="check-field check-field--switch">
                              <input
                                type="checkbox"
                                checked={item.required}
                                onChange={(event) =>
                                  patchItem(item.id, { required: event.target.checked })
                                }
                              />
                              <i aria-hidden="true" />
                              <span>
                                <strong>필수 항목</strong>
                                <small>완료율에 포함</small>
                              </span>
                            </label>
                            <code>{item.id}</code>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            {session ? (
              <section
                className="editor-section editor-section--reason"
                aria-labelledby="reason-section-title"
              >
                <header className="editor-section__heading">
                  <span><GitCommitHorizontal size={16} /></span>
                  <div>
                    <strong id="reason-section-title">변경 사유</strong>
                    <small>
                      {submissionCount > 0
                        ? "기존 제출이 있어 필수입니다."
                        : "팀원에게 변경 내용을 알려주세요."}
                    </small>
                  </div>
                </header>
                <label className="field">
                  <input
                    value={draft.changeReason}
                    aria-label="변경 사유"
                    aria-invalid={
                      showValidation &&
                      submissionCount > 0 &&
                      !draft.changeReason.trim()
                    }
                    onChange={(event) =>
                      patchDraft({ changeReason: event.target.value })
                    }
                    placeholder="예: 문제 난이도 조정"
                  />
                </label>
              </section>
            ) : null}
          </div>
        </div>

        <footer className="session-editor__footer">
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="button button--ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={save}
              disabled={saving}
            >
              <Save size={15} />
              {saving ? "저장 중…" : session ? "저장" : "일정 만들기"}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
