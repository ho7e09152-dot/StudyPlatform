"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, FolderGit2, LayoutGrid, Plus } from "lucide-react";
import type { Workspace } from "@/lib/domain/types";
import { confirmUnsavedChanges } from "@/lib/navigation/unsavedChanges";
import { APP_ROUTES } from "@/lib/routes";

export function WorkspaceSwitcher({
  workspaces,
  workspace,
  onSwitch,
}: {
  workspaces: Workspace[];
  workspace: Workspace;
  onSwitch: (workspaceId: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (open && event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="workspace-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-picker__button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="repo-badge" aria-hidden="true">
          <FolderGit2 size={18} />
        </span>
        <span>
          <strong>{workspace.name}</strong>
        </span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open ? (
        <div className="workspace-menu" role="menu">
          <p>Workspace</p>
          <div className="workspace-menu__list">
            {[workspace, ...workspaces.filter((candidate) => candidate.id !== workspace.id)].map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                role="menuitemradio"
                aria-checked={candidate.id === workspace.id}
                onClick={() => {
                  if (candidate.id !== workspace.id) {
                    if (!confirmUnsavedChanges()) return;
                    onSwitch(candidate.id);
                    router.push("/today");
                  }
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{candidate.name}</strong>
                  <small>{candidate.repository?.fullName ?? candidate.gitlabProjectPath}</small>
                </span>
                {candidate.id === workspace.id ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
          <div className="workspace-menu__utilities">
            <Link
              className="workspace-menu__all"
              role="menuitem"
              href={APP_ROUTES.workspaces}
              onClick={() => setOpen(false)}
            >
              <LayoutGrid size={18} aria-hidden="true" />
              <span><strong>모든 Workspace</strong><small>Workspace 관리</small></span>
            </Link>
            <Link
              className="workspace-menu__create"
              role="menuitem"
              href={APP_ROUTES.workspaceNew}
              onClick={() => setOpen(false)}
            >
              <Plus size={18} aria-hidden="true" />
              <span>
                <strong>새 Workspace 연결</strong>
                <small>다른 저장소 연결</small>
              </span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
