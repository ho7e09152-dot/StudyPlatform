"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bold,
  CheckSquare,
  Code2,
  Edit3,
  FilePlus2,
  FileText,
  Heading2,
  List,
  Quote,
  Save,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Modal } from "@/components/ui/Modal";
import { ApiError } from "@/lib/api/client/http";
import {
  createWorkspaceDocument,
  deleteWorkspaceDocument,
  getWorkspaceDocument,
  listWorkspaceDocuments,
  updateWorkspaceDocument,
  type WorkspaceDocument,
} from "@/lib/api/services/workspaceApi";
import { formatDateTime } from "@/lib/domain/format";
import { MarkdownPreview } from "./MarkdownPreview";

const demoDocuments: WorkspaceDocument[] = [
  {
    id: "demo-doc-os",
    authorName: "김서연",
    title: "운영체제 스케줄링 핵심 정리",
    bodyMarkdown: "## 스케줄링 기준\n\n- **응답 시간**: 요청부터 첫 응답까지\n- **반환 시간**: 도착부터 종료까지\n- **대기 시간**: 준비 큐에서 기다린 시간\n\n> 라운드 로빈은 타임 퀀텀이 너무 크면 FCFS와 비슷해진다.\n\n### 다음에 확인할 것\n\n- [ ] MLFQ 우선순위 이동 규칙\n- [ ] 기아 상태와 에이징",
    version: 2,
    createdAt: "2026-07-21T22:30:00+09:00",
    updatedAt: "2026-07-23T19:10:00+09:00",
    canEdit: true,
  },
  {
    id: "demo-doc-algorithm",
    authorName: "이준호",
    title: "큐 문제를 풀 때 확인할 패턴",
    bodyMarkdown: "## 먼저 확인하기\n\n1. 입력 순서를 보존해야 하는가?\n2. 우선순위가 계속 바뀌는가?\n3. 원형 순회가 필요한가?\n\n```python\nfrom collections import deque\nqueue = deque()\n```",
    version: 1,
    createdAt: "2026-07-23T21:40:00+09:00",
    updatedAt: "2026-07-23T21:40:00+09:00",
    canEdit: false,
  },
];

