"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  FileText,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Drawer } from "@/components/ui/Drawer";
import {
  listNotifications,
  markNotificationRead,
  type InAppNotification,
} from "@/lib/api/services/workspaceApi";
import {
  filterWorkspaceNotifications,
  formatActivityTimestamp,
  getActivityTodos,
  getTodoActionCount,
} from "@/lib/domain/activity";

type InboxTab = "todo" | "news";
const ACTIVITY_NOTIFICATION_UPDATED = "study:activity-notification-updated";

const demoNotifications: InAppNotification[] = [
  {
    id: "demo-review",
    type: "SUBMISSION_REVIEW",
    title: "새 리뷰가 도착했어요",
    message: "박민지님이 제출에 리뷰를 남겼습니다.",
    actionPath: "/library/sessions/2026-07-23",
    createdAt: "2026-07-23T21:35:00+09:00",
  },
  {
    id: "demo-submission",
    type: "SUBMISSION_UPDATED",
    title: "팀원이 학습을 제출했어요",
    message: "이준호님이 오늘 학습 2개를 완료했습니다.",
    actionPath: "/library/sessions/2026-07-23",
    readAt: "2026-07-23T21:42:00+09:00",
    createdAt: "2026-07-23T21:30:00+09:00",
  },
];

export function ActivityInbox({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const router = useRouter();
  const { mode } = useAuth();
  const { workspace, currentUserId, referenceDate } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>("todo");
  const [notifications, setNotifications] = useState<InAppNotification[]>(
    mode === "demo" ? demoNotifications : [],
  );
  const [loading, setLoading] = useState(mode !== "demo");
  const [loadError, setLoadError] = useState(false);
  const todoTabRef = useRef<HTMLButtonElement>(null);
  const newsTabRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const timeZone = workspace.settings.timezone || "Asia/Seoul";
  const now = useMemo(
    () => mode === "demo" ? new Date(`${referenceDate}T21:00:00+09:00`) : new Date(),
    [mode, referenceDate],
  );
  const todoItems = useMemo(
    () => getActivityTodos(workspace, currentUserId, referenceDate, now),
    [currentUserId, now, referenceDate, workspace],
  );
  const todoCount = getTodoActionCount(todoItems);
  const workspaceNotifications = useMemo(
    () => mode === "demo"
      ? notifications
      : filterWorkspaceNotifications(notifications, workspace.id),
    [mode, notifications, workspace.id],
  );
  const unreadCount = workspaceNotifications.filter((notification) => !notification.readAt).length;
  const badgeCount = todoCount + unreadCount;

  const load = useCallback((signal?: AbortSignal) => {
    if (mode === "demo") return Promise.resolve();
    setLoading(true);
    setLoadError(false);
    return listNotifications(signal)
      .then(setNotifications)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    if (mode === "demo") return;
    const controller = new AbortController();
    void listNotifications(controller.signal)
      .then((items) => {
        setNotifications(items);
        setLoadError(false);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [mode, workspace.id]);

  useEffect(() => {
    function syncNotification(event: Event) {
      const updated = (event as CustomEvent<InAppNotification>).detail;
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
    }
    window.addEventListener(ACTIVITY_NOTIFICATION_UPDATED, syncNotification);
    return () => window.removeEventListener(ACTIVITY_NOTIFICATION_UPDATED, syncNotification);
  }, []);

  async function read(notification: InAppNotification) {
    if (notification.readAt) return;
    if (mode === "demo") {
      const updated = { ...notification, readAt: now.toISOString() };
      window.dispatchEvent(new CustomEvent(ACTIVITY_NOTIFICATION_UPDATED, { detail: updated }));
      return;
    }
    const updated = await markNotificationRead(notification.id);
    window.dispatchEvent(new CustomEvent(ACTIVITY_NOTIFICATION_UPDATED, { detail: updated }));
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "todo" ? "news" : "todo";
    setTab(next);
    (next === "todo" ? todoTabRef : newsTabRef).current?.focus();
  }

  function iconFor(notification: InAppNotification) {
    if (notification.type.includes("DOCUMENT")) return <FileText size={18} />;
    if (notification.type.includes("SYNC")) return <RefreshCw size={18} />;
    return <MessageCircle size={18} />;
  }

  return (
    <>
      <button
        type="button"
        className={`activity-inbox-trigger activity-inbox-trigger--${variant}`}
        aria-label={`활동함 열기${badgeCount ? `, 미처리 항목 ${badgeCount}개` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={19} />
        {variant === "sidebar" ? <span>활동함</span> : null}
        {badgeCount ? <em aria-hidden="true">{badgeCount > 9 ? "9+" : badgeCount}</em> : null}
      </button>

      {open ? (
        <Drawer title="활동함" onClose={close}>
          <div className="activity-inbox-tabs" role="tablist" aria-label="활동함 분류">
            <button
              ref={todoTabRef}
              id="activity-tab-todo"
              type="button"
              role="tab"
              aria-selected={tab === "todo"}
              aria-controls="activity-panel-todo"
              tabIndex={tab === "todo" ? 0 : -1}
              aria-label={`해야 할 일, 미처리 필수 학습 ${todoCount}개`}
              onClick={() => setTab("todo")}
              onKeyDown={handleTabKeyDown}
            >
              해야 할 일 <span>{todoCount}</span>
            </button>
            <button
              ref={newsTabRef}
              id="activity-tab-news"
              type="button"
              role="tab"
              aria-selected={tab === "news"}
              aria-controls="activity-panel-news"
              tabIndex={tab === "news" ? 0 : -1}
              aria-label={`새 소식, 읽지 않은 항목 ${unreadCount}개`}
              onClick={() => setTab("news")}
              onKeyDown={handleTabKeyDown}
            >
              새 소식 <span>{unreadCount}</span>
            </button>
          </div>

          <div
            key={tab}
            id={`activity-panel-${tab}`}
            className="activity-inbox-content motion-content-swap"
            role="tabpanel"
            aria-labelledby={`activity-tab-${tab}`}
          >
            {tab === "todo" ? (
              todoItems.length ? todoItems.map((item) => (
                <Link
                  key={item.session.date}
                  className="activity-inbox-item"
                  href={item.href}
                  aria-label={`${item.session.title}, ${item.missingCount}개 남음, ${item.deadlineLabel}`}
                  onClick={close}
                >
                  <span className="activity-inbox-icon"><CalendarClock size={18} /></span>
                  <span>
                    <strong>{item.session.title}</strong>
                    <p>{item.missingTitles.join(", ")} · {item.missingCount}개 남음</p>
                    <small className={`activity-inbox-deadline is-${item.deadlineTone}`}>{item.deadlineLabel}</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              )) : (
                <EmptyInbox
                  icon={<CheckCheck size={24} />}
                  title="해야 할 일이 없어요."
                  description="현재 처리해야 할 학습이나 제출이 없습니다."
                />
              )
            ) : loading ? (
              <p className="activity-inbox-loading" role="status" aria-live="polite">새 소식을 불러오는 중…</p>
            ) : loadError ? (
              <div className="activity-inbox-empty" role="alert">
                <Bell size={24} />
                <strong>새 소식을 불러오지 못했어요.</strong>
                <p>잠시 후 다시 시도해 주세요.</p>
                <button className="button button--secondary button--small" type="button" onClick={() => void load()}>다시 시도</button>
              </div>
            ) : workspaceNotifications.length ? workspaceNotifications.map((notification) => {
              const unread = !notification.readAt;
              const content = (
                <>
                  <span className="activity-inbox-icon">{iconFor(notification)}</span>
                  <span>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{formatActivityTimestamp(notification.createdAt, timeZone, now)}</small>
                    {unread ? <span className="sr-only">읽지 않음</span> : null}
                  </span>
                  <span className="activity-inbox-item__end">
                    {unread ? <i className="activity-inbox-unread" aria-hidden="true" /> : null}
                    {notification.actionPath ? <ChevronRight size={17} aria-hidden="true" /> : null}
                  </span>
                </>
              );
              return notification.actionPath ? (
                <Link
                  key={notification.id}
                  className={`activity-inbox-item ${unread ? "is-unread" : "is-read"}`}
                  href={notification.actionPath}
                  aria-label={`${notification.title}, ${notification.message}, ${formatActivityTimestamp(notification.createdAt, timeZone, now)}${unread ? ", 읽지 않음" : ""}`}
                  onClick={(event) => {
                    if (!unread) {
                      close();
                      return;
                    }
                    event.preventDefault();
                    void read(notification).catch(() => undefined).then(() => {
                      close();
                      router.push(notification.actionPath!);
                    });
                  }}
                >{content}</Link>
              ) : (
                <button
                  key={notification.id}
                  type="button"
                  className={`activity-inbox-item ${unread ? "is-unread" : "is-read"}`}
                  aria-label={`${notification.title}, ${notification.message}${unread ? ", 읽지 않음" : ""}`}
                  onClick={() => void read(notification)}
                >{content}</button>
              );
            }) : (
              <EmptyInbox
                icon={<Bell size={24} />}
                title="새로운 소식이 없어요."
                description="팀의 제출, 리뷰, 일정 변경 소식이 이곳에 표시됩니다."
              />
            )}
            {tab === "news" && workspaceNotifications.length >= 50 ? (
              <p className="activity-inbox-limit">최근 소식 50개를 표시합니다.</p>
            ) : null}
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function EmptyInbox({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="activity-inbox-empty">{icon}<strong>{title}</strong><p>{description}</p></div>;
}
