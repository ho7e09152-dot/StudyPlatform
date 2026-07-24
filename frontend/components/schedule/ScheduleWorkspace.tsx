"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FilePenLine,
  GitCommitHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SessionEditorDialog } from "./SessionEditorDialog";
import { REFERENCE_DATE, SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate, formatTime } from "@/lib/domain/format";
import { getDashboardMetrics } from "@/lib/domain/metrics";
import type { SessionType, StudySession } from "@/lib/domain/types";

type Filter = "all" | SessionType;
type StatusFilter = "all" | "upcoming" | "today" | "past" | "cancelled";

export function ScheduleWorkspace() {
  const { workspace, saveSession } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<StudySession | "new" | null>(null);
  const sessions = useMemo(
    () =>
      Object.values(workspace.sessions)
        .filter(
          (session) => filter === "all" || session.type === filter,
        )
        .filter((session) => {
          if (statusFilter === "all") return true;
          if (statusFilter === "cancelled") return session.status === "cancelled";
          if (session.status === "cancelled") return false;
          if (statusFilter === "today") return session.date === REFERENCE_DATE;
          if (statusFilter === "upcoming") return session.date > REFERENCE_DATE;
          return session.date < REFERENCE_DATE;
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
    [filter, searchQuery, statusFilter, workspace.sessions],
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
          const meta = SESSION_TYPE_META[session.type];
          const metrics = getDashboardMetrics(workspace, session);
          return (
            <article
              key={session.date}
              className={`schedule-card ${session.date === REFERENCE_DATE ? "schedule-card--today" : ""} ${session.status === "cancelled" ? "schedule-card--cancelled" : ""}`}
            >
              <header>
                <div>
                  <span>{formatDate(session.date, true)}</span>
                  {session.date === REFERENCE_DATE ? <em>오늘</em> : null}
                </div>
                <span className={`type-chip type-chip--${meta.tone}`}>{meta.short}</span>
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
                  <span><GitCommitHorizontal size={14} /> rev.{session.revision}</span>
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
                <code>{session.folder}/session.yml</code>
                <button
                  type="button"
                  className="button button--secondary button--small"
                  disabled={session.status === "cancelled"}
                  onClick={() => setEditing(session)}
                >
                  <FilePenLine size={15} /> 편집
                </button>
              </footer>
            </article>
          );
        })}
        {!sessions.length ? (
          <div className="schedule-empty">
            <CalendarDays size={24} aria-hidden="true" />
            <strong>조건에 맞는 일정이 없습니다</strong>
            <p>검색어를 지우거나 상태·유형 필터를 변경해 보세요.</p>
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setFilter("all");
              }}
            >
              필터 초기화
            </button>
          </div>
        ) : null}
      </section>

      {editing ? (
        <SessionEditorDialog
          workspace={workspace}
          session={editing === "new" ? undefined : editing}
          onSave={saveSession}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
