"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Check,
  Edit3,
  MessageSquareText,
  Pin,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import {
  createWorkspaceAnnouncement,
  createWorkspaceMessage,
  deleteWorkspaceAnnouncement,
  deleteWorkspaceMessage,
  listWorkspaceAnnouncements,
  listWorkspaceMessages,
  updateWorkspaceMessage,
  type WorkspaceAnnouncement,
  type WorkspaceMessage,
} from "@/lib/api/services/workspaceApi";
import { formatDate, formatDateTime } from "@/lib/domain/format";

const demoAnnouncements: WorkspaceAnnouncement[] = [{
  id: "demo-announcement",
  authorName: "박민지",
  title: "이번 주 스터디 회의 안내",
  body: "금요일 학습이 끝난 뒤 20분 동안 다음 주 주제와 진행 방식을 정합니다.",
  pinned: true,
  publishedAt: "2026-07-23T18:00:00+09:00",
  updatedAt: "2026-07-23T18:00:00+09:00",
  canEdit: true,
}];

const demoMessages: WorkspaceMessage[] = [
  { id: "demo-message-3", authorName: "박민지", contextDate: "2026-07-23", body: "프로세스 문제에서 큐 순서를 그려보니까 훨씬 이해가 잘 됐어요.", createdAt: "2026-07-23T21:55:00+09:00", updatedAt: "2026-07-23T21:55:00+09:00", edited: false, canEdit: true },
  { id: "demo-message-2", authorName: "이준호", contextDate: "2026-07-23", body: "제출 올렸습니다. 시간 복잡도 부분이 맞는지 리뷰 부탁드려요!", createdAt: "2026-07-23T21:36:00+09:00", updatedAt: "2026-07-23T21:36:00+09:00", edited: false, canEdit: false },
  { id: "demo-message-1", authorName: "김서연", contextDate: "2026-07-22", body: "내일 알고리즘 일정 확인했습니다.", createdAt: "2026-07-22T22:20:00+09:00", updatedAt: "2026-07-22T22:20:00+09:00", edited: false, canEdit: true },
];

