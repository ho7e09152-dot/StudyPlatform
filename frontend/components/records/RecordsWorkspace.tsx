"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Medal,
  Trophy,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  REFERENCE_DATE,
  SESSION_TYPE_META,
  SUBMISSION_TYPE_LABEL,
} from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/format";
import {
  getDashboardMetrics,
  getMemberProgress,
  getScoreboard,
  SCORE_RULES,
} from "@/lib/domain/metrics";
import type { StudySession, Workspace } from "@/lib/domain/types";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
type RecordsView = "day" | "month";

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

function RecordDetail({
  workspace,
  session,
  selectedDate,
}: {
  workspace: Workspace;
  session?: StudySession;
  selectedDate: string;
}) {
  if (!session) {
    return (
      <section
        className="surface record-detail record-detail--empty"
        aria-labelledby="record-detail-title"
      >
        <CalendarX2 size={24} aria-hidden="true" />
        <h2 id="record-detail-title">{formatDate(selectedDate, true)}</h2>
        <h3>등록된 학습 기록이 없습니다</h3>
        <p>다른 날짜로 이동하거나 월별 보기에서 기록이 있는 날짜를 선택해 주세요.</p>
      </section>
    );
  }

  const activeItems = session.items
    .filter((item) => item.status === "active")
    .sort((a, b) => a.order - b.order);

  return (
    <section className="surface record-detail" aria-labelledby="record-detail-title">
      <span className={`type-chip type-chip--${SESSION_TYPE_META[session.type].tone}`}>
        {SESSION_TYPE_META[session.type].label}
      </span>
      <h2 id="record-detail-title">{formatDate(session.date, true)}</h2>
      <h3>{session.title}</h3>
      <p>{session.description}</p>
      <div className="record-detail__items" aria-label="학습 항목">
        <header>
          <strong>학습 항목</strong>
          <span>{activeItems.length}개</span>
        </header>
        {activeItems.map((item) => (
          <article key={item.id}>
            <span className="record-detail__item-order">{item.order}</span>
            <span>
              <strong>{item.title}</strong>
              <small>
                {item.source ? `${item.source} · ` : ""}
                {SUBMISSION_TYPE_LABEL[item.submitType]} 제출
              </small>
            </span>
            <em>{item.required ? "필수" : "선택"}</em>
          </article>
        ))}
      </div>
      <div className="record-detail__members">
        {getMemberProgress(workspace, session).map((progress) => (
          <div key={progress.member.id}>
            <Avatar member={progress.member} size="small" />
            <span>
              <strong>{progress.member.displayName}</strong>
              <small>
                {progress.completedItems}/{progress.requiredItems} 완료
              </small>
            </span>
            <strong>{progress.completionRate}%</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatCard({
  icon,
  value,
  label,
  detail,
  className,
  onClick,
  actionLabel,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  detail: string;
  className?: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <span>{icon}</span>
      <strong>{value}</strong>
      <p>{label}</p>
      <small>{detail}</small>
    </>
  );

  return (
    <article
      className={`${className ?? ""} ${onClick ? "record-stat-card--interactive" : ""}`.trim()}
    >
      {onClick ? (
        <button
          type="button"
          className="record-stat-card__trigger"
          onClick={onClick}
          aria-label={actionLabel ?? `${label} 상세 보기`}
        >
          {content}
          <span className="record-stat-card__open">
            순위 보기 <ChevronRight size={13} aria-hidden="true" />
          </span>
        </button>
      ) : (
        content
      )}
    </article>
  );
}

export function RecordsWorkspace() {
  const { workspace, currentUserId } = useWorkspace();
  const sessions = useMemo(
    () =>
      Object.values(workspace.sessions)
        .filter((session) => session.status === "active")
        .sort((a, b) => a.date.localeCompare(b.date)),
    [workspace.sessions],
  );
  const initialDate = sessions.at(-1)?.date ?? REFERENCE_DATE;
  const [view, setView] = useState<RecordsView>("month");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedMonth, setSelectedMonth] = useState(initialDate.slice(0, 7));
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);

  const selected =
    workspace.sessions[selectedDate]?.status === "active"
      ? workspace.sessions[selectedDate]
      : undefined;
  const monthSessions = useMemo(
    () => sessions.filter((session) => session.date.startsWith(`${selectedMonth}-`)),
    [selectedMonth, sessions],
  );
  const scopedSessions = view === "day" ? (selected ? [selected] : []) : monthSessions;
  const scoreboard = getScoreboard(workspace, scopedSessions);
  const myScore = scoreboard.find(
    (score) => score.member.id === currentUserId,
  );
  const sessionMetrics = scopedSessions.map((session) => ({
    session,
    metrics: getDashboardMetrics(workspace, session),
  }));
  const average = sessionMetrics.length
    ? Math.round(
        sessionMetrics.reduce((total, item) => total + item.metrics.submissionRate, 0) /
          sessionMetrics.length,
      )
    : 0;
  const totalSubmissions = sessionMetrics.reduce(
    (total, item) => total + item.metrics.submittedItems,
    0,
  );
  const best = sessionMetrics
    .slice()
    .sort((a, b) => b.metrics.submissionRate - a.metrics.submissionRate)[0];
  const selectedMetrics = selected
    ? getDashboardMetrics(workspace, selected)
    : undefined;
  const periodLabel =
    view === "day" ? formatDate(selectedDate, true) : formatMonth(selectedMonth);
  const periodCaption = view === "day" ? "일간 기록" : "월간 요약";
  const isCurrentPeriod =
    view === "day"
      ? selectedDate === REFERENCE_DATE
      : selectedMonth === REFERENCE_DATE.slice(0, 7);
  const periodKey = view === "day" ? selectedDate : selectedMonth;
  const calendar = getMonthCalendar(selectedMonth);
  const weekDates = getWeekDates(selectedDate);
  const weekLabel = `${Number(weekDates[0].slice(5, 7))}.${Number(weekDates[0].slice(8))} – ${Number(weekDates[6].slice(5, 7))}.${Number(weekDates[6].slice(8))}`;

  const memberAverages = workspace.members.map((member) => {
    const rates = scopedSessions.map(
      (session) =>
        getMemberProgress(workspace, session).find(
          (progress) => progress.member.id === member.id,
        )?.completionRate ?? 0,
    );
    return {
      member,
      average: rates.length
        ? Math.round(rates.reduce((total, rate) => total + rate, 0) / rates.length)
        : 0,
    };
  });

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedMonth(date.slice(0, 7));
  };

  const changeView = (nextView: RecordsView) => {
    setView(nextView);
    if (nextView === "month") {
      setSelectedMonth(selectedDate.slice(0, 7));
    }
  };

  const changePeriod = (amount: number) => {
    if (view === "day") {
      selectDate(moveDate(selectedDate, amount));
      return;
    }

    const nextMonth = moveMonth(selectedMonth, amount);
    const available = sessions.filter((session) =>
      session.date.startsWith(`${nextMonth}-`),
    );
    setSelectedMonth(nextMonth);
    setSelectedDate(
      (amount < 0 ? available.at(-1) : available[0])?.date ?? `${nextMonth}-01`,
    );
  };

  const goToToday = () => {
    selectDate(REFERENCE_DATE);
  };

  return (
    <div className="page-stack">
      <header className="page-heading records-page-heading">
        <div>
          <p className="eyebrow">REPOSITORY-DERIVED ANALYTICS</p>
          <h1>학습 기록</h1>
          <p>고정 통계 없이 실제 session.yml과 멤버 제출 파일에서 계산합니다.</p>
        </div>

        <div className="records-toolbar" aria-label="기록 조회 컨트롤">
          <div
            className={`records-view-toggle records-view-toggle--${view}`}
            role="group"
            aria-label="기록 보기 방식"
          >
            <button
              type="button"
              className={view === "day" ? "active" : undefined}
              aria-pressed={view === "day"}
              onClick={() => changeView("day")}
            >
              <CalendarDays size={15} aria-hidden="true" />
              <span>일별</span>
            </button>
            <button
              type="button"
              className={view === "month" ? "active" : undefined}
              aria-pressed={view === "month"}
              onClick={() => changeView("month")}
            >
              <CalendarRange size={15} aria-hidden="true" />
              <span>월별</span>
            </button>
          </div>
          <span className="records-toolbar-divider" aria-hidden="true" />
          <div className="records-period-nav">
            <button
              type="button"
              className="icon-button"
              aria-label={view === "day" ? "이전 날짜" : "이전 달"}
              onClick={() => changePeriod(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="records-period-title" aria-live="polite">
              <small>{periodCaption}</small>
              <strong>{periodLabel}</strong>
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label={view === "day" ? "다음 날짜" : "다음 달"}
              onClick={() => changePeriod(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            className={`records-today-button ${isCurrentPeriod ? "current" : ""}`}
            aria-current={isCurrentPeriod ? "date" : undefined}
            onClick={goToToday}
          >
            <CalendarCheck2 size={14} aria-hidden="true" />
            오늘
          </button>
        </div>
      </header>

      <section
        key={`stats-${periodKey}`}
        className="record-stat-grid record-stat-grid--scored record-switch-animation"
        aria-label={`${periodLabel} 학습 기록 요약`}
      >
        <StatCard
          icon={<BookOpenCheck size={19} />}
          value={`${average}%`}
          label="평균 제출률"
          detail={periodLabel}
        />
        <StatCard
          icon={<CalendarCheck2 size={19} />}
          value={`${scopedSessions.length}일`}
          label="학습한 날"
          detail={view === "day" ? (selected ? "학습 일정 있음" : "학습 일정 없음") : periodLabel}
        />
        <StatCard
          icon={<Users size={19} />}
          value={`${totalSubmissions}건`}
          label="총 제출 수"
          detail="필수 활성 항목 기준"
        />
        <StatCard
          icon={<Trophy size={19} />}
          value={
            view === "day"
              ? `${selectedMetrics?.completedMembers ?? 0}명`
              : `${best?.metrics.submissionRate ?? 0}%`
          }
          label={view === "day" ? "완료 멤버" : "최고 완료일"}
          detail={
            view === "day"
              ? `전체 ${workspace.members.length}명`
              : best
                ? formatDate(best.session.date)
                : "기록 없음"
          }
        />
        <StatCard
          className="record-score-card"
          icon={<Medal size={19} />}
          value={`${myScore?.points ?? 0}P`}
          label="내 현재 점수"
          detail={`${myScore?.primaryCount ?? 0}건 1차 · ${myScore?.secondaryCount ?? 0}건 2차`}
          onClick={() => setIsScoreModalOpen(true)}
          actionLabel={`${periodLabel} 내 점수와 멤버 순위 보기`}
        />
      </section>

      {isScoreModalOpen ? (
        <Modal
          title="점수 상세"
          description={`${periodLabel} 마감 단계와 필수 항목 제출 시각을 기준으로 계산한 점수입니다.`}
          onClose={() => setIsScoreModalOpen(false)}
          size="large"
        >
          <div className="score-modal-body">
            <section className="score-modal-summary" aria-label="내 점수 요약">
              <span className="score-modal-summary__icon">
                <Medal size={22} aria-hidden="true" />
              </span>
              <div>
                <small>{periodLabel}</small>
                <strong>{myScore?.points ?? 0}P</strong>
                <p>
                  1차 {myScore?.primaryCount ?? 0}건 · 2차{" "}
                  {myScore?.secondaryCount ?? 0}건
                </p>
              </div>
              <span className="score-modal-summary__rank">
                {myScore?.rank ?? "-"}위
              </span>
            </section>

            <div className="score-rule" aria-label="점수 계산 기준">
              <span><i className="primary" />1차 마감 내 <strong>+{SCORE_RULES.primary}P</strong></span>
              <span><i className="secondary" />2차 마감 내 <strong>+{SCORE_RULES.secondary}P</strong></span>
              <span><i className="missed" />미제출·기한 초과 <strong>0P</strong></span>
            </div>

            <div className="score-modal-ranking-heading">
              <div>
                <p className="eyebrow">POINT RANKING</p>
                <h3>멤버 점수 순위</h3>
              </div>
              <span>{workspace.members.length}명</span>
            </div>

            <ol className="score-ranking__list">
              {scoreboard.map((score) => {
                const scoreRate = score.maxPoints
                  ? Math.round((score.points / score.maxPoints) * 100)
                  : 0;
                const isMe = score.member.id === currentUserId;
                return (
                  <li key={score.member.id} className={isMe ? "is-me" : undefined}>
                    <span className={`score-rank score-rank--${Math.min(score.rank, 3)}`}>
                      {score.rank}
                    </span>
                    <Avatar member={score.member} />
                    <span className="score-member">
                      <strong>
                        {score.member.displayName}
                        {isMe ? <em>나</em> : null}
                      </strong>
                      <small>
                        1차 {score.primaryCount}건 · 2차 {score.secondaryCount}건
                      </small>
                    </span>
                    <span
                      className="score-bar"
                      role="progressbar"
                      aria-label={`${score.member.displayName} 점수`}
                      aria-valuemin={0}
                      aria-valuemax={score.maxPoints}
                      aria-valuenow={score.points}
                    >
                      <i
                        style={{
                          width: `${scoreRate}%`,
                          backgroundColor: score.member.color,
                        }}
                      />
                    </span>
                    <strong className="score-points">
                      {score.points}P
                      <small>/{score.maxPoints}P</small>
                    </strong>
                  </li>
                );
              })}
            </ol>
          </div>
        </Modal>
      ) : null}

      <div
        key={`overview-${view}-${periodKey}`}
        className="records-columns record-switch-animation"
      >
        <section className="surface weekly-chart" aria-labelledby="weekly-title">
          <header className="section-heading">
            <div>
              <p className="eyebrow">WEEKLY</p>
              <h2 id="weekly-title">선택 주 제출률</h2>
            </div>
            <span>{weekLabel}</span>
          </header>
          <div className="bar-chart">
            {weekDates.map((date) => {
              const day = Number(date.slice(8));
              const session =
                workspace.sessions[date]?.status === "active"
                  ? workspace.sessions[date]
                  : undefined;
              const rate = session
                ? getDashboardMetrics(workspace, session).submissionRate
                : 0;
              return (
                <button
                  type="button"
                  key={date}
                  className={selectedDate === date ? "active" : undefined}
                  onClick={() => selectDate(date)}
                  aria-label={`${formatDate(date, true)} ${session ? `${rate}%` : "기록 없음"}`}
                >
                  <span>{session ? `${rate}%` : "—"}</span>
                  <i style={{ height: `${session ? Math.max(10, rate) : 3}%` }} />
                  <strong>{weekdays[dateFromKey(date).getUTCDay()]}</strong>
                  <small>{day}</small>
                </button>
              );
            })}
          </div>
        </section>

        <section className="surface member-averages" aria-labelledby="average-title">
          <header className="section-heading">
            <div>
              <p className="eyebrow">MEMBERS</p>
              <h2 id="average-title">멤버별 평균</h2>
            </div>
            <span>{view === "day" ? "선택 날짜" : "선택 월"}</span>
          </header>
          {memberAverages.map(({ member, average: rate }) => (
            <div className="average-row" key={member.id}>
              <Avatar member={member} />
              <span>
                <strong>{member.displayName}</strong>
                <small>{member.fileName}</small>
              </span>
              <ProgressBar value={rate} color={member.color} label={`${member.displayName} 평균`} />
              <strong>{rate}%</strong>
            </div>
          ))}
        </section>
      </div>

      <div
        key={`detail-${view}-${selectedDate}`}
        className="records-bottom record-switch-animation"
      >
        <section className="surface calendar-card" aria-labelledby="calendar-title">
          <header className="section-heading">
            <div>
              <p className="eyebrow">{view === "day" ? "DATE PICKER" : "MONTHLY"}</p>
              <h2 id="calendar-title">{formatMonth(selectedMonth)}</h2>
            </div>
            <span>
              {view === "day" ? "날짜를 선택해 일별 기록 이동" : "날짜를 선택해 상세 보기"}
            </span>
          </header>
          <div className="calendar-weekdays">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: calendar.firstDay }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: calendar.days }, (_, index) => index + 1).map(
              (day) => {
                const date = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const session =
                  workspace.sessions[date]?.status === "active"
                    ? workspace.sessions[date]
                    : undefined;
                const rate = session
                  ? getDashboardMetrics(workspace, session).submissionRate
                  : null;
                return (
                  <button
                    key={date}
                    type="button"
                    className={`${selectedDate === date ? "selected" : ""} ${rate === null ? "empty" : ""}`}
                    onClick={() => selectDate(date)}
                    aria-label={`${formatDate(date, true)} ${rate === null ? "기록 없음" : `${rate}%`}`}
                    style={
                      rate === null
                        ? undefined
                        : ({ "--heat": `${0.08 + rate / 125}` } as CSSProperties)
                    }
                  >
                    {day}
                    {rate !== null ? <small>{rate}%</small> : null}
                  </button>
                );
              },
            )}
          </div>
        </section>

        <RecordDetail
          workspace={workspace}
          session={selected}
          selectedDate={selectedDate}
        />
      </div>
    </div>
  );
}
