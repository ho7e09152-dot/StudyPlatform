"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  Check,
  Clock3,
  ChevronDown,
  Code2,
  GitCommitHorizontal,
  FileUp,
  Languages,
  ListChecks,
  Monitor,
  Save,
  Tag,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client/http";
import { getUserFacingError } from "@/lib/api/errors";
import {
  SESSION_TYPE_META,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/domain/constants";
import { formatDate, newStableItemId } from "@/lib/domain/format";
import { getMemberProgress } from "@/lib/domain/metrics";
import type {
  SessionDraft,
  SessionItem,
  SessionItemKind,
  SessionType,
  StudySession,
  Workspace,
} from "@/lib/domain/types";

function emptyItem(kind: SessionItemKind = "submission", type: SessionType = "algorithm", date = ""): SessionItem {
  return {
    id: newStableItemId(),
    order: 1,
    title: "",
    kind,
    type,
    submitType: kind === "submission" ? "link" : "text",
    required: kind !== "event",
    deadline: kind === "submission" && date ? `${date}T23:59` : undefined,
    startTime: kind === "event" ? "19:00" : undefined,
    endTime: kind === "event" ? "20:00" : undefined,
    status: "active",
  };
}

function withTimezone(deadline: string) {
  return deadline.includes("+") ? deadline : `${deadline}:00+09:00`;
}

function makeDraft(session: StudySession | undefined, referenceDate: string): SessionDraft {
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
        .map((item) => ({
          ...item,
          kind: item.kind ?? "submission",
          type: item.type ?? session.type,
          deadline: item.deadline ?? ((item.kind ?? "submission") === "submission" ? session.deadline.slice(0, 16) : undefined),
          secondaryDeadline: item.secondaryDeadline ?? ((item.kind ?? "submission") === "submission" ? session.secondaryDeadline?.slice(0, 16) : undefined),
        })),
    };
  }
  return {
    date: referenceDate,
    type: "algorithm",
    title: `${referenceDate} 계획`,
    description: "",
    deadline: `${referenceDate}T23:59`,
    secondaryDeadline: undefined,
    changeReason: "",
    items: [emptyItem("submission", "algorithm", referenceDate)],
  };
}