export function TeamFeed({ date }: { date: string }) {
  const { mode } = useAuth();
  const { workspace, currentUserId } = useWorkspace();
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const canManage = currentMember?.role === "OWNER" || currentMember?.role === "MANAGER";
  const [tab, setTab] = useState<"today" | "all">("today");
  const [announcements, setAnnouncements] = useState<WorkspaceAnnouncement[]>(mode === "demo" ? demoAnnouncements : []);
  const [demoMessageStore, setDemoMessageStore] = useState<WorkspaceMessage[]>(demoMessages);
  const [messages, setMessages] = useState<WorkspaceMessage[]>(mode === "demo" ? demoMessages.filter((message) => message.contextDate === date) : []);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [messageBody, setMessageBody] = useState("");
  const [announcementMode, setAnnouncementMode] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [pinned, setPinned] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const visibleDemoMessages = useMemo(
    () => tab === "today" ? demoMessageStore.filter((message) => message.contextDate === date) : demoMessageStore,
    [date, demoMessageStore, tab],
  );

  const load = useCallback(async (quiet = false) => {
    if (mode === "demo") {
      setMessages(visibleDemoMessages);
      return;
    }
    if (!quiet) setRefreshing(true);
    try {
      const [announcementResult, messageResult] = await Promise.all([
        listWorkspaceAnnouncements(workspace.id),
        listWorkspaceMessages(workspace.id, tab === "today" ? { date } : {}),
      ]);
      setAnnouncements(announcementResult);
      setMessages(messageResult.items);
      setNextCursor(messageResult.nextCursor);
      setError("");
    } catch (requestError) {
      if (!quiet) setError(requestError instanceof Error ? requestError.message : "팀 피드를 불러오지 못했습니다.");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [date, mode, tab, visibleDemoMessages, workspace.id]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 10_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [load]);

  async function submit() {
    if (busy) return;
    const body = messageBody.trim();
    if (!body || (announcementMode && !announcementTitle.trim())) return;
    setBusy(true);
    setError("");
    try {
      if (announcementMode) {
        const created = mode === "demo"
          ? { id: `demo-announcement-${Date.now()}`, authorName: currentMember?.displayName ?? "나", title: announcementTitle.trim(), body, pinned, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), canEdit: true } satisfies WorkspaceAnnouncement
          : await createWorkspaceAnnouncement(workspace.id, { title: announcementTitle.trim(), body, pinned });
        setAnnouncements((current) => [created, ...current]);
        setAnnouncementTitle("");
        setAnnouncementMode(false);
      } else {
        const created = mode === "demo"
          ? { id: `demo-message-${Date.now()}`, authorName: currentMember?.displayName ?? "나", contextDate: date, body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), edited: false, canEdit: true } satisfies WorkspaceMessage
          : await createWorkspaceMessage(workspace.id, body, date);
        if (mode === "demo") setDemoMessageStore((current) => [created, ...current]);
        setMessages((current) => [created, ...current]);
      }
      setMessageBody("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "내용을 등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(message: WorkspaceMessage) {
    const body = editingBody.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const updated = mode === "demo" ? { ...message, body, edited: true, updatedAt: new Date().toISOString() } : await updateWorkspaceMessage(workspace.id, message.id, body);
      if (mode === "demo") setDemoMessageStore((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "메시지를 수정하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function removeMessage(messageId: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (mode !== "demo") await deleteWorkspaceMessage(workspace.id, messageId);
      if (mode === "demo") setDemoMessageStore((current) => current.filter((item) => item.id !== messageId));
      setMessages((current) => current.filter((item) => item.id !== messageId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "메시지를 삭제하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function removeAnnouncement(announcementId: string) {
    if (busy) return;
    setBusy(true);
    try {
      if (mode !== "demo") await deleteWorkspaceAnnouncement(workspace.id, announcementId);
      setAnnouncements((current) => current.filter((item) => item.id !== announcementId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "공지를 보관하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function loadMore() {
    if (!nextCursor || mode === "demo") return;
    setBusy(true);
    try {
      const result = await listWorkspaceMessages(workspace.id, { ...(tab === "today" ? { date } : {}), cursor: nextCursor });
      setMessages((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } finally { setBusy(false); }
  }

  return (
    <section id="team-feed" className="surface team-feed" aria-labelledby="team-feed-title">
      <header className="team-feed-header">
        <div><p className="eyebrow">TEAM SPACE</p><h2 id="team-feed-title">공지와 팀 대화</h2><p>회의 안내를 공유하고, 학습 중 질문이나 짧은 응원을 남겨보세요.</p></div>
        <button type="button" className="icon-button" aria-label="팀 피드 새로고침" disabled={refreshing} onClick={() => void load()}><RefreshCw className={refreshing ? "spin" : undefined} size={18} /></button>
      </header>

      {announcements.length ? <div className="team-announcements">{announcements.map((announcement) => (
        <article key={announcement.id}>
          <span><Pin size={15} /></span>
          <div><small>{announcement.pinned ? "고정 공지" : "공지"} · {announcement.authorName}</small><strong>{announcement.title}</strong><p>{announcement.body}</p></div>
          {announcement.canEdit ? <button type="button" aria-label={`${announcement.title} 공지 보관`} onClick={() => void removeAnnouncement(announcement.id)}><Trash2 size={14} /></button> : null}
        </article>
      ))}</div> : null}

      <div className="team-feed-tabs" role="tablist" aria-label="팀 대화 기간">
        <button type="button" role="tab" aria-selected={tab === "today"} onClick={() => setTab("today")}>오늘</button>
        <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>전체</button>
      </div>

      <div className="team-feed-composer">
        {announcementMode ? <label className="team-feed-title-input"><BellRing size={16} /><input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="공지 제목" maxLength={120} /></label> : null}
        <textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder={announcementMode ? "팀원에게 전달할 공지 내용을 입력하세요." : "질문, 회의 메모, 짧은 응원을 남겨보세요."} maxLength={announcementMode ? 10000 : 4000} rows={3} />
        <footer>
          {canManage ? <div className="team-feed-compose-options"><button type="button" className={announcementMode ? "is-active" : ""} onClick={() => setAnnouncementMode((current) => !current)}><BellRing size={14} /> 공지 작성</button>{announcementMode ? <label><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> 상단 고정</label> : null}</div> : <span />}
          <button type="button" className="button button--primary button--small" disabled={busy || !messageBody.trim() || (announcementMode && !announcementTitle.trim())} onClick={() => void submit()}><Send size={14} /> {announcementMode ? "공지 게시" : "보내기"}</button>
        </footer>
      </div>

      {error ? <div className="team-feed-error" role="alert">{error}</div> : null}

      <div className="team-message-list">
        {messages.length ? messages.map((message, index) => {
          const showDate = tab === "all" && messages[index - 1]?.contextDate !== message.contextDate;
          return <div key={message.id}>{showDate ? <div className="team-message-date"><span>{formatDate(message.contextDate, true)}</span></div> : null}<article>
            <span className="team-message-avatar" aria-hidden="true">{message.authorName.slice(0, 1)}</span>
            <div>
              <header><strong>{message.authorName}</strong><small>{formatDateTime(message.createdAt)}{message.edited ? " · 수정됨" : ""}</small></header>
              {editingId === message.id ? <div className="team-message-edit"><textarea value={editingBody} onChange={(event) => setEditingBody(event.target.value)} rows={3} maxLength={4000} /><span><button type="button" onClick={() => setEditingId(null)}>취소</button><button type="button" onClick={() => void saveEdit(message)}><Check size={13} /> 저장</button></span></div> : <p>{message.body}</p>}
            </div>
            {message.canEdit && editingId !== message.id ? <span className="team-message-actions"><button type="button" aria-label="메시지 수정" onClick={() => { setEditingId(message.id); setEditingBody(message.body); }}><Edit3 size={13} /></button><button type="button" aria-label="메시지 삭제" onClick={() => void removeMessage(message.id)}><Trash2 size={13} /></button></span> : null}
          </article></div>;
        }) : <div className="team-feed-empty"><MessageSquareText size={25} /><strong>아직 대화가 없습니다</strong><p>첫 메시지로 오늘 학습의 분위기를 열어보세요.</p></div>}
      </div>
      {nextCursor ? <button type="button" className="team-feed-more" disabled={busy} onClick={() => void loadMore()}>이전 메시지 더 보기</button> : null}
    </section>
  );
}
