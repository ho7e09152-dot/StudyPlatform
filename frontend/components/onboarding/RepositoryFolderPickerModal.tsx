"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  LoaderCircle,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { RepositoryTreeEntry } from "@/lib/api/services/repositoryApi";
import { validateStorageBasePath } from "@/lib/domain/repository-storage-layout";

type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
};

function normalizePath(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

function parentPaths(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
}

function buildFolderTree(paths: Iterable<string>): FolderNode {
  const root: FolderNode = { name: "저장소", path: "", children: [] };
  const nodes = new Map<string, FolderNode>([["", root]]);

  [...paths].sort((a, b) => a.localeCompare(b, "ko-KR")).forEach((path) => {
    let parent = root;
    for (const currentPath of parentPaths(path)) {
      let node = nodes.get(currentPath);
      if (!node) {
        node = {
          name: currentPath.split("/").at(-1) ?? currentPath,
          path: currentPath,
          children: [],
        };
        nodes.set(currentPath, node);
        parent.children.push(node);
      }
      parent = node;
    }
  });

  const sort = (node: FolderNode) => {
    node.children.sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
    node.children.forEach(sort);
  };
  sort(root);
  return root;
}

function findClosestExistingPath(path: string, folders: Set<string>) {
  const segments = parentPaths(path);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (folders.has(segments[index])) return segments[index];
  }
  return "";
}

