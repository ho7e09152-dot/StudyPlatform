"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, FileText, Search, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { SESSION_TYPE_META } from "@/lib/domain/constants";
import { formatDate } from "@/lib/domain/format";
import { getSubmissionKey } from "@/lib/domain/metrics";
import type { SessionType } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";
import { LibraryDocumentList } from "./LibraryDocumentList";

type LibraryTab = "sessions" | "documents";

export function LibraryWorkspace() {
  const { workspace } = useWorkspace();
  const searchParams = useSearchParams();
  const tab: LibraryTab = searchParams.get("tab") === "documents" ? "documents" : "sessions";
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | SessionType>("all");

  const sessions = useMemo(() => Object.values(workspace.sessions)
    .filter((session) => session.status === "active")
    .sort((a, b) => b.date.localeCompare(a.date)), [workspace.sessions]);
  const availableTypes = useMemo(() => Array.from(new Set(sessions.map((session) => session.type))), [sessions]);
  const filteredSessions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return sessions.filter((session) => {
      if (type !== "all" && session.type !== type) return false;
      if (!normalized) return true;
      const submissionText = workspace.members.flatMap((member) =>
        workspace.submissions[getSubmissionKey(session.folder, member.id)]?.submissions.map((entry) => entry.value) ?? [],
      );
      return [session.date, ...session.items.flatMap((item) => [item.title, item.description ?? ""]), ...submissionText]
        .join(" ").toLocaleLowerCase("ko").includes(normalized);
    });
  }, [query, sessions, type, workspace]);
  const hasFilters = Boolean(query.trim()) || type !== "all";

  return (
    <div className="page-stack library-page library-index">
      <header className="page-heading library-page-heading">
        <div><h1>학습 라이브러리</h1><p>함께 공부한 내용과 팀이 남긴 자료를 다시 찾아보세요.</p></div>
      </header>

      <nav className="library-tabs" role="tablist" aria-label="학습 라이브러리 분류">
        <Link href={APP_ROUTES.librarySessions} role="tab" aria-selected={tab === "sessions"}><BookOpen size={17} /> 학습 세션</Link>
        <Link href={APP_ROUTES.libraryDocuments} role="tab" aria-selected={tab === "documents"}><FileText size={17} /> 팀 문서</Link>
      </nav>

      {tab === "documents" ? <LibraryDocumentList /> : (
        <>
          <section className="library-toolbar" aria-label="학습 세션 검색과 필터">
            <label className="library-search"><Search size={18} aria-hidden="true" /><span className="sr-only">학습 세션 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="세션, 학습 항목, 제출 내용 검색" /></label>
            <label className="library-filter"><span className="sr-only">학습 유형</span><select value={type} onChange={(event) => setType(event.target.value as "all" | SessionType)}><option value="all">전체 유형</option>{availableTypes.map((value) => <option key={value} value={value}>{SESSION_TYPE_META[value].label}</option>)}</select></label>
          </section>

          {filteredSessions.length ? (
            <section className="library-session-list" aria-label="학습 세션 목록">
              {filteredSessions.map((session) => {
                const meta = SESSION_TYPE_META[session.type];
                const activeItems = session.items.filter((item) => item.status === "active");
                const files = workspace.members.map((member) => workspace.submissions[getSubmissionKey(session.folder, member.id)]).filter(Boolean);
                const submittedMembers = files.filter((file) => file.submissions.some((entry) => activeItems.some((item) => item.id === entry.itemId))).length;
                return (
                  <Link key={session.date} href={APP_ROUTES.librarySession(session.date)} className="library-session-row">
                    <span className="library-session-date"><strong>{new Date(`${session.date}T00:00:00`).getDate()}</strong><small>{formatDate(session.date, true).replace(/\s*\(.+\)$/, "")}</small></span>
                    <span className="library-session-main">
                      <span><em className={`type-chip type-chip--${meta.tone}`}>{meta.label}</em></span>
                      <strong>{formatDate(session.date, true)}</strong>
                      <p>{activeItems.map((item) => item.title).join(" · ")}</p>
                    </span>
                    <span className="library-session-meta">
                      <span><BookOpen size={14} /> {activeItems.length}개 학습 항목</span>
                      <span><Users size={14} /> 팀 제출 {submittedMembers} / {workspace.members.length}명</span>
                    </span>
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                );
              })}
            </section>
          ) : sessions.length ? (
            <section className="library-empty" aria-live="polite"><Search size={26} /><strong>조건에 맞는 학습 세션이 없어요.</strong><button type="button" className="button button--secondary" onClick={() => { setQuery(""); setType("all"); }}>검색 초기화</button></section>
          ) : (
            <section className="library-empty"><BookOpen size={26} /><strong>아직 저장된 학습 세션이 없어요.</strong><p>학습을 진행하면 이곳에 기록이 쌓입니다.</p></section>
          )}
          {hasFilters && filteredSessions.length ? <button type="button" className="library-reset" onClick={() => { setQuery(""); setType("all"); }}>검색과 필터 초기화</button> : null}
        </>
      )}
    </div>
  );
}
