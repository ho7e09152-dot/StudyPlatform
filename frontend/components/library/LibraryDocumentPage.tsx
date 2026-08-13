"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Edit3, FileText, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Modal } from "@/components/ui/Modal";
import { deleteWorkspaceDocument, getWorkspaceDocument, type WorkspaceDocument } from "@/lib/api/services/workspaceApi";
import { formatDate } from "@/lib/domain/format";
import { APP_ROUTES } from "@/lib/routes";
import { MarkdownPreview } from "@/components/repository/MarkdownPreview";
import { loadDemoDocuments, saveDemoDocuments } from "./demoDocuments";
import { getUserFacingError } from "@/lib/api/errors";

export function LibraryDocumentPage({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { mode } = useAuth();
  const { workspace } = useWorkspace();
  const [document, setDocument] = useState<WorkspaceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setDocument(null);
    try {
      const result = mode === "demo"
        ? loadDemoDocuments().find((candidate) => candidate.id === documentId)
        : await getWorkspaceDocument(workspace.id, documentId, signal);
      if (signal?.aborted) return;
      if (!result) throw new Error("팀 문서를 찾을 수 없습니다.");
      setDocument(result);
      setError("");
    } catch (requestError) {
      if (signal?.aborted) return;
      const knownMessage = requestError instanceof Error && requestError.message === "팀 문서를 찾을 수 없습니다."
        ? requestError.message
        : getUserFacingError(requestError, "팀 문서를 불러오지 못했습니다.");
      setError(knownMessage);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [documentId, mode, workspace.id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  async function remove() {
    if (!document || deleting) return;
    setDeleting(true);
    try {
      if (mode === "demo") saveDemoDocuments(loadDemoDocuments().filter((candidate) => candidate.id !== document.id));
      else await deleteWorkspaceDocument(workspace.id, document.id, document.version);
      router.replace(APP_ROUTES.libraryDocuments);
    } catch (requestError) {
      setError(getUserFacingError(requestError, "문서를 삭제하지 못했습니다."));
      setDeleteOpen(false);
      setDeleting(false);
    }
  }

  if (loading) return <div className="library-route-state"><span className="spin"><FileText size={24} /></span><strong>문서를 불러오는 중…</strong></div>;
  if (!document) return <div className="library-route-state" role="alert"><strong>문서를 열 수 없어요.</strong><p>{error}</p><Link href={APP_ROUTES.libraryDocuments} className="button button--secondary">팀 문서로 돌아가기</Link></div>;

  return (
    <div className="page-stack library-team-document-page">
      <header className="library-page-back"><Link href={APP_ROUTES.libraryDocuments}><ArrowLeft size={17} /> 팀 문서</Link></header>
      <article className="team-document-view">
        <header>
          <div><h1>{document.title}</h1><p>{document.authorName} · {formatDate(document.updatedAt.slice(0, 10), false)}</p></div>
          {document.canEdit ? <div className="team-document-actions"><Link href={APP_ROUTES.libraryDocumentEdit(document.id)} className="button button--secondary"><Edit3 size={15} /> 편집</Link><button type="button" className="icon-button danger" aria-label="문서 삭제" onClick={() => setDeleteOpen(true)}><Trash2 size={18} /></button></div> : null}
        </header>
        {document.bodyMarkdown.trim() ? <MarkdownPreview content={document.bodyMarkdown} /> : <div className="team-document-blank"><FileText size={25} /><p>아직 작성된 내용이 없습니다.</p></div>}
      </article>
      {error ? <div className="team-document-error" role="alert">{error}</div> : null}
      {deleteOpen ? <Modal title="이 문서를 삭제할까요?" description="삭제하면 팀 문서 목록에서 제거됩니다." onClose={() => setDeleteOpen(false)}><div className="submission-warning-dialog"><p><strong>{document.title}</strong> 문서를 삭제합니다. 삭제 후에는 이 화면에서 직접 되돌릴 수 없습니다.</p><div className="modal-actions"><button type="button" className="button button--ghost" onClick={() => setDeleteOpen(false)}>취소</button><button type="button" className="button button--danger" disabled={deleting} onClick={() => void remove()}>{deleting ? "삭제 중…" : "삭제"}</button></div></div></Modal> : null}
    </div>
  );
}