export function RepositoryFolderPickerModal({
  value,
  tree,
  reservedFolders,
  loading = false,
  error,
  onRetry,
  onClose,
  onSelect,
}: {
  value: string;
  tree: RepositoryTreeEntry[];
  reservedFolders: string[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
  onSelect: (path: string, createdFolders: string[]) => void;
}) {
  const existingFolders = useMemo(() => new Set([
    "",
    ...tree.filter((entry) => entry.type === "tree").map((entry) => normalizePath(entry.path)),
    ...reservedFolders.map(normalizePath),
  ]), [reservedFolders, tree]);
  const normalizedValue = normalizePath(value);
  const initialPath = existingFolders.has(normalizedValue)
    ? normalizedValue
    : findClosestExistingPath(normalizedValue, existingFolders);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialPath);
  const [expanded, setExpanded] = useState(() => new Set(["", ...parentPaths(initialPath)]));
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const allFolders = useMemo(() => new Set([...existingFolders, ...createdFolders]), [createdFolders, existingFolders]);
  const folderTree = useMemo(() => buildFolderTree(allFolders), [allFolders]);
  const filePaths = useMemo(() => new Set(tree.filter((entry) => entry.type === "blob").map((entry) => normalizePath(entry.path))), [tree]);
  const inputPathMissing = Boolean(normalizedValue && !existingFolders.has(normalizedValue));

  const cancelCreation = useCallback(() => {
    setCreating(false);
    setFolderName("");
    setFolderError("");
  }, []);

  const handleEscape = useCallback(() => {
    if (!creating) return false;
    cancelCreation();
    return true;
  }, [cancelCreation, creating]);

  function selectFolder(path: string) {
    setSelectedPath(path);
    setExpanded((current) => new Set([...current, "", ...parentPaths(path)]));
    cancelCreation();
  }

  function toggle(path: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startCreation() {
    if (selectedPath == null) return;
    setExpanded((current) => new Set([...current, selectedPath]));
    setCreating(true);
    setFolderName("");
    setFolderError("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function createFolder() {
    if (selectedPath == null) return;
    const name = folderName.trim();
    const newPath = [selectedPath, name].filter(Boolean).join("/");
    if (!name) {
      setFolderError("폴더 이름을 입력해주세요.");
      return;
    }
    if (name === "." || name === ".." || /[\\/\u0000-\u001f\u007f]/.test(name)) {
      setFolderError("저장소에서 사용할 수 있는 폴더 이름을 입력해주세요.");
      return;
    }
    if (allFolders.has(newPath) || filePaths.has(newPath)) {
      setFolderError("같은 이름의 폴더나 파일이 이미 있습니다.");
      return;
    }
    const pathError = validateStorageBasePath(newPath);
    if (pathError) {
      setFolderError(pathError);
      return;
    }
    setCreatedFolders((current) => [...current, newPath]);
    setSelectedPath(newPath);
    setExpanded((current) => new Set([...current, selectedPath, newPath]));
    cancelCreation();
  }

  function handleCreateKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      createFolder();
    }
  }

  const breadcrumb = selectedPath == null ? [] : parentPaths(selectedPath);
  const creationRow = creating && selectedPath != null ? (
    <div className="repository-folder-picker__new-folder" style={{ "--folder-depth": selectedPath ? selectedPath.split("/").length + 1 : 1 } as CSSProperties}>
      <Folder size={17} aria-hidden="true" />
      <div>
        <input
          ref={inputRef}
          value={folderName}
          maxLength={100}
          aria-label="새 폴더 이름"
          aria-invalid={Boolean(folderError)}
          placeholder="새 폴더 이름"
          onChange={(event) => { setFolderName(event.target.value); setFolderError(""); }}
          onKeyDown={handleCreateKeyDown}
        />
        {folderError ? <small role="alert">{folderError}</small> : null}
      </div>
      <button type="button" className="icon-button" aria-label="폴더 만들기" onClick={createFolder}><Check size={16} /></button>
      <button type="button" className="icon-button" aria-label="폴더 만들기 취소" onClick={cancelCreation}><X size={16} /></button>
    </div>
  ) : null;

  return (
    <Modal
      title="폴더 선택"
      description="학습 기록을 저장할 폴더를 선택하세요."
      size="folder-picker"
      closeOnBackdrop={!creating}
      onEscapeKeyDown={handleEscape}
      onClose={onClose}
    >
      <div className="repository-folder-picker">
        <nav className="repository-folder-picker__breadcrumb" aria-label="현재 폴더 위치">
          <button type="button" className={selectedPath === "" ? "is-current" : ""} onClick={() => selectFolder("")}>
            저장소
          </button>
          {breadcrumb.map((path) => (
            <span key={path}>
              <ChevronRight size={14} aria-hidden="true" />
              <button
                type="button"
                className={path === selectedPath ? "is-current" : ""}
                onClick={() => selectFolder(path)}
                title={path}
              >
                {path.split("/").at(-1)}
              </button>
            </span>
          ))}
        </nav>

        <div className="repository-folder-picker__toolbar">
          <span>폴더</span>
          <button className="button button--ghost button--small" type="button" disabled={selectedPath == null || loading || Boolean(error)} onClick={startCreation}>
            <Plus size={15} /> 새 폴더
          </button>
        </div>

        <div className="repository-folder-picker__tree" role="tree" aria-label="저장소 폴더">
          {loading ? (
            <div className="repository-folder-picker__state" role="status">
              <LoaderCircle className="spin" size={20} />
              <strong>폴더를 불러오는 중...</strong>
            </div>
          ) : error ? (
            <div className="repository-folder-picker__state" role="alert">
              <Folder size={22} />
              <strong>폴더를 불러오지 못했습니다.</strong>
              <small>{error}</small>
              {onRetry ? <button className="button button--secondary button--small" type="button" onClick={onRetry}><RotateCcw size={14} /> 다시 시도</button> : null}
            </div>
          ) : (
            <>
              <FolderTreeRow
                node={folderTree}
                depth={0}
                selectedPath={selectedPath}
                expanded={expanded}
                onSelect={selectFolder}
                onToggle={toggle}
                creatingParentPath={creating ? selectedPath : null}
                creationRow={creationRow}
              />
              {!folderTree.children.length && !creating ? (
                <div className="repository-folder-picker__state">
                  <Folder size={22} />
                  <strong>아직 폴더가 없습니다.</strong>
                  <small>학습 기록을 저장할 폴더를 새로 만들어보세요.</small>
                  <button className="button button--secondary button--small" type="button" onClick={startCreation}><Plus size={14} /> 새 폴더</button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="repository-folder-picker__footer">
          <div className="repository-folder-picker__selection">
            <span>선택한 위치</span>
            <code title={selectedPath || "저장소 최상위"}>{selectedPath || "저장소 최상위"}</code>
            {inputPathMissing ? <small>입력한 경로가 아직 없어 가장 가까운 상위 폴더를 표시했습니다.</small> : null}
          </div>
          <div className="repository-folder-picker__actions">
            <button className="button button--secondary" type="button" onClick={onClose}>취소</button>
            <button className="button button--primary" type="button" disabled={selectedPath == null || loading || Boolean(error)} onClick={() => selectedPath != null && onSelect(
              selectedPath,
              createdFolders.filter((path) => path === selectedPath || selectedPath.startsWith(`${path}/`)),
            )}>
              선택
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

function FolderTreeRow({ node, depth, selectedPath, expanded, onSelect, onToggle, creatingParentPath, creationRow }: {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  expanded: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  creatingParentPath: string | null;
  creationRow: ReactNode;
}) {
  const open = expanded.has(node.path);
  const hasChildren = node.children.length > 0;
  return (
    <div className="repository-folder-picker__branch">
      <div
        className={`repository-folder-picker__row ${selectedPath === node.path ? "is-selected" : ""}`}
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={selectedPath === node.path}
        aria-expanded={hasChildren ? open : undefined}
        tabIndex={0}
        style={{ "--folder-depth": depth } as CSSProperties}
        onClick={() => onSelect(node.path)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(node.path);
          } else if (event.key === "ArrowRight" && hasChildren && !open) onToggle(node.path);
          else if (event.key === "ArrowLeft" && hasChildren && open) onToggle(node.path);
        }}
      >
        {hasChildren ? (
          <button type="button" className="repository-folder-picker__toggle" aria-label={`${node.name} ${open ? "접기" : "펼치기"}`} onClick={(event) => { event.stopPropagation(); onToggle(node.path); }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : <span className="repository-folder-picker__toggle" aria-hidden="true" />}
        {open ? <FolderOpen size={17} aria-hidden="true" /> : <Folder size={17} aria-hidden="true" />}
        <span>{node.name}</span>
      </div>
      {hasChildren && open ? (
        <div role="group">
          {node.children.map((child) => (
            <FolderTreeRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} expanded={expanded} onSelect={onSelect} onToggle={onToggle} creatingParentPath={creatingParentPath} creationRow={creationRow} />
          ))}
        </div>
      ) : null}
      {creatingParentPath === node.path ? creationRow : null}
    </div>
  );
}
