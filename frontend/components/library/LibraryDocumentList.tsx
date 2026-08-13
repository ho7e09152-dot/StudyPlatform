"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, FilePlus2, FileText, Search } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { listWorkspaceDocuments, type WorkspaceDocument } from "@/lib/api/services/workspaceApi";
import { formatDate } from "@/lib/domain/format";
import { APP_ROUTES } from "@/lib/routes";
import { loadDemoDocuments, plainText } from "./demoDocuments";
import { getUserFacingError } from "@/lib/api/errors";

export function LibraryDocumentList() {
  const { mode } = useAuth();
  const { workspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      if (mode === "demo") {
        const normalized = query.trim().toLocaleLowerCase("ko");
        const source = loadDemoDocuments();
        setDocuments(normalized ? source.filter((document) => `${document.title} ${document.bodyMarkdown} ${document.authorName}`.toLocaleLowerCase("ko").includes(normalized)) : source);
        setNextCursor(undefined);
      } else {
        const result = await listWorkspaceDocuments(workspace.id, { query: query.trim() || undefined }, signal);
        if (signal?.aborted) return;
        setDocuments(result.items);
        setNextCursor(result.nextCursor);
      }
      setError("");
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(getUserFacingError(requestError, "팀 문서를 불러오지 못했습니다."));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [mode, query, workspace.id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setDocuments([]);
      setNextCursor(undefined);
      void load(controller.signal);
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function loadMore() {
    if (!nextCursor || mode === "demo") return;
    const result = await listWorkspaceDocuments(workspace.id, { query: query.trim() || undefined, cursor: nextCursor });
    setDocuments((current) => [...current, ...result.items]);
    setNextCursor(result.nextCursor);
  }

  return (
    <section className="team-document-library" aria-labelledby="team-documents-title">
      <header className="team-document-library-head"><div><h2 id="team-documents-title">팀 문서</h2><p>팀이 정리한 학습 내용을 제목, 본문, 작성자로 검색할 수 있어요.</p></div><Link href={APP_ROUTES.libraryDocumentNew} className="button button--primary"><FilePlus2 size={16} /> 새 문서</Link></header>
      <label className="library-search"><Search size={18} aria-hidden="true" /><span className="sr-only">팀 문서 검색</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 내용, 작성자 검색" /></label>
      {error ? <div className="team-document-error" role="alert">{error}<button type="button" onClick={() => void load()}>다시 시도</button></div> : null}
      {loading ? <div className="library-empty"><span className="spin"><FileText size={24} /></span><strong>팀 문서를 불러오는 중…</strong></div> : documents.length ? (
        <div className="team-document-list">{documents.map((document) => (
          <Link key={document.id} href={APP_ROUTES.libraryDocument(document.id)}>
            <span className="team-document-row-icon"><FileText size={18} /></span>
            <span><strong>{document.title}</strong><p>{plainText(document.bodyMarkdown) || "아직 작성된 내용이 없습니다."}</p><small>{document.authorName} · {formatDate(document.updatedAt.slice(0, 10), false)}</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        ))}</div>
      ) : query.trim() ? <div className="library-empty"><Search size={26} /><strong>조건에 맞는 문서가 없어요.</strong><button type="button" className="button button--secondary" onClick={() => setQuery("")}>검색 초기화</button></div> : <div className="library-empty"><FilePlus2 size={27} /><strong>아직 팀 문서가 없어요.</strong><p>함께 참고할 학습 내용을 문서로 남겨보세요.</p><Link href={APP_ROUTES.libraryDocumentNew} className="button button--primary">새 문서</Link></div>}
      {nextCursor ? <button type="button" className="team-feed-more" onClick={() => void loadMore()}>문서 더 보기</button> : null}
    </section>
  );
}
