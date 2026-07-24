"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clipboard,
  CodeXml,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  GitBranch,
  Search,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { getSubmissionKey } from "@/lib/domain/metrics";
import { getRepositoryFiles } from "@/lib/repository/serializers";

export function RepositoryWorkspace() {
  const { workspace } = useWorkspace();
  const files = useMemo(() => getRepositoryFiles(workspace), [workspace]);
  const [selectedPath, setSelectedPath] = useState(
    files.find((file) => file.path.endsWith("session.yml"))?.path ?? files[0]?.path,
  );
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const selected = files.find((file) => file.path === selectedPath) ?? files[0];
  const filteredFiles = files.filter((file) =>
    file.path.toLocaleLowerCase("ko").includes(
      searchQuery.trim().toLocaleLowerCase("ko"),
    ),
  );
  const folders = Array.from(
    new Set(filteredFiles.map((file) => file.path.split("/")[0])),
  );
  const selectedFolder = selected?.path.split("/")[0];
  const selectedDate = selectedFolder?.replace(
    /^(\d{2})(\d{2})(\d{2})$/,
    "20$1-$2-$3",
  );
  const selectedSession = selectedDate
    ? workspace.sessions[selectedDate]
    : undefined;
  const selectedFileName = selected?.path.split("/")[1];
  const selectedMember = workspace.members.find(
    (member) => member.fileName === selectedFileName,
  );
  const selectedSubmission =
    selectedFolder && selectedMember
      ? workspace.submissions[
          getSubmissionKey(selectedFolder, selectedMember.id)
        ]
      : undefined;
  const selectedCommitId =
    selectedFileName === "session.yml"
      ? selectedSession?.lastCommitId
      : selectedSubmission?.lastCommitId;
  const selectedCommitMessage =
    selectedFileName === "session.yml"
      ? selectedSession
        ? `study: ${selectedSession.revision > 1 ? "update" : "create"} session ${selectedSession.folder}`
        : undefined
      : selectedSubmission?.lastCommitMessage;

  function handleSearch(value: string) {
    setSearchQuery(value);
    const normalizedQuery = value.trim().toLocaleLowerCase("ko");
    if (!normalizedQuery) return;

    const selectedMatches = selectedPath
      ?.toLocaleLowerCase("ko")
      .includes(normalizedQuery);
    if (!selectedMatches) {
      const firstMatch = files.find((file) =>
        file.path.toLocaleLowerCase("ko").includes(normalizedQuery),
      );
      if (firstMatch) setSelectedPath(firstMatch.path);
    }
    setCollapsedFolders(new Set());
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
    if (!selected) return;
    await navigator.clipboard?.writeText(selected.content);
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
        <button
          type="button"
          className="button button--secondary"
          disabled
          title="GitLab webUrl 백엔드 연동 후 사용할 수 있습니다."
        >
          GitLab에서 열기 <ExternalLink size={16} />
        </button>
      </header>

      <div className="repo-status-bar">
        <span><Folder size={16} /> {workspace.gitlabProjectPath}</span>
        <span><GitBranch size={16} /> {workspace.defaultBranch}</span>
        <span className="status-badge success">읽기 가능</span>
      </div>

      <div className="repository-layout">
        <aside className="surface repository-tree" aria-label="저장소 파일">
          <div className="repository-tree__title"><strong>Files</strong><small>{files.length}개 파일</small></div>
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
                <span>{folder}/</span>
                <small>
                  {
                    filteredFiles.filter((file) =>
                      file.path.startsWith(`${folder}/`),
                    ).length
                  }
                </small>
                {collapsedFolders.has(folder) ? (
                  <ChevronRight size={15} />
                ) : (
                  <ChevronDown size={15} />
                )}
              </button>
              {!collapsedFolders.has(folder)
                ? filteredFiles
                    .filter((file) => file.path.startsWith(`${folder}/`))
                    .map((file) => {
                      const Icon = file.kind === "yaml" ? FileCode2 : FileText;
                      return (
                        <button
                          key={file.path}
                          type="button"
                          className={selected?.path === file.path ? "active" : undefined}
                          onClick={() => setSelectedPath(file.path)}
                        >
                          <Icon size={15} /> {file.path.split("/")[1]}
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
                <div><h2 id="file-name">{selected.path}</h2><p>{selected.kind === "yaml" ? "YAML · session configuration" : "Markdown · member submission"}</p></div>
                <button type="button" className="button button--secondary button--small" onClick={copy}>
                  {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  {copied ? "복사됨" : "원문 복사"}
                </button>
              </header>
              <div className="code-panel">
                <ol aria-hidden="true">{selected.content.split("\n").map((_, index) => <li key={index}>{index + 1}</li>)}</ol>
                <pre><code>{selected.content}</code></pre>
              </div>
              <footer>
                <span>
                  마지막 커밋
                  {selectedCommitMessage ? <small>{selectedCommitMessage}</small> : null}
                </span>
                <code>{selectedCommitId ?? "commit-preview"}</code>
              </footer>
            </>
          ) : <p>표시할 파일이 없습니다.</p>}
        </section>
      </div>
    </div>
  );
}
