"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate, formatTime } from "@/lib/domain/format";
import { getMemberProgress } from "@/lib/domain/metrics";
import { canManageSchedules } from "@/lib/domain/permissions";
import type { SessionType, StudySession } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";

type ScheduleView = "calendar" | "list";
type TypeFilter = "all" | SessionType;
type StatusFilter = "all" | "upcoming" | "today" | "past" | "cancelled";

function parseDateKey(date: string) {
  return new Date(`${date}T12:00:00+09:00`);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(date: string) {
  const parsed = parseDateKey(date);
  return new Date(parsed.getFullYear(), parsed.getMonth(), 1, 12);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(date);
}

function scheduleStatus(session: StudySession, referenceDate: string) {
  if (session.status === "cancelled") return { label: "취소됨", tone: "danger" };
  if (session.date === referenceDate) return { label: "오늘", tone: "primary" };
  if (session.date > referenceDate) return { label: "예정", tone: "neutral" };
  if (session.secondaryDeadline && session.secondaryDeadline.slice(0, 10) >= referenceDate) {
    return { label: "지각 제출 가능", tone: "warning" };
  }
  return { label: "지난 일정", tone: "neutral" };
}

function ScheduleRow({
  session,
  referenceDate,
  variant = "compact",
}: {
  session: StudySession;
  referenceDate: string;
  variant?: "compact" | "list";
}) {
  const { workspace, currentUserId } = useWorkspace();
  const status = scheduleStatus(session, referenceDate);
  const meta = SESSION_TYPE_META[session.type];
  const myProgress = getMemberProgress(workspace, session).find(
    (progress) => progress.member.id === currentUserId,
  );
  const activeItems = session.items.filter((item) => item.status === "active");
  const usesSecondaryDeadline = Boolean(
    session.secondaryDeadline
      && session.date < referenceDate
      && session.secondaryDeadline.slice(0, 10) >= referenceDate,
  );
  const visibleDeadline = usesSecondaryDeadline ? session.secondaryDeadline! : session.deadline;
  const deadlineLabel = `${activeItems.length}개 항목 · ${usesSecondaryDeadline ? "2차 " : ""}${formatTime(visibleDeadline)} 마감`;

  if (variant === "list") {
    const showRowState = status.label !== "오늘";

    return (
      <Link className="schedule-row schedule-list-row" href={APP_ROUTES.scheduleDetail(session.date)} title={session.title}>
        <span className="schedule-list-row__primary">
          <span className={`type-chip type-chip--${meta.tone}`}>{meta.label}</span>
          <strong>{session.title}</strong>
          <small>{deadlineLabel}</small>
        </span>
        <span className="schedule-list-row__aside">
          <span className="schedule-list-row__progress">
            <span>내 진행</span>
            <strong>{myProgress?.completedItems ?? 0} / {myProgress?.requiredItems ?? 0}</strong>
          </span>
          {showRowState || session.change?.changed ? (
            <span className="schedule-list-row__statuses">
              {showRowState ? <span className={`status-badge ${status.tone}`}>{status.label}</span> : null}
              {session.change?.changed ? <span className="status-badge warning schedule-list-row__change">변경됨</span> : null}
            </span>
          ) : null}
        </span>
        <ChevronRight className="schedule-list-row__chevron" size={19} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <Link className="schedule-row" href={APP_ROUTES.scheduleDetail(session.date)} title={session.title}>
      <span className={`type-chip type-chip--${meta.tone}`}>{meta.label}</span>
      <span className="schedule-row__main">
        <span>
          <strong>{session.title}</strong>
          {session.change?.changed ? <em className="status-badge warning">변경됨</em> : null}
        </span>
        <small>
          {deadlineLabel}
        </small>
      </span>
      <span className="schedule-row__progress">
        <span>내 진행 <strong>{myProgress?.completedItems ?? 0} / {myProgress?.requiredItems ?? 0}</strong></span>
      </span>
      <span className={`status-badge ${status.tone}`}>{status.label}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

function ScheduleAgenda({
  sessions,
  referenceDate,
  labelledBy,
}: {
  sessions: StudySession[];
  referenceDate: string;
  labelledBy?: string;
}) {
  const groups = useMemo(() => {
    const next = new Map<string, StudySession[]>();
    sessions.forEach((session) => next.set(session.date, [...(next.get(session.date) ?? []), session]));
    return Array.from(next.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  return (
    <section className="surface schedule-agenda" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : "일정 목록"}>
      {groups.map(([date, dateSessions]) => (
        <section className="schedule-date-group" key={date}>
          <header>
            <h2>{formatDate(date, false)}</h2>
            {date === referenceDate ? <span className="status-badge primary">오늘</span> : null}
          </header>
          <div>{dateSessions.map((session) => <ScheduleRow key={`${session.date}-${session.folder}`} session={session} referenceDate={referenceDate} variant="list" />)}</div>
        </section>
      ))}
    </section>
  );
}

export function ScheduleWorkspace() {
  const { workspace, referenceDate, currentUserId } = useWorkspace();
  const [view, setView] = useState<ScheduleView>("calendar");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(referenceDate));
  const [selectedDate, setSelectedDate] = useState(referenceDate);
  const allSessions = useMemo(
    () => Object.values(workspace.sessions).sort((a, b) => a.date.localeCompare(b.date)),
    [workspace.sessions],
  );

  const filteredSessions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("ko");
    return allSessions.filter((session) => {
      const matchesType = typeFilter === "all" || session.items.some(
        (item) => (item.type ?? session.type) === typeFilter,
      );
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "cancelled" && session.status === "cancelled")
        || (statusFilter === "today" && session.status !== "cancelled" && session.date === referenceDate)
        || (statusFilter === "upcoming" && session.status !== "cancelled" && session.date > referenceDate)
        || (statusFilter === "past" && session.status !== "cancelled" && session.date < referenceDate);
      const matchesQuery = !query || [
        session.title,
        session.description,
        ...session.items.flatMap((item) => [item.title, item.source ?? ""]),
      ].some((value) => value.toLocaleLowerCase("ko").includes(query));
      return matchesType && matchesStatus && matchesQuery;
    });
  }, [allSessions, referenceDate, searchQuery, statusFilter, typeFilter]);

  const monthSessions = useMemo(() => {
    const prefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
    return filteredSessions.filter((session) => session.date.startsWith(prefix));
  }, [filteredSessions, visibleMonth]);

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);
    const mondayOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12).getDate();
    const visibleDayCount = mondayOffset + daysInMonth <= 35 ? 35 : 42;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: visibleDayCount }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, StudySession[]>();
    monthSessions.forEach((session) => map.set(session.date, [...(map.get(session.date) ?? []), session]));
    return map;
  }, [monthSessions]);
  const selectedSessions = sessionsByDate.get(selectedDate) ?? [];
  const filtersActive = Boolean(searchQuery.trim() || statusFilter !== "all" || typeFilter !== "all");
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = canManageSchedules(currentMember);

  function moveMonth(offset: number) {
    setVisibleMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + offset, 1, 12);
      setSelectedDate(toDateKey(next));
      return next;
    });
  }

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
  }

  return (
    <div className="page-stack schedule-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">학습 계획</p>
          <h1>학습 일정</h1>
          <p>스터디의 학습 계획과 마감을 확인하세요.</p>
        </div>
        {canManage ? <Link href={APP_ROUTES.scheduleNew} className="button button--primary"><Plus size={17} /> 새 일정</Link> : null}
      </header>

      <section className="schedule-view-toolbar" aria-label="일정 보기 방식">
        <div className="schedule-month-nav">
          <button type="button" className="icon-button" aria-label="이전 달" onClick={() => moveMonth(-1)}><ChevronLeft size={19} /></button>
          <strong>{monthLabel(visibleMonth)}</strong>
          <button type="button" className="icon-button" aria-label="다음 달" onClick={() => moveMonth(1)}><ChevronRight size={19} /></button>
        </div>
        <div className="schedule-view-toggle" role="group" aria-label="캘린더 또는 목록 보기">
          <button type="button" className={view === "calendar" ? "active" : undefined} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}><CalendarRange size={16} /> 캘린더</button>
          <button type="button" className={view === "list" ? "active" : undefined} aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16} /> 목록</button>
        </div>
      </section>

      <section className="schedule-filters" aria-label="일정 검색 및 필터">
        <label className="schedule-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="일정 또는 학습 항목 검색" aria-label="일정 또는 학습 항목 검색" />
        </label>
        <label>
          <span className="sr-only">일정 상태</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label="일정 상태">
            <option value="all">전체 상태</option><option value="upcoming">예정</option><option value="today">오늘</option><option value="past">지난 일정</option><option value="cancelled">취소됨</option>
          </select>
        </label>
        <label>
          <span className="sr-only">학습 유형</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} aria-label="학습 유형">
            <option value="all">전체 유형</option>
            {Object.entries(SESSION_TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
          </select>
        </label>
        {filtersActive ? <button type="button" className="schedule-filter-reset" onClick={resetFilters}><SlidersHorizontal size={15} /> 필터 초기화</button> : null}
      </section>

      <div key={`${view}-${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}`} className="motion-content-swap">
        {!allSessions.length ? (
          <section className="surface schedule-empty" aria-labelledby="schedule-empty-title">
          <CalendarDays size={28} aria-hidden="true" />
          <strong id="schedule-empty-title">아직 학습 일정이 없어요.</strong>
          <p>{canManage ? "첫 학습 일정을 만들어 스터디를 시작해보세요." : "관리자가 학습 일정을 만들면 여기에 표시됩니다."}</p>
          {canManage ? <Link href={APP_ROUTES.scheduleNew} className="button button--primary">새 일정 만들기</Link> : null}
          </section>
        ) : !filteredSessions.length ? (
          <section className="surface schedule-empty" aria-labelledby="schedule-search-empty-title">
          <Search size={28} aria-hidden="true" />
          <strong id="schedule-search-empty-title">조건에 맞는 일정이 없어요.</strong>
          <button type="button" className="button button--secondary" onClick={resetFilters}>필터 초기화</button>
          </section>
        ) : view === "list" ? (
          <ScheduleAgenda sessions={filteredSessions} referenceDate={referenceDate} />
        ) : (
          <section className="surface schedule-calendar" aria-label={`${monthLabel(visibleMonth)} 일정 캘린더`}>
          <div className="schedule-calendar__weekdays" aria-hidden="true">{["월", "화", "수", "목", "금", "토", "일"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="schedule-calendar__grid">
            {calendarDays.map((date) => {
              const dateKey = toDateKey(date);
              const daySessions = sessionsByDate.get(dateKey) ?? [];
              const inMonth = date.getMonth() === visibleMonth.getMonth();
              return (
                <div key={dateKey} className={`schedule-calendar__day${inMonth ? "" : " is-outside"}${dateKey === referenceDate ? " is-today" : ""}${dateKey === selectedDate ? " is-selected" : ""}`}>
                  <button type="button" className="schedule-calendar__date" aria-label={`${formatDate(dateKey, true)}, 일정 ${daySessions.length}개 선택`} aria-pressed={dateKey === selectedDate} onClick={() => setSelectedDate(dateKey)}>{date.getDate()}<span className="schedule-calendar__mobile-dots" aria-hidden="true">{daySessions.slice(0, 3).map((session) => <i key={session.date} />)}</span></button>
                  <div className="schedule-calendar__events">
                    {daySessions.slice(0, 2).map((session) => (
                      <Link key={session.date} href={APP_ROUTES.scheduleDetail(session.date)} title={session.title}><span aria-hidden="true" />{session.title}</Link>
                    ))}
                    {daySessions.length > 2 ? <button type="button" onClick={() => setSelectedDate(dateKey)}>+ {daySessions.length - 2}개 더 보기</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="schedule-mobile-agenda">
            <header><div><p className="eyebrow">선택한 날짜</p><h2 id="selected-date-agenda">{formatDate(selectedDate, false)}</h2></div><span>{selectedSessions.length}개 일정</span></header>
            {selectedSessions.length ? selectedSessions.map((session) => <ScheduleRow key={session.date} session={session} referenceDate={referenceDate} />) : <div className="schedule-mobile-agenda__empty"><p>이 날짜에는 학습 일정이 없어요.</p>{canManage ? <Link href={APP_ROUTES.scheduleNew}>일정 만들기 <ArrowRight size={14} /></Link> : null}</div>}
          </div>
          </section>
        )}
      </div>
    </div>
  );
}
