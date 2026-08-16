"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { AlertTriangle, Check, ChevronDown, FileText, Folder, FolderGit2, GripVertical, Plus, X } from "lucide-react";
import type { RepositoryTreeEntry } from "@/lib/api/services/repositoryApi";
import { RepositoryFolderPickerModal } from "@/components/onboarding/RepositoryFolderPickerModal";
import {
  addStorageBlock,
  buildStoragePreview,
  getStorageFormatOptions,
  isRecommendedStorageLayout,
  optimizeStorageFormats,
  placeStorageBlock,
  setStorageBlockFormat,
  STORAGE_BLOCK_LABEL,
  validateStorageBasePath,
  validateStorageLayout,
  validateStorageResolvedPaths,
  type RepositoryStorageLayout,
  type StorageLayoutBlock,
} from "@/lib/domain/repository-storage-layout";

type Zone = "folder" | "file";

export function StorageLayoutBuilder({
  section = "all",
  basePath,
  layout,
  tree,
  treeLoading = false,
  treeError,
  detectedRecords = 0,
  reservedFolders: controlledReservedFolders,
  onReservedFoldersChange,
  onRetryTree,
  onBasePathChange,
  onLayoutChange,
}: {
  section?: "all" | "path" | "layout";
  basePath: string;
  layout: RepositoryStorageLayout;
  tree: RepositoryTreeEntry[];
  treeLoading?: boolean;
  treeError?: string;
  detectedRecords?: number;
  reservedFolders?: string[];
  onReservedFoldersChange?: (folders: string[]) => void;
  onRetryTree?: () => void;
  onBasePathChange: (value: string) => void;
  onLayoutChange: (value: RepositoryStorageLayout) => void;
}) {
  const [dragged, setDragged] = useState<StorageLayoutBlock | null>(null);
  const [openFormat, setOpenFormat] = useState<StorageLayoutBlock | null>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [localReservedFolders, setLocalReservedFolders] = useState<string[]>([]);
  const reservedFolders = controlledReservedFolders ?? localReservedFolders;
  const showPath = section !== "layout";
  const showLayout = section !== "path";
  const allBlocks: StorageLayoutBlock[] = ["YEAR", "MONTH", "DATE", "DAY", "NAME"];
  const used = new Set([...layout.folderBlocks, ...layout.fileNameBlocks]);
  const clickCandidates = new Map(allBlocks.map((block) => [block, addStorageBlock(layout, block)]));
  const normalizedBase = basePath.trim().replace(/^\/+|\/+$/g, "");
  const blockedByFile = normalizedBase && tree.some((entry) => entry.type === "blob"
    && (entry.path === normalizedBase || normalizedBase.startsWith(`${entry.path}/`)));
  const pathError = validateStorageBasePath(basePath) || (blockedByFile ? "선택한 위치의 상위 경로에 파일이 있어 폴더를 만들 수 없어요." : null);
  const preview = buildStoragePreview(basePath, layout);
  const resolvedPathError = validateStorageResolvedPaths(basePath, layout);
  const pathErrors = [
    ...(pathError ? [pathError] : []),
    ...(treeError ? ["저장소 폴더를 확인하지 못했어요. 폴더 선택에서 다시 시도해주세요."] : []),
  ];
  const layoutErrors = [
    ...validateStorageLayout(layout),
    ...(resolvedPathError ? [resolvedPathError] : []),
  ];
  const errors = section === "path" ? pathErrors : section === "layout" ? layoutErrors : [...pathErrors, ...layoutErrors];
  const recommended = isRecommendedStorageLayout(layout);
  const layoutSummary = [
    ...layout.folderBlocks.map((block) => STORAGE_BLOCK_LABEL[block]),
    layout.fileNameBlocks.length ? `${layout.fileNameBlocks.map((block) => STORAGE_BLOCK_LABEL[block]).join("-")}.md` : "파일 이름 필요",
  ].join(" / ");
  const examplePath = preview.find((path) => !path.endsWith("session.yml") && !path.endsWith(".study-workspace/config.yml")) ?? preview[0] ?? "";

  function remove(block: StorageLayoutBlock) {
    onLayoutChange(optimizeStorageFormats({
      ...layout,
      folderBlocks: layout.folderBlocks.filter((value) => value !== block),
      fileNameBlocks: layout.fileNameBlocks.filter((value) => value !== block),
    }));
  }

  function place(block: StorageLayoutBlock, zone: Zone, index: number) {
    const candidate = placeStorageBlock(layout, block, zone, index);
    if (candidate) onLayoutChange(candidate);
  }

  function drop(event: DragEvent, zone: Zone, index: number) {
    event.preventDefault();
    const block = (event.dataTransfer.getData("text/storage-block") || dragged) as StorageLayoutBlock | null;
    if (block) place(block, zone, index);
    setDragged(null);
  }

  function rememberReservedFolders(createdFolders: string[]) {
    const next = [...new Set([...reservedFolders, ...createdFolders])];
    if (onReservedFoldersChange) onReservedFoldersChange(next);
    else setLocalReservedFolders(next);
  }

  return (
    <section className={`storage-layout storage-layout--${section}`} aria-labelledby={showLayout ? "storage-layout-title" : undefined} aria-label={showPath && !showLayout ? "학습 기록 위치" : undefined}>
      {showLayout ? <h3 id="storage-layout-title" className="sr-only">학습 기록 저장 방식</h3> : null}

      {showLayout && detectedRecords > 0 ? (
        <div className="storage-layout__detected" role="status">
          <Check size={16} /><span><strong>기존 학습 기록 구조를 발견했어요.</strong>{detectedRecords}개의 파일 패턴을 현재 설정에 반영했습니다.</span>
        </div>
      ) : null}

      {showPath ? <label className="field storage-layout__path">
        <span>학습 기록 위치</span>
        <div className="storage-layout__path-control">
          <div className="storage-layout__path-input">
            <span className="storage-layout__path-prefix" aria-hidden="true"><FolderGit2 size={15} /> 저장소</span>
            <span className="storage-layout__path-separator" aria-hidden="true">/</span>
            <input value={basePath} onChange={(event) => onBasePathChange(event.target.value)} placeholder="study" />
          </div>
          <button className="button button--secondary" type="button" onClick={() => setFolderPickerOpen(true)}><Folder size={16} /> 폴더 선택</button>
        </div>
        {treeLoading ? <small role="status">폴더 정보를 확인하는 중...</small> : <small>이 경로 아래에 학습 기록이 저장됩니다.</small>}
      </label> : null}

      {section === "path" && errors.length ? (
        <div className="storage-layout__errors" role="alert">
          <AlertTriangle size={17} /><div><p>{errors[0]}</p></div>
        </div>
      ) : null}

      {showLayout ? <div className={`storage-layout__panel${errors.length ? " is-invalid" : ""}`}>
        <div className={`storage-layout__compact ${errors.length ? "is-invalid" : ""}`}>
          <div className="storage-layout__compact-copy">
            <div className="storage-layout__compact-heading">
              <span>학습 기록 저장 방식</span>
              <span className={recommended ? "storage-layout__status is-recommended" : "storage-layout__status"}>
                {recommended ? "추천" : "사용자 설정"}
              </span>
            </div>
            <strong>{layoutSummary}</strong>
            <span className="storage-layout__compact-example"><small>예시 경로</small><code>{examplePath || "저장 구조를 설정해주세요."}</code></span>
            {!customizing && errors.length ? (
              <span className="storage-layout__compact-error" role="alert">
                <strong>저장 구조를 확인해 주세요.</strong><small>{errors[0]}</small>
              </span>
            ) : null}
          </div>
          <button type="button" className="button button--secondary button--small storage-layout__toggle"
            aria-expanded={customizing} aria-controls="storage-layout-custom-settings"
            onClick={() => { setOpenFormat(null); setCustomizing((current) => !current); }}>
            {customizing ? "설정 닫기" : "직접 설정"}<ChevronDown size={15} />
          </button>
        </div>

      {customizing ? (
        <div className="storage-layout__customize" id="storage-layout-custom-settings">
          <div className="storage-layout__grid">
            <div className="storage-layout__editor">
          <div className="storage-block-palette" aria-label="사용 가능한 구조 블록">
            <span>사용할 블록</span>
            <div>{allBlocks.map((block) => (
              <button key={block} type="button" aria-pressed={used.has(block)} disabled={!used.has(block) && !clickCandidates.get(block)} draggable={!used.has(block) && Boolean(clickCandidates.get(block))}
                onDragStart={(event) => { setDragged(block); event.dataTransfer.setData("text/storage-block", block); }}
                onDragEnd={() => setDragged(null)} onClick={() => {
                  if (used.has(block)) {
                    remove(block);
                    return;
                  }
                  const candidate = clickCandidates.get(block);
                  if (candidate) onLayoutChange(candidate);
                }}>
                {used.has(block) ? <><Check size={13} /> {STORAGE_BLOCK_LABEL[block]}</>
                  : clickCandidates.get(block) ? <><Plus size={13} /> {STORAGE_BLOCK_LABEL[block]}</>
                  : <>{STORAGE_BLOCK_LABEL[block]} <small>추가 불가</small></>}
              </button>
            ))}</div>
          </div>

              <StorageRuleLine layout={layout}
                dragged={dragged} openFormat={openFormat} onOpenFormat={setOpenFormat}
                onDrop={drop} onDragStart={(block) => { setOpenFormat(null); setDragged(block); }} onDragEnd={() => setDragged(null)} onRemove={remove} onLayoutChange={onLayoutChange} />

              {errors.length ? (
                <div className="storage-layout__errors" role="alert">
                  <AlertTriangle size={17} /><div>{errors.map((error) => <p key={error}>{error}</p>)}</div>
                </div>
              ) : null}

              <details className="storage-layout__advanced">
                <summary><ChevronDown size={16} /> 고급 설정</summary>
                <div><span>파일 확장자</span><strong>.md</strong><small>현재 Markdown 형식만 지원합니다.</small></div>
              </details>
            </div>

            <aside className="storage-preview" aria-label="저장 구조 미리보기">
              <header><strong>미리보기</strong><small>현재 설정으로 만들어질 예시 구조입니다.</small></header>
              {errors.length ? <PreviewEmpty invalid /> : preview.length ? <>
                <PreviewTree paths={preview} baseDepth={basePath.split("/").filter(Boolean).length} />
                <div className="storage-preview__example"><small>예시 경로</small><code>{examplePath}</code></div>
              </> : <PreviewEmpty />}
            </aside>
          </div>
        </div>
      ) : null}
      </div> : null}
      {showPath && folderPickerOpen ? (
        <RepositoryFolderPickerModal
          value={basePath}
          tree={tree}
          reservedFolders={reservedFolders}
          loading={treeLoading}
          error={treeError}
          onRetry={onRetryTree}
          onClose={() => setFolderPickerOpen(false)}
          onSelect={(path, createdFolders) => {
            rememberReservedFolders(createdFolders);
            onBasePathChange(path);
            setFolderPickerOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

function StorageRuleLine({ layout, dragged, openFormat, onDrop, onDragStart, onDragEnd, onOpenFormat, onRemove, onLayoutChange }: {
  layout: RepositoryStorageLayout;
  dragged: StorageLayoutBlock | null;
  openFormat: StorageLayoutBlock | null;
  onDrop: (event: DragEvent, zone: Zone, index: number) => void;
  onDragStart: (block: StorageLayoutBlock) => void;
  onDragEnd: () => void;
  onOpenFormat: (block: StorageLayoutBlock | null) => void;
  onRemove: (block: StorageLayoutBlock) => void;
  onLayoutChange: (layout: RepositoryStorageLayout) => void;
}) {
  const fileDropAllowed = Boolean(dragged && placeStorageBlock(layout, dragged, "file", 0));

  return (
    <div className="storage-rule-builder">
      <div className="storage-rule-builder__labels"><span>현재 구조</span></div>
      <div className={`storage-rule-builder__line ${dragged ? "is-dragging" : ""}`}>
        <div className="storage-rule-builder__folders">
          {layout.folderBlocks.map((block, index) => <div className="storage-block-wrap" key={block}>
            <DropPosition zone="folder" index={index} dragged={dragged} layout={layout} onDrop={onDrop} />
            <StorageBlock block={block} layout={layout} openFormat={openFormat} removable
              onDragStart={onDragStart} onDragEnd={onDragEnd} onOpenFormat={onOpenFormat}
              onRemove={onRemove} onLayoutChange={onLayoutChange} />
          </div>)}
          <DropPosition zone="folder" index={layout.folderBlocks.length} dragged={dragged} layout={layout} onDrop={onDrop} />
          {!layout.folderBlocks.length && !dragged ? <span className="storage-block-zone__empty">폴더 블록을 추가해주세요.</span> : null}
        </div>
        <span className="storage-rule-builder__separator" aria-hidden="true" />
        <div
          className={`storage-rule-builder__file ${dragged ? fileDropAllowed ? "is-drop-allowed" : "is-drop-disabled" : ""}`}
          onDragOver={fileDropAllowed ? (event) => event.preventDefault() : undefined}
          onDrop={fileDropAllowed ? (event) => {
            event.stopPropagation();
            onDrop(event, "file", 0);
          } : undefined}
        >
          <DropPosition zone="file" index={0} dragged={dragged} layout={layout} onDrop={onDrop} />
          {layout.fileNameBlocks[0] ? <StorageBlock block={layout.fileNameBlocks[0]} layout={layout} openFormat={openFormat}
            onDragStart={onDragStart} onDragEnd={onDragEnd} onOpenFormat={onOpenFormat}
            onRemove={onRemove} onLayoutChange={onLayoutChange} /> : <span className="storage-block-zone__empty">날짜 또는 이름</span>}
          <strong className="storage-block-zone__suffix">.md</strong>
        </div>
      </div>
      <span className="storage-block-zone__hint">블록을 드래그해 순서를 바꾸거나 파일 이름 위치에 놓을 수 있어요.</span>
    </div>
  );
}

function StorageBlock({ block, layout, openFormat, removable = false, onDragStart, onDragEnd, onOpenFormat, onRemove, onLayoutChange }: {
  block: StorageLayoutBlock;
  layout: RepositoryStorageLayout;
  openFormat: StorageLayoutBlock | null;
  removable?: boolean;
  onDragStart: (block: StorageLayoutBlock) => void;
  onDragEnd: () => void;
  onOpenFormat: (block: StorageLayoutBlock | null) => void;
  onRemove: (block: StorageLayoutBlock) => void;
  onLayoutChange: (layout: RepositoryStorageLayout) => void;
}) {
  return <div className="storage-block" draggable onDragStart={(event) => {
    onDragStart(block);
    event.dataTransfer.setData("text/storage-block", block);
  }} onDragEnd={onDragEnd}>
    <GripVertical size={13} aria-hidden="true" />
    <BlockFormat block={block} layout={layout} open={openFormat === block}
      onOpenChange={(nextOpen) => onOpenFormat(nextOpen ? block : null)} onLayoutChange={onLayoutChange} />
    {removable ? <button type="button" aria-label={`${STORAGE_BLOCK_LABEL[block]} 블록 제거`} onClick={() => onRemove(block)}><X size={12} /></button> : null}
  </div>;
}

function DropPosition({ zone, index, dragged, layout, onDrop }: {
  zone: Zone;
  index: number;
  dragged: StorageLayoutBlock | null;
  layout: RepositoryStorageLayout;
  onDrop: (event: DragEvent, zone: Zone, index: number) => void;
}) {
  const allowed = Boolean(dragged && placeStorageBlock(layout, dragged, zone, index));
  return <span
    className={`storage-block-insertion ${dragged ? allowed ? "is-allowed" : "is-disabled" : ""}`}
    aria-hidden="true"
    onDragOver={allowed ? (event) => event.preventDefault() : undefined}
    onDrop={allowed ? (event) => { event.stopPropagation(); onDrop(event, zone, index); } : undefined}
  />;
}

function BlockFormat({ block, layout, open, onOpenChange, onLayoutChange }: {
  block: StorageLayoutBlock;
  layout: RepositoryStorageLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLayoutChange: (layout: RepositoryStorageLayout) => void;
}) {
  const config = getStorageFormatOptions(layout, block);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();
  const current = block === "YEAR" ? layout.yearFormat : block === "MONTH" ? layout.monthFormat
    : block === "DAY" ? layout.dayFormat : layout.dateFormat;

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChange(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onOpenChange]);

  if (!config) return <strong>{STORAGE_BLOCK_LABEL[block]}</strong>;

  function select(value: string) {
    const next = setStorageBlockFormat(layout, block, value);
    if (next) onLayoutChange(next);
    onOpenChange(false);
  }

  return (
    <div className="storage-block-format" ref={rootRef}>
      <button ref={triggerRef} type="button" className="storage-block-format__trigger" aria-haspopup="dialog"
        aria-expanded={open} aria-controls={open ? popoverId : undefined} onClick={() => onOpenChange(!open)}>
        {STORAGE_BLOCK_LABEL[block]} <ChevronDown size={12} />
      </button>
      {open ? <div className="storage-block-format__popover" id={popoverId} role="dialog" aria-label={config.title}>
        <strong>{config.title}</strong>
        {config.description ? <small>{config.description}</small> : null}
        <div role="radiogroup" aria-label={config.title}>{config.options.map((option) => (
          <label key={option.value}>
            <input type="radio" name={`storage-${block}`} checked={current === option.value}
              onChange={() => select(option.value)} />
            <span>{option.example}</span>
          </label>
        ))}</div>
      </div> : null}
    </div>
  );
}

type PreviewNode = { file: boolean; children: Record<string, PreviewNode> };

function PreviewTree({ paths, baseDepth }: { paths: string[]; baseDepth: number }) {
  const root: PreviewNode = { file: false, children: {} };
  for (const path of paths) {
    let cursor = root;
    path.split("/").filter(Boolean).forEach((segment, index, values) => {
      const file = index === values.length - 1;
      cursor.children[segment] ??= { file, children: {} };
      cursor = cursor.children[segment];
    });
  }
  function render(node: PreviewNode, depth = 0): React.ReactNode {
    return Object.entries(node.children).map(([name, child]) => (
      <div className="storage-preview__branch" key={`${depth}-${name}`}>
        <div className={`storage-preview__line ${depth >= baseDepth ? "is-generated" : ""}`}
          style={{ paddingLeft: `${depth * 18 + 12}px`, "--preview-depth": depth } as CSSProperties}>
          {child.file ? <FileText size={15} /> : <Folder size={15} />}
          <strong title={name}>{name}</strong>
        </div>
        {Object.keys(child.children).length ? render(child, depth + 1) : null}
      </div>
    ));
  }
  return <div className="storage-preview__tree">{render(root)}</div>;
}

function PreviewEmpty({ invalid = false }: { invalid?: boolean }) {
  return <div className="storage-preview__empty">
    <Folder size={22} />
    <strong>{invalid ? "현재 설정으로는 저장 구조를 만들 수 없습니다." : "저장 구조를 설정해주세요."}</strong>
    <small>{invalid ? "왼쪽 설정을 확인해주세요." : "설정 결과가 여기에 표시됩니다."}</small>
  </div>;
}
