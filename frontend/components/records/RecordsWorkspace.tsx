"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Medal,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/format";
import {
  getDashboardMetrics,
  getMemberProgress,
  getScoreboard,
  SCORE_RULES,
  WORKSPACE_SCORE_POLICY,
} from "@/lib/domain/metrics";
import type { StudySession, Workspace } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
type RecordsView = "week" | "month";

function dateFromKey(date: string) {
  return new Date(`${date}T12:00:00Z`);
}

function toDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function moveDate(date: string, amount: number) {
  const next = dateFromKey(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return toDateKey(next);
}

function moveMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateKey(new Date(Date.UTC(year, monthNumber - 1 + amount, 1))).slice(0, 7);
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
}

function getMonthCalendar(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    firstDay: new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay(),
    days: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate(),
  };
}

function getWeekDates(anchor: string) {
  const date = dateFromKey(anchor);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setUTCDate(day.getUTCDate() + index);
    return toDateKey(day);
  });
}

function formatWeekRange(dates: string[]) {
  const start = dateFromKey(dates[0]);
  const end = dateFromKey(dates.at(-1)!);
  const startLabel = `${start.getUTCMonth() + 1}월 ${start.getUTCDate()}일`;
  const endLabel = `${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일`;
  return `${startLabel} - ${endLabel}`;
}

function SummaryMetric({ icon, value, label, detail, onClick }: {
  icon: ReactNode;
  value: string;
  label: string;
  detail?: string;
  onClick?: () => void;
}) {
  const body = <><span aria-hidden="true">{icon}</span><div><strong>{value}</strong><p>{label}</p>{detail ? <small>{detail}</small> : null}</div>{onClick ? <ChevronRight size={16} aria-hidden="true" /> : null}</>;
  return onClick ? (
    <button type="button" className="records-summary-metric records-summary-metric--interactive" onClick={onClick} aria-label={`${label} ${value}${detail ? `, ${detail}` : ""}, 상세 보기`}>{body}</button>
  ) : <article className="records-summary-metric">{body}</article>;
}

function TeamLearningStatus({ workspace, sessions, currentUserId, periodLabel }: {
  workspace: Workspace;
  sessions: StudySession[];
  currentUserId: string;
  periodLabel: string;
}) {
  const memberAverages = workspace.members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => {
      const rates = sessions.map((session) => getMemberProgress(workspace, session).find((progress) => progress.member.id === member.id)?.completionRate ?? 0);
      return { member, average: rates.length ? Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length) : null };
    });

  return (
    <section className="records-panel records-team-status" aria-labelledby="records-team-title">
      <header className="records-section-heading"><div><h2 id="records-team-title">팀 학습 현황</h2><p>일정이 있는 날의 필수 항목 완료율 평균입니다.</p></div><span>{periodLabel}</span></header>
      {sessions.length ? <div className="records-member-list">{memberAverages.map(({ member, average }) => (
        <div className="records-member-row" key={member.id}>
          <Avatar member={member} />
          <span><strong>{member.displayName}{member.id === currentUserId ? " (나)" : ""}</strong></span>
          <ProgressBar value={average ?? 0} label={`${member.displayName} 평균 완료율`} />
          <strong>{average}%</strong>
        </div>
      ))}</div> : <div className="records-inline-empty"><CalendarX2 size={22} /><p>이 기간에는 학습 기록이 없어요.</p></div>}
    </section>
  );
}

