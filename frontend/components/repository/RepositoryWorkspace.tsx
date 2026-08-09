"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  CodeXml,
  Eye,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  GitBranch,
  RefreshCw,
  Search,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useGitLabConnection } from "@/lib/api/hooks/useGitLabConnection";
import { getGitLabFile } from "@/lib/api/services/gitlabApi";
import type { GitLabFileContent } from "@/lib/api/types/gitlab";
import { getSubmissionKey } from "@/lib/domain/metrics";
import { getRepositoryFiles } from "@/lib/repository/serializers";
import { MarkdownPreview } from "./MarkdownPreview";

const ROOT_GROUP = "__root__";

interface RepositoryFileView {
  path: string;
  kind: "yaml" | "markdown" | "text";
  content?: string;
}

function getFileKind(path: string): RepositoryFileView["kind"] {
  if (/\.ya?ml$/i.test(path)) return "yaml";
  if (/\.md$/i.test(path)) return "markdown";
  return "text";
}

function getFolderGroup(path: string) {
  return path.includes("/") ? path.split("/")[0] : ROOT_GROUP;
}

function getFileName(path: string) {
  return path.split("/").at(-1) ?? path;
}

export function RepositoryWorkspace() {
  const { workspace } = useWorkspace();
  const connection = useGitLabConnection();
  const mockFiles = useMemo(() => getRepositoryFiles(workspace), [workspace]);
  const isLive =
    connection.state === "ready" &&
    connection.data?.status === "CONNECTED" &&
    Boolean(connection.data.project);
  const liveFiles = useMemo<RepositoryFileView[]>(
    () =>
      connection.data?.repositoryTree
        .filter((item) => item.type === "blob")
        .map((item) => ({
          path: item.path,
          kind: getFileKind(item.path),
        })) ?? [],
    [connection.data],
  );
  const files: RepositoryFileView[] = isLive ? liveFiles : mockFiles;
  const [selectedPath, setSelectedPath] = useState(
    mockFiles.find((file) => file.path.endsWith("session.yml"))?.path ??
      mockFiles[0]?.path,
  );
  const [fileRequest, setFileRequest] = useState<{
    path: string;
    state: "ready" | "error";
    file: GitLabFileContent | null;
    error: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [markdownView, setMarkdownView] = useState<"preview" | "source">(
    "preview",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const selected = files.find((file) => file.path === selectedPath) ?? files[0];

  useEffect(() => {
    if (!isLive || !selected?.path) return;

    const controller = new AbortController();
    const requestedPath = selected.path;

    void getGitLabFile(workspace.gitlabProjectId, requestedPath, controller.signal)
      .then((file) => {
        setFileRequest({
          path: requestedPath,
          state: "ready",
          file,
          error: null,
        });
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setFileRequest({
          path: requestedPath,
          state: "error",
          file: null,
          error:
            requestError instanceof Error
              ? requestError.message
              : "GitLab 파일을 불러오지 못했습니다.",
        });
      });

    return () => controller.abort();
  }, [isLive, selected?.path, workspace.gitlabProjectId]);

  const activeFileRequest =
    isLive && selected && fileRequest?.path === selected.path
      ? fileRequest
      : null;
  const fileState = !isLive
    ? "idle"
    : activeFileRequest?.state ?? "loading";
  const liveFile = activeFileRequest?.file ?? null;
  const fileError = activeFileRequest?.error ?? null;

  const filteredFiles = files.filter((file) =>
    file.path
      .toLocaleLowerCase("ko")
      .includes(searchQuery.trim().toLocaleLowerCase("ko")),
  );
  const folders = Array.from(
    new Set(filteredFiles.map((file) => getFolderGroup(file.path))),
  );
  const selectedFolder = selected ? getFolderGroup(selected.path) : undefined;
  const selectedDate =
    selectedFolder && selectedFolder !== ROOT_GROUP
      ? selectedFolder.replace(/^(\d{2})(\d{2})(\d{2})$/, "20$1-$2-$3")
      : undefined;
  const selectedSession = selectedDate
    ? workspace.sessions[selectedDate]
    : undefined;
  const selectedFileName = selected ? getFileName(selected.path) : undefined;
  const selectedMember = workspace.members.find(
    (member) => member.fileName === selectedFileName,
  );
  const selectedSubmission =
    !isLive &&
    selectedFolder &&
    selectedFolder !== ROOT_GROUP &&
    selectedMember
      ? workspace.submissions[
          getSubmissionKey(selectedFolder, selectedMember.id)
        ]
      : undefined;
  const selectedCommitId = isLive
    ? liveFile?.lastCommitId
    : selectedFileName === "session.yml"
      ? selectedSession?.lastCommitId
      : selectedSubmission?.lastCommitId;
  const selectedCommitMessage = isLive
    ? "GitLab에서 조회한 최신 파일"
    : selectedFileName === "session.yml"
      ? selectedSession
        ? `study: ${selectedSession.revision > 1 ? "update" : "create"} session ${selectedSession.folder}`
        : undefined
      : selectedSubmission?.lastCommitMessage;
  const selectedContent = isLive ? liveFile?.content : selected?.content;
  const projectPath =
    connection.data?.project?.pathWithNamespace ?? workspace.gitlabProjectPath;
  const defaultBranch =
    connection.data?.project?.defaultBranch ?? workspace.defaultBranch;
  const statusLabel =
    connection.state === "loading"
      ? "연결 확인 중"
      : connection.state === "error"
        ? "백엔드 연결 실패"
        : isLive
          ? "GitLab 연결됨"
          : "환경변수 필요 · 데모 데이터";
  const statusClass =
    connection.state === "error"
      ? "danger"
      : isLive
        ? "success"
        : connection.state === "loading"
          ? "neutral"
          : "warning";

  function filesInFolder(folder: string) {
    return filteredFiles.filter(
      (file) => getFolderGroup(file.path) === folder,
    );
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    const normalizedQuery = value.trim().toLocaleLowerCase("ko");
    if (!normalizedQuery) return;

    const selectedMatches = selected?.path
      ?.toLocaleLowerCase("ko")
      .includes(normalizedQuery);
    if (!selectedMatches) {
      const firstMatch = files.find((file) =>
        file.path.toLocaleLowerCase("ko").includes(normalizedQuery),
      );
      if (firstMatch) handleSelectFile(firstMatch.path);
    }
    setCollapsedFolders(new Set());
  }

  function handleSelectFile(path: string) {
    setSelectedPath(path);
    setMarkdownView("preview");
  }

  function toggleFolder(folder: string) {
    setCollapsedFolders((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  async function copy() {
    if (!selectedContent) return;
    await navigator.clipboard?.writeText(selectedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="page-stack repository-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">GITLAB SOURCE OF TRUTH</p>
          <h1>저장소</h1>
          <p>연결된 프로젝트의 학습 파일을 안전한 읽기 전용 화면으로 확인합니다.</p>
        </div>
        {isLive && connection.data?.project?.webUrl ? (
          <a
            className="button button--secondary"
            href={connection.data.project.webUrl}
            target="_blank"
            rel="noreferrer"
          >
            GitLab에서 열기 <ExternalLink size={16} />
          </a>
        ) : (
          <button
            type="button"
            className="button button--secondary"
            onClick={connection.reload}
          >
            연결 다시 확인 <RefreshCw size={16} />
          </button>
        )}
      </header>

      <div className="repo-status-bar">
        <span><Folder size={16} /> {projectPath}</span>
        <span><GitBranch size={16} /> {defaultBranch}</span>
        <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
      </div>
      {connection.state === "error" ? (
        <p className="repository-source-note">
          {connection.error} 저장소를 불러오지 못했습니다.
        </p>
      ) : !isLive && connection.data?.message ? (
        <p className="repository-source-note">{connection.data.message}</p>
      ) : null}

      <div className="repository-layout">
        <aside className="surface repository-tree" aria-label="저장소 파일">
          <div className="repository-tree__title">
            <strong>{isLive ? "GitLab Files" : "Demo Files"}</strong>
            <small>{files.length}개 파일</small>
          </div>
          <label className="repository-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="파일 경로 검색"
              aria-label="저장소 파일 검색"
            />
          </label>
          {folders.map((folder) => (
            <section key={folder}>
              <button
                type="button"
                className="folder-row"
                aria-expanded={!collapsedFolders.has(folder)}
                onClick={() => toggleFolder(folder)}
              >
                <Folder size={16} />
                <span>{folder === ROOT_GROUP ? "ROOT" : `${folder}/`}</span>
                <small>{filesInFolder(folder).length}</small>
                {collapsedFolders.has(folder) ? (
                  <ChevronRight size={15} />
                ) : (
                  <ChevronDown size={15} />
                )}
              </button>
              {!collapsedFolders.has(folder)
                ? filesInFolder(folder).map((file) => {
                    const Icon =
                      file.kind === "yaml" ? FileCode2 : FileText;
                    return (
                      <button
                        key={file.path}
                        type="button"
                        className={
                          selected?.path === file.path ? "active" : undefined
                        }
                        title={file.path}
                        onClick={() => handleSelectFile(file.path)}
                      >
                        <Icon size={15} /> {getFileName(file.path)}
                      </button>
                    );
                  })
                : null}
            </section>
          ))}
          {!filteredFiles.length ? (
            <div className="repository-tree__empty">
              <strong>검색 결과가 없습니다</strong>
              <button type="button" onClick={() => handleSearch("")}>
                검색어 지우기
              </button>
            </div>
          ) : null}
        </aside>

        <section className="surface file-viewer" aria-labelledby="file-name">
          {selected ? (
            <>
              <header>
                <span className="repo-badge"><CodeXml size={18} /></span>
                <div>
                  <h2 id="file-name">{selected.path}</h2>
                  <p>
                    {isLive
                      ? `${selected.kind.toUpperCase()} · GitLab repository file`
                      : selected.kind === "yaml"
                      ? "YAML · session configuration"
                      : selected.kind === "markdown"
                        ? "Markdown · member submission"
                        : "Text · GitLab repository file"}
                  </p>
                </div>
                <div className="file-viewer__actions">
                  {selected.kind === "markdown" ? (
                    <div
                      className="markdown-view-switch"
                      aria-label="Markdown 보기 방식"
                    >
                      <button
                        type="button"
                        className={markdownView === "preview" ? "active" : undefined}
                        aria-pressed={markdownView === "preview"}
                        onClick={() => setMarkdownView("preview")}
                      >
                        <Eye size={14} /> 미리보기
                      </button>
                      <button
                        type="button"
                        className={markdownView === "source" ? "active" : undefined}
                        aria-pressed={markdownView === "source"}
                        onClick={() => setMarkdownView("source")}
                      >
                        <Code2 size={14} /> 원문
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="button button--secondary button--small"
                    onClick={copy}
                    disabled={!selectedContent}
                  >
                    {copied ? <Check size={15} /> : <Clipboard size={15} />}
                    {copied ? "복사됨" : "원문 복사"}
                  </button>
                </div>
              </header>
              {fileState === "loading" ? (
                <div className="repository-file-state">
                  <RefreshCw size={20} className="spin" />
                  <strong>GitLab 파일을 불러오는 중입니다</strong>
                </div>
              ) : fileState === "error" ? (
                <div className="repository-file-state repository-file-state--error">
                  <strong>파일을 불러오지 못했습니다</strong>
                  <p>{fileError}</p>
                </div>
              ) : selectedContent !== undefined &&
                selected.kind === "markdown" &&
                markdownView === "preview" ? (
                <MarkdownPreview content={selectedContent} />
              ) : selectedContent !== undefined ? (
                <div className="code-panel">
                  <ol aria-hidden="true">
                    {selectedContent.split("\n").map((_, index) => (
                      <li key={index}>{index + 1}</li>
                    ))}
                  </ol>
                  <pre><code>{selectedContent}</code></pre>
                </div>
              ) : (
                <div className="repository-file-state">
                  <strong>표시할 파일 내용이 없습니다</strong>
                </div>
              )}
              <footer>
                <span>
                  마지막 커밋
                  {selectedCommitMessage ? <small>{selectedCommitMessage}</small> : null}
                </span>
                <code>{selectedCommitId ?? "commit-preview"}</code>
              </footer>
            </>
          ) : (
            <div className="repository-file-state">
              <strong>표시할 파일이 없습니다</strong>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
