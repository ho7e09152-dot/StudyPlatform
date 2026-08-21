import type { InAppNotification } from "@/lib/api/services/workspaceApi";
import type { StudySession, Workspace } from "@/lib/domain/types";
import { getDateKeyInTimeZone } from "@/lib/domain/format";
import { getActiveRequiredItems, getSubmissionKey } from "@/lib/domain/metrics";
import { APP_ROUTES } from "@/lib/routes";

export interface ActivityTodo {
  session: StudySession;
  missingTitles: string[];
  missingCount: number;
  deadlineLabel: string;
  deadlineTone: "neutral" | "warning" | "danger";
  href: string;
}

export function getActivityTodos(
  workspace: Workspace,
  currentUserId: string,
  referenceDate: string,
  now = new Date(),
): ActivityTodo[] {
  return Object.values(workspace.sessions)
    .filter((session) => session.status === "active" && session.date <= referenceDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((session) => {
      const requiredItems = getActiveRequiredItems(session);
      const file = workspace.submissions[getSubmissionKey(session.folder, currentUserId)];
      const missing = requiredItems.filter(
        (item) => !file?.submissions.some((submission) => submission.itemId === item.id),
      );
      if (!missing.length) return [];
      const deadline = getNearestDeadline(session, missing, now, workspace.settings.timezone);
      return [{
        session,
        missingTitles: missing.map((item) => item.title),
        missingCount: missing.length,
        deadlineLabel: deadline.label,
        deadlineTone: deadline.tone,
        href: session.date === referenceDate ? "/today" : APP_ROUTES.scheduleDetail(session.date),
      }];
    });
}

export function getTodoActionCount(items: ActivityTodo[]) {
  return items.reduce((total, item) => total + item.missingCount, 0);
}

export function filterWorkspaceNotifications(
  notifications: InAppNotification[],
  workspaceId: string,
) {
  return notifications.filter((notification) => notification.workspaceId === workspaceId);
}

export function formatActivityTimestamp(
  value: string,
  timeZone = "Asia/Seoul",
  now = new Date(),
) {
  const date = new Date(value);
  const dateKey = getDateKeyInTimeZone(date, timeZone);
  const todayKey = getDateKeyInTimeZone(now, timeZone);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getDateKeyInTimeZone(yesterday, timeZone);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (dateKey === todayKey) return `오늘 ${time}`;
  if (dateKey === yesterdayKey) return `어제 ${time}`;

  const sameYear = dateKey.slice(0, 4) === todayKey.slice(0, 4);
  const calendarDate = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(date);
  return `${calendarDate} ${time}`;
}

function getNearestDeadline(
  session: StudySession,
  missingItems: StudySession["items"],
  now: Date,
  timeZone: string,
) {
  const deadlines = missingItems.flatMap((item) => [
    item.deadline ?? session.deadline,
    item.secondaryDeadline ?? session.secondaryDeadline,
  ])
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .sort((a, b) => a.getTime() - b.getTime());
  const nearest = deadlines.find((deadline) => deadline.getTime() >= now.getTime());
  if (!nearest) return { label: "마감 지남", tone: "danger" as const };

  const remaining = nearest.getTime() - now.getTime();
  const deadlineDate = getDateKeyInTimeZone(nearest, timeZone);
  const today = getDateKeyInTimeZone(now, timeZone);
  const tomorrow = getDateKeyInTimeZone(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(nearest);
  const prefix = deadlineDate === today
    ? "오늘"
    : deadlineDate === tomorrow
      ? "내일"
      : new Intl.DateTimeFormat("ko-KR", { timeZone, month: "long", day: "numeric" }).format(nearest);
  return {
    label: `${prefix} ${time} 마감`,
    tone: remaining <= 24 * 60 * 60 * 1000 ? "warning" as const : "neutral" as const,
  };
}