export function SessionEditorPage({
  workspace,
  session,
  referenceDate,
  initialStep = 1,
  onExistingDateSelected,
  onSave,
  onClose,
}: {
  workspace: Workspace;
  session?: StudySession;
  referenceDate: string;
  initialStep?: 1 | 2;
  onExistingDateSelected?: (date: string) => boolean;
  onSave: (draft: SessionDraft, expectedRevision?: number) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => makeDraft(session, referenceDate));
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(draft.items[0]?.id ? [draft.items[0].id] : []),
  );
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const initialDraft = useMemo(() => makeDraft(session, referenceDate), [referenceDate, session]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const submissionCount = useMemo(
    () =>
      session
        ? getMemberProgress(workspace, session).filter(
            (progress) => progress.completedItems > 0,
          ).length
        : 0,
    [session, workspace],
  );

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

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

  function addItem(kind: SessionItemKind = "submission") {
    const item = {
      ...emptyItem(kind, draft.items.at(-1)?.type ?? "algorithm", draft.date),
      order: draft.items.length + 1,
    };
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
    if (!draft.date) {
      setError("날짜를 입력해 주세요.");
      setStep(1);
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
    const invalidSubmission = draft.items.find((item) => (item.kind ?? "submission") === "submission" && !item.deadline);
    if (invalidSubmission) {
      setError("제출형 항목의 마감 시간을 입력해 주세요.");
      setExpandedItemIds((current) => new Set(current).add(invalidSubmission.id));
      return;
    }
    const invalidDeadline = draft.items.find((item) => item.secondaryDeadline && (!item.deadline || item.secondaryDeadline <= item.deadline));
    if (invalidDeadline) {
      setError("항목의 2차 마감은 1차 마감보다 늦게 설정해 주세요.");
      setExpandedItemIds((current) => new Set(current).add(invalidDeadline.id));
      return;
    }
    const invalidEvent = draft.items.find((item) => (item.kind ?? "submission") === "event" && (!item.startTime || !item.endTime || item.endTime <= item.startTime));
    if (invalidEvent) {
      setError("시간형 항목의 종료 시간은 시작 시간보다 늦어야 합니다.");
      setExpandedItemIds((current) => new Set(current).add(invalidEvent.id));
      return;
    }
    if (session && submissionCount > 0 && !draft.changeReason.trim()) {
      setError("이미 제출이 있으므로 변경 사유를 입력해야 합니다.");
      return;
    }
    setSaving(true);
    try {
      const normalizedItems = draft.items.map((item) => ({
        ...item,
        deadline: item.deadline ? withTimezone(item.deadline) : undefined,
        secondaryDeadline: item.secondaryDeadline ? withTimezone(item.secondaryDeadline) : undefined,
      }));
      const representative = normalizedItems.find((item) => (item.kind ?? "submission") === "submission") ?? normalizedItems[0];
      const legacyDeadline = representative?.deadline ?? `${draft.date}T23:59:00+09:00`;
      await onSave(
        {
          ...draft,
          title: representative?.title.trim() || `${draft.date} 계획`,
          description: "",
          type: representative?.type ?? draft.type,
          deadline: legacyDeadline,
          secondaryDeadline: representative?.secondaryDeadline,
          items: normalizedItems,
        },
        session?.revision,
      );
      onClose();
    } catch (saveError) {
      const code = saveError instanceof ApiError
        ? saveError.code
        : saveError instanceof Error
          ? saveError.message
          : "UNKNOWN";
      setError(
        code === "SESSION_REVISION_CONFLICT"
          ? "다른 사용자가 일정을 먼저 수정했습니다. 최신 내용을 다시 확인해 주세요."
          : code === "SESSION_ALREADY_EXISTS"
            ? "같은 날짜의 session.yml이 이미 있습니다. 저장소를 동기화한 뒤 다시 시도해 주세요."
          : code === "SESSION_FILE_MISSING"
            ? "저장소에서 일정 파일을 찾지 못했습니다. 동기화 후 다시 시도해 주세요."
          : code === "CHANGE_REASON_REQUIRED"
            ? "기존 제출이 있는 일정은 변경 사유가 필요합니다."
            : code === "GITLAB_PROJECT_ACCESS_DENIED"
              ? "현재 Provider 계정에 이 브랜치로 커밋할 권한이 없습니다."
              : code === "GITLAB_RATE_LIMITED"
                ? "저장소 Provider 요청 제한에 도달했습니다. 잠시 후 다시 시도해 주세요."
                : getUserFacingError(saveError, "일정을 저장하지 못했습니다."),
      );
    } finally {
      setSaving(false);
    }
  }

  function goToItems() {
    setShowValidation(true);
    if (!draft.date) {
      setError("날짜를 입력해 주세요.");
      return;
    }
    if (onExistingDateSelected?.(draft.date)) return;
    setError("");
    setShowValidation(false);
    setStep(2);
  }

  const typeIcons: Record<SessionType, typeof Code2> = {
    algorithm: Code2,
    english: Languages,
    cs: Monitor,
    free: Tag,
  };

  function requestClose() {
    if (dirty) setConfirmCancel(true);
    else onClose();
  }

  return (
    <div className="page-stack schedule-editor-page">
      <header className="schedule-page-back">
        <Link href="/schedule" aria-label="학습 일정으로 돌아가기"><ArrowLeft size={17} /> 학습 일정</Link>
      </header>
      <div className="schedule-editor-heading">
        <div>
          <p className="eyebrow">{session ? formatDate(session.date, true) : "새로운 학습 계획"}</p>
          <h1>{session ? "하루 계획 편집" : "항목 추가"}</h1>
          <p>{session ? "이 날짜에 필요한 항목을 추가하거나 정리하세요." : "날짜를 선택하고 제출, 체크 또는 시간 항목을 추가하세요."}</p>
        </div>
      </div>
      <section className="surface session-editor session-editor--wizard" aria-label={session ? "학습 일정 편집 양식" : "새 학습 일정 양식"}>
        <nav className="editor-progress" aria-label="일정 만들기 단계">
          <button
            type="button"
            className={step === 1 ? "is-active" : "is-complete"}
            aria-current={step === 1 ? "step" : undefined}
            onClick={() => setStep(1)}
          >
            <span>{step === 2 ? <Check size={15} /> : "1"}</span>
            날짜
          </button>
          <i className={step === 2 ? "is-complete" : undefined} aria-hidden="true" />
          <button type="button" className={step === 2 ? "is-active" : "is-upcoming"} aria-current={step === 2 ? "step" : undefined} onClick={goToItems}>
            <span>2</span>
            항목
          </button>
        </nav>

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

            {step === 1 ? (
              <section className="editor-step" aria-labelledby="basic-section-title">
                <header className="editor-step__heading">
                  <span><CalendarDays size={18} /></span>
                  <div>
                    <strong id="basic-section-title">날짜 선택</strong>
                    <small>항목을 등록할 날짜를 선택하세요.</small>
                  </div>
                </header>

                <div className="editor-card editor-card--period">
                  <strong className="editor-card__title">계획 날짜</strong>
                  <div>
                    <label className="field">
                      <span>날짜 <b>*</b></span>
                      <input
                        type="date"
                        lang="ko-KR"
                        value={draft.date}
                        disabled={Boolean(session)}
                        aria-invalid={showValidation && !draft.date}
                        onChange={(event) => {
                          const date = event.target.value;
                          setDraft((current) => ({
                            ...current,
                            date,
                            title: `${date} 계획`,
                            deadline: `${date}T23:59`,
                            items: current.items.map((item) => ({
                              ...item,
                              deadline: (item.kind ?? "submission") === "submission" ? `${date}T23:59` : item.deadline,
                            })),
                          }));
                          setError("");
                        }}
                      />
                    </label>
                  </div>
                  <p className="editor-card__helper">제목과 설명, 마감 또는 시간은 각 항목에서 설정합니다.</p>
                </div>
              </section>
            ) : (
              <section className="editor-step editor-step--items" aria-labelledby="editor-items-title">
                <div className="editor-items__heading">
                  <div className="editor-step__heading">
                    <span><ListChecks size={18} /></span>
                    <div>
                      <strong id="editor-items-title">항목</strong>
                      <small>제출, 체크, 시간 항목을 한 날짜에 함께 등록할 수 있습니다.</small>
                    </div>
                  </div>
                  <div className="editor-item-add-actions" role="group" aria-label="추가할 항목 유형">
                    <button type="button" className="button button--secondary button--small" onClick={() => addItem("submission")}><FileUp size={15} /> 제출</button>
                    <button type="button" className="button button--secondary button--small" onClick={() => addItem("check")}><ListChecks size={15} /> 체크</button>
                    <button type="button" className="button button--secondary button--small" onClick={() => addItem("event")}><Clock3 size={15} /> 시간</button>
                  </div>
                </div>

                <div className="editor-item-list">
                  {draft.items.map((item, index) => {
                    const expanded = expandedItemIds.has(item.id);
                    const kind = item.kind ?? "submission";
                    const kindLabel = kind === "submission" ? "제출" : kind === "check" ? "체크" : "시간";
                    return (
                      <article className={`editor-item ${expanded ? "editor-item--expanded" : ""}`} key={item.id}>
                        <header className="editor-item__header">
                          <button
                            type="button"
                            className="editor-item__toggle"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedItemIds((current) => {
                                const next = new Set(current);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              })
                            }
                          >
                            <span className="step-number">{index + 1}</span>
                            <span className="editor-item__summary">
                              <strong>{item.title.trim() || `새 ${kindLabel} 항목 ${index + 1}`}</strong>
                              <small>
                                <em className={`item-kind-chip item-kind-chip--${kind}`}>{kindLabel}</em>
                                {kind !== "event" && item.required ? <em className="required-chip">필수</em> : null}
                              </small>
                            </span>
                            <span className="editor-item__submission">
                              {kind === "submission" ? SUBMISSION_TYPE_LABEL[item.submitType] : kind === "event" ? `${item.startTime ?? "--:--"}–${item.endTime ?? "--:--"}` : "완료 체크"}
                            </span>
                            <ChevronDown size={18} aria-hidden="true" />
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
                              <label className="field field--with-count">
                                <span>항목 제목 <b>*</b></span>
                                <input
                                  value={item.title}
                                  maxLength={50}
                                  aria-invalid={showValidation && !item.title.trim()}
                                  onChange={(event) => patchItem(item.id, { title: event.target.value })}
                                  placeholder="학습할 내용을 입력하세요."
                                />
                                <small>{item.title.length}/50</small>
                              </label>
                              <label className="field">
                                <span>항목 유형 <b>*</b></span>
                                <select
                                  value={kind}
                                  onChange={(event) =>
                                    patchItem(item.id, {
                                      kind: event.target.value as SessionItemKind,
                                      required: event.target.value !== "event",
                                      submitType: event.target.value === "submission" ? item.submitType : "text",
                                      deadline: event.target.value === "submission" ? (item.deadline ?? `${draft.date}T23:59`) : undefined,
                                      secondaryDeadline: event.target.value === "submission" ? item.secondaryDeadline : undefined,
                                      startTime: event.target.value === "event" ? (item.startTime ?? "19:00") : undefined,
                                      endTime: event.target.value === "event" ? (item.endTime ?? "20:00") : undefined,
                                    })
                                  }
                                >
                                  <option value="submission">제출형</option>
                                  <option value="check">체크형</option>
                                  <option value="event">시간형</option>
                                </select>
                              </label>
                            </div>

                            <label className="field field--with-count">
                              <span>설명 <small>(선택)</small></span>
                              <textarea value={item.description ?? ""} maxLength={300} onChange={(event) => patchItem(item.id, { description: event.target.value })} placeholder="항목에 필요한 안내를 입력하세요." />
                              <small>{item.description?.length ?? 0}/300</small>
                            </label>

                            {kind === "submission" ? <>
                              <div className="form-grid form-grid--item">
                                <label className="field"><span>제출 방식 <b>*</b></span><select value={item.submitType} onChange={(event) => patchItem(item.id, { submitType: event.target.value as SessionItem["submitType"] })}>{Object.entries(SUBMISSION_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                                <label className="field"><span>마감 <b>*</b></span><input type="datetime-local" lang="ko-KR" value={item.deadline?.slice(0, 16) ?? ""} onChange={(event) => patchItem(item.id, { deadline: event.target.value })} /></label>
                              </div>
                              <label className="field"><span>2차 마감 <small>(선택)</small></span><input type="datetime-local" lang="ko-KR" value={item.secondaryDeadline?.slice(0, 16) ?? ""} min={item.deadline?.slice(0, 16)} onChange={(event) => patchItem(item.id, { secondaryDeadline: event.target.value || undefined })} /></label>
                              <div className="form-grid form-grid--item-secondary">
                                <label className="field"><span>출처 <small>(선택)</small></span><input value={item.source ?? ""} onChange={(event) => patchItem(item.id, { source: event.target.value })} placeholder="예: Programmers" /></label>
                                <label className="field"><span>자료 URL <small>(선택)</small></span><input type="url" value={item.url ?? ""} onChange={(event) => patchItem(item.id, { url: event.target.value })} placeholder="https://" /></label>
                              </div>
                            </> : null}

                            {kind === "check" ? (
                              <label className="field"><span>마감 <small>(선택)</small></span><input type="datetime-local" lang="ko-KR" value={item.deadline?.slice(0, 16) ?? ""} onChange={(event) => patchItem(item.id, { deadline: event.target.value || undefined })} /></label>
                            ) : null}

                            {kind === "event" ? (
                              <div className="form-grid form-grid--item">
                                <label className="field"><span>시작 시간 <b>*</b></span><input type="time" value={item.startTime ?? ""} onChange={(event) => patchItem(item.id, { startTime: event.target.value })} /></label>
                                <label className="field"><span>종료 시간 <b>*</b></span><input type="time" value={item.endTime ?? ""} onChange={(event) => patchItem(item.id, { endTime: event.target.value })} /></label>
                              </div>
                            ) : null}

                            {kind !== "event" ? <fieldset className="item-type-options">
                              <legend>학습 유형 <b>*</b></legend>
                              <div>
                                {Object.entries(SESSION_TYPE_META).map(([type, typeMeta]) => {
                                  const ItemTypeIcon = typeIcons[type as SessionType];
                                  return (
                                    <label key={type}>
                                      <input
                                        type="radio"
                                        name={`item-type-${item.id}`}
                                        value={type}
                                        checked={item.type === type}
                                        onChange={() => patchItem(item.id, { type: type as SessionType })}
                                      />
                                      <span>
                                        <ItemTypeIcon size={18} />
                                        <strong>{typeMeta.short}</strong>
                                        <small>{typeMeta.label}</small>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </fieldset> : null}

                            {kind !== "event" ? <div className="editor-item__meta">
                              <label className="check-field check-field--switch">
                                <input
                                  type="checkbox"
                                  checked={item.required}
                                  onChange={(event) => patchItem(item.id, { required: event.target.checked })}
                                />
                                <i aria-hidden="true" />
                                <span>
                                  <strong>필수 항목</strong>
                                  <small>완료하지 않으면 일정이 완료되지 않습니다.</small>
                                </span>
                              </label>
                            </div> : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                {session ? (
                  <section className="editor-card editor-section--reason" aria-labelledby="reason-section-title">
                    <header className="editor-section__heading">
                      <span><GitCommitHorizontal size={16} /></span>
                      <div>
                        <strong id="reason-section-title">변경 사유</strong>
                        <small>{submissionCount > 0 ? "기존 제출이 있어 필수입니다." : "변경 내용을 팀원에게 간단히 알려주세요."}</small>
                      </div>
                    </header>
                    <label className="field">
                      <input
                        value={draft.changeReason}
                        aria-label="변경 사유"
                        aria-invalid={showValidation && submissionCount > 0 && !draft.changeReason.trim()}
                        onChange={(event) => patchDraft({ changeReason: event.target.value })}
                        placeholder="예: 문제 난이도 조정"
                      />
                    </label>
                  </section>
                ) : null}
              </section>
            )}
          </div>
        </div>

        <footer className="session-editor__footer">
          {error ? <p className="field-error" role="alert">{error}</p> : <span />}
          <div className="modal-actions">
            <button type="button" className="button button--ghost" onClick={requestClose}>취소</button>
            {step === 2 ? (
              <button type="button" className="button button--secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={15} /> 이전 단계
              </button>
            ) : null}
            <button
              type="button"
              className="button button--primary"
              onClick={step === 1 ? goToItems : save}
              disabled={saving}
            >
              {step === 1 ? (
                <>다음 단계 <ArrowRight size={15} /></>
              ) : (
                <><Save size={15} /> {saving ? "저장 중…" : "항목 저장"}</>
              )}
            </button>
          </div>
        </footer>
      </section>
      {confirmCancel ? (
        <Modal title="작성 중인 변경사항을 닫을까요?" description="저장하지 않은 내용은 사라집니다." onClose={() => setConfirmCancel(false)}>
          <div className="schedule-unsaved-dialog">
            <p>계속 작성하거나, 변경사항을 버리고 학습 일정으로 돌아갈 수 있습니다.</p>
            <div className="modal-actions">
              <button type="button" className="button button--ghost" onClick={() => setConfirmCancel(false)}>계속 작성</button>
              <button type="button" className="button button--danger" onClick={onClose}>변경사항 버리기</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
