"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import {
  listNotifications,
  markNotificationRead,
  type InAppNotification,
} from "@/lib/api/services/workspaceApi";
import { formatDate } from "@/lib/domain/format";
import { getActiveRequiredItems, getSubmissionKey } from "@/lib/domain/metrics";

type InboxTab = "todo" | "news";

const demoNotifications: InAppNotification[] = [
  {
    id: "demo-review",
    type: "SUBMISSION_REVIEW_CREATED",
    title: "새 리뷰가 도착했어요",
    message: "박민지님이 제출에 리뷰를 남겼습니다.",
    actionPath: "/today",
    createdAt: "2026-07-23T21:35:00+09:00",
  },
  {
    id: "demo-submission",
    type: "SUBMISSION_UPDATED",
    title: "팀원이 학습을 제출했어요",
    message: "이준호님이 오늘 학습 2개를 완료했습니다.",
    actionPath: "/today",
    readAt: "2026-07-23T21:42:00+09:00",
    createdAt: "2026-07-23T21:30:00+09:00",
  },
];

export function ActivityInbox({ variant = "sidebar" }: { variant?: "sidebar" | "mobile" }) {
  const { mode } = useAuth();
  const { workspace, currentUserId, referenceDate } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<InboxTab>("todo");
  const [notifications, setNotifications] = useState<InAppNotification[]>(
    mode === "demo" ? demoNotifications : [],
  );
  const [loading, setLoading] = useState(false);

  const todoItems = useMemo(() => {
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
        return [{ session, missing }];
      });
  }, [currentUserId, referenceDate, workspace]);

  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const badgeCount = todoItems.length + unreadCount;

  function handleOpen() {
    setOpen(true);
    if (mode === "demo") return;
    setLoading(true);
    void listNotifications()
      .then(setNotifications)
      .finally(() => setLoading(false));
  }

  async function read(notification: InAppNotification) {
    if (notification.readAt) return;
    if (mode === "demo") {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
      return;
    }
    const updated = await markNotificationRead(notification.id);
    setNotifications((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  const inboxLayer = open ? (
    <div className="activity-inbox-layer">
      <button className="activity-inbox-scrim" type="button" aria-label="활동함 닫기" onClick={() => setOpen(false)} />
      <aside className="activity-inbox-panel" role="dialog" aria-modal="true" aria-labelledby="activity-inbox-title">
        <header>
          <div>
            <p className="eyebrow">ACTIVITY</p>
            <h2 id="activity-inbox-title">활동함</h2>
          </div>
          <button className="icon-button" type="button" aria-label="활동함 닫기" onClick={() => setOpen(false)}><X size={20} /></button>
        </header>

        <div className="activity-inbox-tabs" role="tablist" aria-label="활동함 분류">
          <button type="button" role="tab" aria-selected={tab === "todo"} onClick={() => setTab("todo")}>해야 할 일 <span>{todoItems.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "news"} onClick={() => setTab("news")}>새 소식 <span>{unreadCount}</span></button>
        </div>

        <div className="activity-inbox-content">
          {tab === "todo" ? (
            todoItems.length ? todoItems.map(({ session, missing }) => (
              <Link
                key={session.date}
                className="activity-inbox-item"
                href={session.date === referenceDate ? "/today" : "/schedule"}
                onClick={() => setOpen(false)}
              >
                <span className="activity-inbox-icon"><CalendarClock size={18} /></span>
                <span>
                  <small>{formatDate(session.date, true)}</small>
                  <strong>{session.title}</strong>
                  <p>{missing.map((item) => item.title).join(", ")} · {missing.length}개 남음</p>
                </span>
                <ChevronRight size={17} />
              </Link>
            )) : <EmptyInbox icon={<CheckCheck size={24} />} title="밀린 학습이 없습니다" description="제출이 필요한 일정이 생기면 여기에서 바로 찾을 수 있어요." />
          ) : loading ? (
            <p className="activity-inbox-loading">새 소식을 불러오는 중…</p>
          ) : notifications.length ? notifications.map((notification) => {
            const content = (
              <>
                <span className="activity-inbox-icon"><MessageCircle size={18} /></span>
                <span>
                  <small>{new Date(notification.createdAt).toLocaleString("ko-KR")}</small>
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                </span>
                {!notification.readAt ? <i aria-label="읽지 않음" /> : null}
              </>
            );
            return notification.actionPath ? (
              <Link
                key={notification.id}
                className={`activity-inbox-item ${notification.readAt ? "is-read" : ""}`}
                href={notification.actionPath}
                onClick={() => { void read(notification); setOpen(false); }}
              >{content}</Link>
            ) : (
              <button key={notification.id} type="button" className={`activity-inbox-item ${notification.readAt ? "is-read" : ""}`} onClick={() => void read(notification)}>{content}</button>
            );
          }) : <EmptyInbox icon={<Bell size={24} />} title="새 소식이 없습니다" description="팀 제출, 리뷰, 일정 변경 소식이 이곳에 쌓입니다." />}
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={`activity-inbox-trigger activity-inbox-trigger--${variant}`}
        aria-label={`활동함 열기${badgeCount ? `, 확인할 항목 ${badgeCount}개` : ""}`}
        onClick={handleOpen}
      >
        <Bell size={19} />
        {variant === "sidebar" ? <span>활동함</span> : null}
        {badgeCount ? <em>{badgeCount > 9 ? "9+" : badgeCount}</em> : null}
      </button>

      {inboxLayer && typeof document !== "undefined"
        ? createPortal(inboxLayer, document.querySelector(".app-frame") ?? document.body)
        : null}
    </>
  );
}

function EmptyInbox({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <div className="activity-inbox-empty">{icon}<strong>{title}</strong><p>{description}</p></div>;
}
