"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import {
  listWorkspaceAnnouncements,
  type WorkspaceAnnouncement,
} from "@/lib/api/services/workspaceApi";
import { formatDate } from "@/lib/domain/format";
import { demoAnnouncements } from "@/components/feed/TeamFeed";
import { getUserFacingError } from "@/lib/api/errors";

export function TodayNotice() {
  const { mode } = useAuth();
  const { workspace } = useWorkspace();
  const [announcements, setAnnouncements] = useState<WorkspaceAnnouncement[]>(
    mode === "demo" ? demoAnnouncements : [],
  );
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(mode !== "demo");
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    if (mode === "demo") return;
    setLoading(true);
    try {
      setAnnouncements(await listWorkspaceAnnouncements(workspace.id, signal));
      setError("");
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getUserFacingError(requestError, "팀 공지를 불러오지 못했습니다."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [mode, workspace.id]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => void load(controller.signal), 0);
    return () => {
      window.clearTimeout(initial);
      controller.abort();
    };
  }, [load]);

  const visible = expanded ? announcements : announcements.slice(0, 1);

  return (
    <section className="today-notice" aria-labelledby="today-notice-title">
      <header className="today-notice__header">
        <h2 id="today-notice-title">팀 공지</h2>
        {announcements.length > 1 ? (
          <button
            type="button"
            className="today-text-action"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "접기" : `공지 전체 보기 (${announcements.length})`}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        ) : null}
      </header>

      {loading ? (
        <div className="today-notice__state" aria-live="polite">팀 공지를 불러오는 중…</div>
      ) : error ? (
        <div className="today-notice__state today-notice__state--error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            <RefreshCw size={14} aria-hidden="true" /> 다시 시도
          </button>
        </div>
      ) : visible.length ? (
        <div className="today-notice__list">
          {visible.map((announcement) => (
            <article key={announcement.id}>
              <span className="today-notice__icon"><Bell size={16} aria-hidden="true" /></span>
              <div>
                <strong>{announcement.title}</strong>
                <p>{announcement.body}</p>
                <small>{announcement.authorName} · {formatDate(announcement.publishedAt.slice(0, 10), false)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="today-notice__state">
          <Bell size={17} aria-hidden="true" /> 오늘 확인할 팀 공지가 없습니다.
        </div>
      )}
    </section>
  );
}