export function TeamDocumentLibrary({ query, initialDocumentId }: { query: string; initialDocumentId?: string }) {
  const { mode } = useAuth();
  const { workspace, currentUserId } = useWorkspace();
  const currentMember = workspace.members.find((member) => member.id === currentUserId);
  const [demoStore, setDemoStore] = useState(demoDocuments);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [selected, setSelected] = useState<WorkspaceDocument | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialDocumentHandledRef = useRef(false);

  const load = useCallback(async () => {
    if (mode === "demo") {
      const normalized = query.trim().toLocaleLowerCase("ko");
      const filtered = normalized ? demoStore.filter((document) => `${document.title} ${document.bodyMarkdown} ${document.authorName}`.toLocaleLowerCase("ko").includes(normalized)) : demoStore;
      setDocuments(filtered);
      if (initialDocumentId && !initialDocumentHandledRef.current) {
        initialDocumentHandledRef.current = true;
        setSelected(demoStore.find((document) => document.id === initialDocumentId) ?? null);
      }
      setLoading(false);
      return;
    }
    try {
      const result = await listWorkspaceDocuments(workspace.id, { query: query.trim() || undefined });
      setDocuments(result.items);
      setNextCursor(result.nextCursor);
      if (initialDocumentId && !initialDocumentHandledRef.current) {
        initialDocumentHandledRef.current = true;
        const found = result.items.find((document) => document.id === initialDocumentId) ?? await getWorkspaceDocument(workspace.id, initialDocumentId);
        setSelected(found);
      }
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "팀 문서를 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, [demoStore, initialDocumentId, mode, query, workspace.id]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  function openCreate() {
    setCreating(true);
    setEditorOpen(true);
    setTitle("");
    setBody("## 정리할 내용\n\n여기에 팀과 공유할 학습 내용을 작성하세요.\n\n### 다음 할 일\n\n- [ ] ");
    setPreview(false);
    setError("");
  }

  function openEdit(document: WorkspaceDocument) {
    setCreating(false);
    setEditorOpen(true);
    setTitle(document.title);
    setBody(document.bodyMarkdown);
    setPreview(false);
    setError("");
  }

  function insertMarkdown(prefix: string, suffix = "") {
    const textarea = textareaRef.current;
    if (!textarea) { setBody((current) => `${current}${prefix}${suffix}`); return; }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.slice(start, end);
    const next = `${body.slice(0, start)}${prefix}${selectedText}${suffix}${body.slice(end)}`;
    setBody(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length + selectedText.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const saved = creating
        ? mode === "demo"
          ? { id: `demo-doc-${Date.now()}`, authorName: currentMember?.displayName ?? "나", title: title.trim(), bodyMarkdown: body, version: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), canEdit: true } satisfies WorkspaceDocument
          : await createWorkspaceDocument(workspace.id, title.trim(), body)
        : mode === "demo"
          ? { ...selected!, title: title.trim(), bodyMarkdown: body, version: selected!.version + 1, updatedAt: new Date().toISOString() }
          : await updateWorkspaceDocument(workspace.id, selected!.id, title.trim(), body, selected!.version);
      if (mode === "demo") setDemoStore((current) => creating ? [saved, ...current] : current.map((document) => document.id === saved.id ? saved : document));
      setDocuments((current) => creating ? [saved, ...current] : current.map((document) => document.id === saved.id ? saved : document));
      setSelected(saved);
      setEditorOpen(false);
    } catch (requestError) {
      setError(requestError instanceof ApiError && requestError.code === "DOCUMENT_VERSION_CONFLICT"
        ? "다른 화면에서 문서가 변경되었습니다. 최신 문서를 다시 불러온 뒤 수정해 주세요."
        : requestError instanceof Error ? requestError.message : "문서를 저장하지 못했습니다.");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      if (mode !== "demo") await deleteWorkspaceDocument(workspace.id, selected.id, selected.version);
      if (mode === "demo") setDemoStore((current) => current.filter((document) => document.id !== selected.id));
      setDocuments((current) => current.filter((document) => document.id !== selected.id));
      setSelected(null);
      setDeleteOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "문서를 삭제하지 못했습니다.");
      setDeleteOpen(false);
    } finally { setSaving(false); }
  }

  async function loadMore() {
    if (!nextCursor || mode === "demo") return;
    const result = await listWorkspaceDocuments(workspace.id, { query: query.trim() || undefined, cursor: nextCursor });
    setDocuments((current) => [...current, ...result.items]);
    setNextCursor(result.nextCursor);
  }

  if (selected && !editorOpen) {
    return (
      <div className="library-team-document-page">
        <header className="library-document-nav">
          <button type="button" onClick={() => setSelected(null)}><ArrowLeft size={17} /> 팀 문서</button>
          {selected.canEdit ? <div><button type="button" onClick={() => openEdit(selected)}><Edit3 size={15} /> 편집</button><button type="button" className="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> 삭제</button></div> : <span>읽기 전용</span>}
        </header>
        <article className="surface team-document-view">
          <header><p className="eyebrow">TEAM DOCUMENT</p><h1>{selected.title}</h1><div><span>{selected.authorName} 작성</span><span>{formatDateTime(selected.updatedAt)} 업데이트</span><span>version {selected.version}</span></div></header>
          {selected.bodyMarkdown.trim() ? <MarkdownPreview content={selected.bodyMarkdown} /> : <div className="team-document-blank"><FileText size={25} /><p>아직 작성된 내용이 없습니다.</p></div>}
        </article>
        {error ? <div className="team-document-error" role="alert">{error}</div> : null}
        {deleteOpen ? <Modal title="팀 문서를 삭제할까요?" description="문서는 목록에서 사라지지만 데이터베이스에서는 복구 가능한 소프트 삭제 상태로 보존됩니다." onClose={() => setDeleteOpen(false)}><div className="submission-warning-dialog"><p><strong>{selected.title}</strong> 문서를 삭제합니다. 다른 멤버가 열어둔 화면에는 이전 내용이 잠시 보일 수 있습니다.</p><div className="modal-actions"><button type="button" className="button button--secondary" onClick={() => setDeleteOpen(false)}>취소</button><button type="button" className="button button--danger" disabled={saving} onClick={() => void remove()}>삭제</button></div></div></Modal> : null}
      </div>
    );
  }

  if (editorOpen) {
    return (
      <div className="team-document-editor-page">
        <header className="library-document-nav">
          <button type="button" onClick={() => setEditorOpen(false)}><ArrowLeft size={17} /> {creating ? "문서 만들기 취소" : "문서로 돌아가기"}</button>
          <div><button type="button" onClick={() => setPreview((current) => !current)}>{preview ? "계속 편집" : "미리보기"}</button><button type="button" className="primary" disabled={saving || !title.trim()} onClick={() => void save()}><Save size={15} /> {saving ? "저장 중…" : "저장"}</button></div>
        </header>
        <section className="surface team-document-editor">
          <input className="team-document-title-editor" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="문서 제목" maxLength={120} autoFocus />
          {!preview ? <div className="team-document-formatbar" aria-label="Markdown 서식"><button type="button" title="소제목" onClick={() => insertMarkdown("## ")}><Heading2 size={16} /></button><button type="button" title="굵게" onClick={() => insertMarkdown("**", "**")}><Bold size={16} /></button><button type="button" title="목록" onClick={() => insertMarkdown("- ")}><List size={16} /></button><button type="button" title="할 일" onClick={() => insertMarkdown("- [ ] ")}><CheckSquare size={16} /></button><button type="button" title="인용" onClick={() => insertMarkdown("> ")}><Quote size={16} /></button><button type="button" title="코드 블록" onClick={() => insertMarkdown("```\n", "\n```")}><Code2 size={16} /></button></div> : null}
          {preview ? <MarkdownPreview content={body || "_작성된 내용이 없습니다._"} /> : <textarea ref={textareaRef} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Markdown으로 학습 내용을 작성하세요." spellCheck="false" />}
        </section>
        {error ? <div className="team-document-error" role="alert">{error}<button type="button" onClick={() => { setEditorOpen(false); setSelected(null); void load(); }}>최신 목록 다시 불러오기</button></div> : null}
      </div>
    );
  }

  return (
    <section className="team-document-library" aria-label="팀 문서">
      <div className="team-document-library-head"><div><strong>팀 문서</strong><p>누구나 읽고, 만든 사람만 편집할 수 있습니다.</p></div><button type="button" className="button button--primary" onClick={openCreate}><FilePlus2 size={16} /> 새 문서</button></div>
      {error ? <div className="team-document-error" role="alert">{error}</div> : null}
      {loading ? <div className="library-empty"><span className="spin"><FileText size={24} /></span><strong>팀 문서를 불러오는 중…</strong></div> : documents.length ? <div className="team-document-grid">{documents.map((document) => (
        <button type="button" key={document.id} onClick={() => setSelected(document)}>
          <span className="team-document-card-icon"><FileText size={20} /></span>
          <strong>{document.title}</strong>
          <p>{document.bodyMarkdown.replace(/[#>*_`\[\]-]/g, " ").replace(/\s+/g, " ").trim() || "아직 작성된 내용이 없습니다."}</p>
          <footer><span>{document.authorName}</span><small>{formatDateTime(document.updatedAt)}{document.canEdit ? " · 내가 만든 문서" : ""}</small></footer>
        </button>
      ))}</div> : <div className="surface library-empty"><FilePlus2 size={27} /><strong>아직 팀 문서가 없습니다</strong><p>첫 문서를 만들어 학습 내용을 팀과 공유해 보세요.</p></div>}
      {nextCursor ? <button type="button" className="team-feed-more" onClick={() => void loadMore()}>문서 더 보기</button> : null}
    </section>
  );
}
