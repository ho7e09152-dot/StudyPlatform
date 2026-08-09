"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Eye,
  FilePenLine,
  GitCommitHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { SessionDetailDialog } from "@/components/session/SessionDetailDialog";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SubmissionDialog } from "@/components/today/SubmissionDialog";
import { SessionEditorDialog } from "./SessionEditorDialog";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate, formatTime, getWorkspaceRepositoryPath } from "@/lib/domain/format";
import { getDashboardMetrics } from "@/lib/domain/metrics";
import type { SessionType, StudySession } from "@/lib/domain/types";

type Filter = "all" | SessionType;
type StatusFilter = "all" | "upcoming" | "today" | "past" | "cancelled";

export function ScheduleWorkspace() {
  const { workspace, referenceDate, currentUserId, saveSession, submitItem } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<StudySession | "new" | null>(null);
  const [selectedSession, setSelectedSession] = useState<StudySession | null>(null);
  const [submissionTarget, setSubmissionTarget] = useState<{
    session: StudySession;
    itemId: string;
  } | null>(null);
  const sessions = useMemo(
    () =>
      Object.values(workspace.sessions)
        .filter(
          (session) =>
            filter === "all" ||
            session.items.some((item) => (item.type ?? session.type) === filter),
        )
        .filter((session) => {
          if (statusFilter === "all") return true;
          if (statusFilter === "cancelled") return session.status === "cancelled";
          if (session.status === "cancelled") return false;
          if (statusFilter === "today") return session.date === referenceDate;
          if (statusFilter === "upcoming") return session.date > referenceDate;
          return session.date < referenceDate;
        })
        .filter((session) => {
          const query = searchQuery.trim().toLocaleLowerCase("ko");
          if (!query) return true;
          return [
            session.title,
            session.description,
            ...session.items.flatMap((item) => [item.title, item.source ?? ""]),
          ].some((value) => value.toLocaleLowerCase("ko").includes(query));
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filter, referenceDate, searchQuery, statusFilter, workspace.sessions],
  );

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">SESSION MANAGEMENT</p>
          <h1>학습 일정</h1>
          <p>모든 활성 멤버가 일정을 만들고 수정할 수 있습니다.</p>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setEditing("new")}
        >
          <Plus size={17} /> 새 일정
        </button>
      </header>

      <div className="schedule-toolbar">
        <label className="schedule-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="일정이나 학습 항목 검색"
            aria-label="일정 검색"
          />
        </label>
        <div className="filter-bar filter-bar--status" role="group" aria-label="일정 상태 필터">
          {[
            ["all", "전체 상태"],
            ["upcoming", "예정"],
            ["today", "오늘"],
            ["past", "지난 일정"],
            ["cancelled", "취소됨"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={statusFilter === key ? "active" : undefined}
              type="button"
              onClick={() => setStatusFilter(key as StatusFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar" role="group" aria-label="학습 유형 필터">
        <button className={filter === "all" ? "active" : undefined} type="button" onClick={() => setFilter("all")}>전체 유형</button>
        {Object.entries(SESSION_TYPE_META).map(([key, meta]) => (
          <button
            key={key}
            className={filter === key ? "active" : undefined}
            type="button"
            onClick={() => setFilter(key as SessionType)}
          >
            {meta.label}
          </button>
        ))}
      </div>

      <section className="schedule-grid" aria-label="학습 일정 목록">
        {sessions.map((session) => {
          const sessionTypes = Array.from(
            new Set(session.items.map((item) => item.type ?? session.type)),
          );
          const metrics = getDashboardMetrics(workspace, session);
          return (
            <article
              key={session.date}
              className={`schedule-card schedule-card--clickable ${session.date === referenceDate ? "schedule-card--today" : ""} ${session.status === "cancelled" ? "schedule-card--cancelled" : ""}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button, a")) return;
                setSelectedSession(session);
              }}
            >
              <header>
                <div>
                  <span>{formatDate(session.date, true)}</span>
                  {session.date === referenceDate ? <em>오늘</em> : null}
                </div>
                <span className="schedule-card__types" aria-label="학습 유형">
                  {sessionTypes.map((type) => {
                    const meta = SESSION_TYPE_META[type];
                    return <span key={type} className={`type-chip type-chip--${meta.tone}`}>{meta.short}</span>;
                  })}
                </span>
              </header>
              <div className="schedule-card__body">
                <h2>{session.title}</h2>
                <p>{session.description}</p>
                <div className="schedule-card__meta">
                  <span><CalendarDays size={14} /> 항목 {session.items.filter((item) => item.status === "active").length}개</span>
                  {session.secondaryDeadline ? (
                    <>
                      <span><Clock3 size={14} /> 1차 {formatTime(session.deadline)}</span>
                      <span><Clock3 size={14} /> 2차 {formatTime(session.secondaryDeadline)}</span>
                    </>
                  ) : (
                    <span><Clock3 size={14} /> {formatTime(session.deadline)}</span>
                  )}
                  <span><GitCommitHorizontal size={14} /> {session.lastCommitId.slice(0, 8)} · rev.{session.revision}</span>
                </div>
              </div>
              {session.change?.changed ? (
                <div className="compact-notice">변경됨 · {session.change.reason}</div>
              ) : null}
              <div className="schedule-progress">
                <span>전체 제출률</span>
                <strong>{metrics.submissionRate}%</strong>
                <ProgressBar value={metrics.submissionRate} />
              </div>
              <footer>
                <code>{getWorkspaceRepositoryPath(workspace.repositoryBasePath, `${session.folder}/session.yml`)}</code>
                <div className="schedule-card__actions">
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => setSelectedSession(session)}
                  >
                    <Eye size={15} /> 상세
                  </button>
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    disabled={session.status === "cancelled"}
                    onClick={() => setEditing(session)}
                  >
                    <FilePenLine size={15} /> 편집
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
        {!sessions.length ? (
          <div className="schedule-empty">
            <CalendarDays size={24} aria-hidden="true" />
            <strong>{Object.keys(workspace.sessions).length ? "조건에 맞는 일정이 없습니다" : "아직 등록된 학습 일정이 없습니다"}</strong>
            <p>{Object.keys(workspace.sessions).length ? "검색어를 지우거나 상태·유형 필터를 변경해 보세요." : "첫 일정을 만들고 팀의 학습 항목과 마감 시간을 설정해 보세요."}</p>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                if (Object.keys(workspace.sessions).length) {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setFilter("all");
                } else {
                  setEditing("new");
                }
              }}
            >
              {Object.keys(workspace.sessions).length ? "필터 초기화" : "첫 일정 만들기"}
            </button>
          </div>
        ) : null}
      </section>

      {editing ? (
        <SessionEditorDialog
          workspace={workspace}
          referenceDate={referenceDate}
          session={editing === "new" ? undefined : editing}
          onSave={saveSession}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {selectedSession ? (
        <SessionDetailDialog
          workspace={workspace}
          session={selectedSession}
          currentUserId={currentUserId}
          onOpenSubmission={(itemId) => {
            setSubmissionTarget({ session: selectedSession, itemId });
            setSelectedSession(null);
          }}
          onClose={() => setSelectedSession(null)}
        />
      ) : null}
      {submissionTarget ? (
        <SubmissionDialog
          workspace={workspace}
          session={submissionTarget.session}
          currentUserId={currentUserId}
          initialItemId={submissionTarget.itemId}
          onSubmit={submitItem}
          onClose={() => setSubmissionTarget(null)}
        />
      ) : null}
    </div>
  );
}