function WeeklyChart({ workspace, dates, selectedDate, onSelectDate }: {
  workspace: Workspace;
  dates: string[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const sessions = dates.map((date) => workspace.sessions[date]).filter((session): session is StudySession => Boolean(session && session.status === "active"));
  return (
    <section className="records-panel records-weekly-chart" aria-labelledby="records-weekly-title">
      <header className="records-section-heading"><div><h2 id="records-weekly-title">이번 주 완료율</h2><p>팀 전체 필수 항목의 일별 완료 흐름입니다.</p></div><span>{formatWeekRange(dates)}</span></header>
      {sessions.length ? <div className="records-bar-chart" role="group" aria-label={`${formatWeekRange(dates)} 일별 완료율`}>
        {dates.map((date) => {
          const session = workspace.sessions[date]?.status === "active" ? workspace.sessions[date] : undefined;
          const metrics = session ? getDashboardMetrics(workspace, session) : undefined;
          const rate = metrics?.submissionRate ?? null;
          const label = rate === null
            ? `${formatDate(date, true)}, 학습 일정 없음`
            : `${formatDate(date, true)}, 완료율 ${rate}%, ${metrics?.submittedItems} / ${metrics?.totalRequiredSubmissions}개 필수 항목 완료${selectedDate === date ? ", 선택됨" : ""}`;
          return (
            <button type="button" key={date} className={`${selectedDate === date ? "selected" : ""} ${rate === null ? "no-data" : ""}`} onClick={() => onSelectDate(date)} aria-label={label} title={label}>
              <span aria-hidden="true">{rate === null ? <><span className="records-no-data-full">일정 없음</span><span className="records-no-data-compact">—</span></> : `${rate}%`}</span>
              <i className="records-bar-track"><b style={{ height: `${rate === null ? 0 : Math.max(rate, 4)}%` }} /></i>
              <strong>{weekdays[dateFromKey(date).getUTCDay()]}</strong>
              <small>{Number(date.slice(8))}</small>
            </button>
          );
        })}
      </div> : <div className="records-period-empty"><CalendarX2 size={26} /><strong>이 기간에는 학습 기록이 없어요.</strong></div>}
    </section>
  );
}

function MonthlyCalendar({ workspace, month, selectedDate, referenceDate, onSelectDate }: {
  workspace: Workspace;
  month: string;
  selectedDate: string;
  referenceDate: string;
  onSelectDate: (date: string) => void;
}) {
  const calendar = getMonthCalendar(month);
  return (
    <section className="records-panel records-calendar" aria-labelledby="records-calendar-title">
      <header className="records-section-heading"><div><h2 id="records-calendar-title">학습 캘린더</h2><p>배경 농도는 해당 날짜의 팀 완료율을 나타냅니다.</p></div><span>{formatMonth(month)}</span></header>
      <div className="records-calendar-weekdays">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
      <div className="records-calendar-grid">
        {Array.from({ length: calendar.firstDay }, (_, index) => <span key={`blank-${index}`} aria-hidden="true" />)}
        {Array.from({ length: calendar.days }, (_, index) => index + 1).map((day) => {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const session = workspace.sessions[date]?.status === "active" ? workspace.sessions[date] : undefined;
          const rate = session ? getDashboardMetrics(workspace, session).submissionRate : null;
          const selected = selectedDate === date;
          const today = referenceDate === date;
          const label = `${formatDate(date, true)}, ${rate === null ? "학습 일정 없음" : `완료율 ${rate}%`}${today ? ", 오늘" : ""}${selected ? ", 선택됨" : ""}`;
          return (
            <button type="button" key={date} className={`${rate === null ? "no-data" : "has-data"} ${rate === 0 ? "zero-completion" : ""} ${selected ? "selected" : ""} ${today ? "today" : ""}`} onClick={() => onSelectDate(date)} aria-label={label} aria-pressed={selected} title={label} style={rate === null ? undefined : ({ "--records-heat": `${0.1 + rate * 0.0036}` } as CSSProperties)}>
              <strong>{day}</strong>{rate !== null ? <small>{rate}%</small> : null}
            </button>
          );
        })}
      </div>
      <div className="records-calendar-legend" aria-label="완료율 색상 범례"><span><i className="empty" />일정 없음</span><span>낮음 <i className="low" /><i className="medium" /><i className="high" /> 높음</span></div>
    </section>
  );
}

function SelectedDateSummary({ workspace, session, selectedDate, currentUserId }: {
  workspace: Workspace;
  session?: StudySession;
  selectedDate: string;
  currentUserId: string;
}) {
  if (!session) return (
    <section className="records-panel records-date-summary records-date-summary--empty" aria-labelledby="records-date-title">
      <CalendarX2 size={25} aria-hidden="true" /><h2 id="records-date-title">{formatDate(selectedDate, true)}</h2><strong>이 날에는 학습 일정이 없어요.</strong>
    </section>
  );

  const metrics = getDashboardMetrics(workspace, session);
  const progress = getMemberProgress(workspace, session);
  const mine = progress.find((entry) => entry.member.id === currentUserId);
  const submittedMembers = progress.filter((entry) => entry.completedItems > 0).length;
  const activeItems = session.items.filter((item) => item.status === "active");
  const meta = SESSION_TYPE_META[session.type];
  return (
    <section className="records-panel records-date-summary" aria-labelledby="records-date-title">
      <header><div><span className={`type-chip type-chip--${meta.tone}`}>{meta.label}</span><p>{formatDate(session.date, true)}</p><h2 id="records-date-title">{activeItems.map((item) => item.title).slice(0, 3).join(" · ") || "등록된 항목 없음"}</h2></div></header>
      <dl className="records-date-metrics">
        <div><dt>완료율</dt><dd>{metrics.submissionRate}%</dd></div>
        <div><dt>내 완료</dt><dd>{mine?.completedItems ?? 0} / {mine?.requiredItems ?? 0}</dd></div>
        <div><dt>팀 제출</dt><dd>{submittedMembers} / {progress.length}명</dd></div>
        <div><dt>학습 항목</dt><dd>{activeItems.length}개</dd></div>
      </dl>
      <Link href={APP_ROUTES.librarySession(session.date)} className="records-library-link">학습 세션 보기 <ChevronRight size={15} /></Link>
    </section>
  );
}

export function RecordsWorkspace() {
  const { workspace, currentUserId, referenceDate } = useWorkspace();
  const sessions = useMemo(() => Object.values(workspace.sessions).filter((session) => session.status === "active").sort((a, b) => a.date.localeCompare(b.date)), [workspace.sessions]);
  const initialDate = sessions.at(-1)?.date ?? referenceDate;
  const [view, setView] = useState<RecordsView>("week");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.slice(0, 7));
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  const weekDates = getWeekDates(selectedDate);
  const currentWeekDates = getWeekDates(referenceDate);
  const monthSessions = sessions.filter((session) => session.date.startsWith(`${selectedMonth}-`));
  const weekSessions = sessions.filter((session) => session.date >= weekDates[0] && session.date <= weekDates.at(-1)!);
  const scopedSessions = view === "week" ? weekSessions : monthSessions;
  const periodLabel = view === "week" ? formatWeekRange(weekDates) : formatMonth(selectedMonth);
  const selectedSession = workspace.sessions[selectedDate]?.status === "active" ? workspace.sessions[selectedDate] : undefined;
  const sessionMetrics = scopedSessions.map((session) => getDashboardMetrics(workspace, session));
  const averageCompletion = sessionMetrics.length ? Math.round(sessionMetrics.reduce((sum, metrics) => sum + metrics.submissionRate, 0) / sessionMetrics.length) : null;
  const totalSubmissions = sessionMetrics.reduce((sum, metrics) => sum + metrics.submittedItems, 0);
  const scoreboard = getScoreboard(workspace, scopedSessions);
  const myScore = scoreboard.find((score) => score.member.id === currentUserId);
  const currentPeriod = view === "week" ? weekDates[0] === currentWeekDates[0] : selectedMonth === referenceDate.slice(0, 7);
  const canMoveNext = view === "week" ? weekDates[0] < currentWeekDates[0] : selectedMonth < referenceDate.slice(0, 7);

  function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedMonth(date.slice(0, 7));
  }

  function changePeriod(amount: number) {
    if (view === "week") selectDate(moveDate(weekDates[0], amount * 7));
    else {
      const nextMonth = moveMonth(selectedMonth, amount);
      const available = sessions.filter((session) => session.date.startsWith(`${nextMonth}-`));
      setSelectedMonth(nextMonth);
      setSelectedDate((amount < 0 ? available.at(-1) : available[0])?.date ?? `${nextMonth}-01`);
    }
  }

  function changeView(nextView: RecordsView) {
    setView(nextView);
    if (nextView === "month") setSelectedMonth(selectedDate.slice(0, 7));
  }

  return (
    <div className="page-stack records-workspace">
      <header className="page-heading records-page-heading"><div><h1>학습 기록</h1><p>스터디의 학습 흐름과 참여 현황을 확인하세요.</p></div></header>

      <section className="records-controls" aria-label="기록 기간 설정">
        <div className="records-period-switch" role="group" aria-label="기록 기간 단위">
          <button type="button" aria-pressed={view === "week"} onClick={() => changeView("week")}><BarChart3 size={16} /> 주간</button>
          <button type="button" aria-pressed={view === "month"} onClick={() => changeView("month")}><CalendarRange size={16} /> 월간</button>
        </div>
        <div className="records-period-navigation">
          <button type="button" className="icon-button" onClick={() => changePeriod(-1)} aria-label={view === "week" ? "이전 주" : "이전 달"}><ChevronLeft size={18} /></button>
          <strong aria-live="polite">{periodLabel}</strong>
          <button type="button" className="icon-button" disabled={!canMoveNext} onClick={() => changePeriod(1)} aria-label={view === "week" ? "다음 주" : "다음 달"}><ChevronRight size={18} /></button>
        </div>
        <button type="button" className="button button--secondary button--small" disabled={currentPeriod} onClick={() => { selectDate(referenceDate); setSelectedMonth(referenceDate.slice(0, 7)); }}>{view === "week" ? "이번 주" : "이번 달"}</button>
      </section>

      <section className={`records-summary-grid ${WORKSPACE_SCORE_POLICY.enabled ? "records-summary-grid--scored" : ""}`} aria-label={`${periodLabel} 요약`}>
        <SummaryMetric icon={<BookOpenCheck size={19} />} value={averageCompletion === null ? "—" : `${averageCompletion}%`} label="팀 평균 완료율" />
        <SummaryMetric icon={<CalendarCheck2 size={19} />} value={`${scopedSessions.length}일`} label="학습한 날" />
        <SummaryMetric icon={<Users size={19} />} value={`${totalSubmissions}건`} label="완료 항목" />
        {WORKSPACE_SCORE_POLICY.enabled ? <SummaryMetric icon={<Medal size={19} />} value={`${myScore?.points ?? 0}P`} label="내 점수" detail={`${myScore?.primaryCount ?? 0}건 1차 · ${myScore?.secondaryCount ?? 0}건 2차`} onClick={() => setIsScoreModalOpen(true)} /> : null}
      </section>
      <p className="records-summary-context">선택한 기간의 일정과 팀 필수 항목을 기준으로 계산합니다.</p>

      <div key={`${view}-${periodLabel}`} className="motion-content-swap">
        {view === "week" ? (
          <div className="records-weekly-layout">
          <WeeklyChart workspace={workspace} dates={weekDates} selectedDate={selectedDate} onSelectDate={selectDate} />
          <TeamLearningStatus workspace={workspace} sessions={weekSessions} currentUserId={currentUserId} periodLabel={periodLabel} />
          </div>
        ) : monthSessions.length ? (
          <div className="records-monthly-layout">
          <MonthlyCalendar workspace={workspace} month={selectedMonth} selectedDate={selectedDate} referenceDate={referenceDate} onSelectDate={selectDate} />
          <SelectedDateSummary workspace={workspace} session={selectedSession} selectedDate={selectedDate} currentUserId={currentUserId} />
          </div>
        ) : <section className="records-period-empty records-period-empty--standalone"><CalendarX2 size={28} /><strong>이 기간에는 학습 기록이 없어요.</strong></section>}
      </div>

      {isScoreModalOpen ? <Modal title="점수 상세" description={periodLabel} onClose={() => setIsScoreModalOpen(false)} size="large">
        <div className="records-score-dialog">
          <section className="records-score-summary" aria-label="내 점수"><span><Medal size={20} /></span><div><small>내 점수</small><strong>{myScore?.points ?? 0}P</strong></div>{WORKSPACE_SCORE_POLICY.rankingEnabled ? <em>팀 {myScore?.rank ?? "-"}위</em> : null}</section>
          <section className="records-score-breakdown" aria-labelledby="score-breakdown-title"><h3 id="score-breakdown-title">점수 구성</h3><dl>
            <div><dt>1차 마감 내 제출</dt><dd>{myScore?.primaryCount ?? 0}건 × +{SCORE_RULES.primary}P</dd></div>
            <div><dt>2차 마감 내 제출</dt><dd>{myScore?.secondaryCount ?? 0}건 × +{SCORE_RULES.secondary}P</dd></div>
            <div><dt>점수 없는 항목</dt><dd>{myScore?.missedCount ?? 0}건 × 0P</dd></div>
          </dl></section>
          {WORKSPACE_SCORE_POLICY.rankingEnabled ? <section className="records-score-team" aria-labelledby="score-team-title"><header><h3 id="score-team-title">팀 점수 현황</h3><span>{scoreboard.length}명</span></header><ol>{scoreboard.map((score) => <li key={score.member.id} className={score.member.id === currentUserId ? "is-me" : ""}><span>{score.rank}</span><Avatar member={score.member} /><strong>{score.member.displayName}{score.member.id === currentUserId ? " (나)" : ""}</strong><small>1차 {score.primaryCount}건 · 2차 {score.secondaryCount}건</small><em>{score.points}P</em></li>)}</ol></section> : null}
        </div>
      </Modal> : null}
    </div>
  );
}
