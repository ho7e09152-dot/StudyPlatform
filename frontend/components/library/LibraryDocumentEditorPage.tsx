"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bold, CheckSquare, Code2, Heading2, Link2, List, Quote, Save } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { ApiError } from "@/lib/api/client/http";
import { createWorkspaceDocument, getWorkspaceDocument, updateWorkspaceDocument, type WorkspaceDocument } from "@/lib/api/services/workspaceApi";
import { APP_ROUTES } from "@/lib/routes";
import { MarkdownPreview } from "@/components/repository/MarkdownPreview";
import { loadDemoDocuments, saveDemoDocuments } from "./demoDocuments";
import { getUserFacingError } from "@/lib/api/errors";

const NEW_DOCUMENT_BODY = "## 정리할 내용\n\n여기에 팀과 공유할 학습 내용을 작성하세요.\n\n### 다음 할 일\n\n- [ ] ";

export function LibraryDocumentEditorPage({ documentId }: { documentId?: string }) {
  const router = useRouter();
  const { mode } = useAuth();
  const { workspace, currentUserId } = useWorkspace();
  const [document, setDocument] = useState<WorkspaceDocument | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(documentId ? "" : NEW_DOCUMENT_BODY);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(Boolean(documentId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentMember = workspace.members.find((member) => member.id === currentUserId);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!documentId) return;
    setLoading(true);
    setDocument(null);
    try {
      const result = mode === "demo" ? loadDemoDocuments().find((candidate) => candidate.id === documentId) : await getWorkspaceDocument(workspace.id, documentId, signal);
      if (signal?.aborted) return;
      if (!result) throw new Error("팀 문서를 찾을 수 없습니다.");
      if (!result.canEdit) throw new Error("문서를 만든 사람만 편집할 수 있습니다.");
      setDocument(result); setTitle(result.title); setBody(result.bodyMarkdown); setError("");
    } catch (requestError) {
      if (signal?.aborted) return;
      const knownMessage = requestError instanceof Error && ["팀 문서를 찾을 수 없습니다.", "문서를 만든 사람만 편집할 수 있습니다."].includes(requestError.message)
        ? requestError.message
        : getUserFacingError(requestError, "문서를 불러오지 못했습니다.");
      setError(knownMessage);
    }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [documentId, mode, workspace.id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [dirty]);

  function insertMarkdown(prefix: string, suffix = "") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end);
    const next = `${body.slice(0, start)}${prefix}${selected}${suffix}${body.slice(end)}`;
    setBody(next); setDirty(true);
    window.requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length); });
  }

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true); setError("");
    try {
      let saved: WorkspaceDocument;
      if (mode === "demo") {
        const source = loadDemoDocuments();
        const now = new Date().toISOString();
        saved = document
          ? { ...document, title: title.trim(), bodyMarkdown: body, version: document.version + 1, updatedAt: now }
          : { id: `demo-doc-${Date.now()}`, authorName: currentMember?.displayName ?? "나", title: title.trim(), bodyMarkdown: body, version: 0, createdAt: now, updatedAt: now, canEdit: true };
        saveDemoDocuments(document ? source.map((candidate) => candidate.id === saved.id ? saved : candidate) : [saved, ...source]);
      } else {
        saved = document
          ? await updateWorkspaceDocument(workspace.id, document.id, title.trim(), body, document.version)
          : await createWorkspaceDocument(workspace.id, title.trim(), body);
      }
      setDirty(false);
      router.replace(APP_ROUTES.libraryDocument(saved.id));
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.code === "DOCUMENT_VERSION_CONFLICT" ? "다른 화면에서 문서가 변경되었습니다. 최신 문서를 다시 불러온 뒤 수정해 주세요." : getUserFacingError(requestError, "문서를 저장하지 못했습니다."));
      setSaving(false);
    }
  }

  if (loading) return <div className="library-route-state"><strong>문서를 불러오는 중…</strong></div>;
  if (documentId && !document) return <div className="library-route-state" role="alert"><strong>문서를 편집할 수 없어요.</strong><p>{error}</p><Link href={APP_ROUTES.libraryDocuments} className="button button--secondary">팀 문서로 돌아가기</Link></div>;
  const backHref = document ? APP_ROUTES.libraryDocument(document.id) : APP_ROUTES.libraryDocuments;

  return (
    <div className="page-stack team-document-editor-page">
      <header className="library-page-back"><Link href={backHref}><ArrowLeft size={17} /> 팀 문서</Link></header>
      <header className="document-editor-heading"><div><h1>{document ? "문서 편집" : "새 문서"}</h1><p>Markdown으로 팀이 다시 활용할 학습 내용을 정리하세요.</p></div><div className="document-editor-actions"><div className="document-mode-toggle" role="group" aria-label="문서 보기 모드"><button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>편집</button><button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button></div><button type="button" className="button button--primary" disabled={saving || !title.trim()} onClick={() => void save()}><Save size={15} /> {saving ? "저장 중…" : "저장"}</button></div></header>
      <section className="team-document-editor" aria-label={document ? "팀 문서 편집" : "새 팀 문서 작성"}>
        <label className="document-title-field"><span>제목</span><input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} placeholder="문서 제목" maxLength={120} autoFocus /></label>
        {!preview ? <div className="team-document-formatbar" role="toolbar" aria-label="Markdown 서식 도구">
          <button type="button" aria-label="소제목" title="소제목" onClick={() => insertMarkdown("## ")}><Heading2 size={16} /></button>
          <button type="button" aria-label="굵게" title="굵게" onClick={() => insertMarkdown("**", "**")}><Bold size={16} /></button>
          <button type="button" aria-label="목록" title="목록" onClick={() => insertMarkdown("- ")}><List size={16} /></button>
          <button type="button" aria-label="체크리스트" title="체크리스트" onClick={() => insertMarkdown("- [ ] ")}><CheckSquare size={16} /></button>
          <button type="button" aria-label="인용" title="인용" onClick={() => insertMarkdown("> ")}><Quote size={16} /></button>
          <button type="button" aria-label="코드 블록" title="코드 블록" onClick={() => insertMarkdown("```\n", "\n```")}><Code2 size={16} /></button>
          <button type="button" aria-label="링크" title="링크" onClick={() => insertMarkdown("[", "](https://)")}><Link2 size={16} /></button>
        </div> : null}
        {preview ? <MarkdownPreview content={body || "_작성된 내용이 없습니다._"} /> : <label className="document-body-field"><span className="sr-only">문서 내용</span><textarea ref={textareaRef} value={body} onChange={(event) => { setBody(event.target.value); setDirty(true); }} placeholder="Markdown으로 학습 내용을 작성하세요." spellCheck="false" /></label>}
      </section>
      {error ? <div className="team-document-error" role="alert">{error}</div> : null}
    </div>
  );
}
