"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  FolderGit2,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Toast } from "@/components/ui/Toast";
import { useGitLabConnection } from "@/lib/api/hooks/useGitLabConnection";

const navigation = [
  { href: "/today", label: "오늘", icon: LayoutDashboard },
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/records", label: "기록", icon: ChartNoAxesColumnIncreasing },
  { href: "/repository", label: "저장소", icon: FolderGit2 },
  { href: "/settings", label: "설정", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    workspaces,
    workspace,
    currentUserId,
    switchWorkspace,
    toast,
    dismissToast,
  } = useWorkspace();
  const connection = useGitLabConnection();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const currentMember = workspace.members.find(
    (member) => member.id === currentUserId,
  )!;
  const gitLabConnected =
    connection.state === "ready" &&
    connection.data?.status === "CONNECTED";
  const gitLabStatusLabel =
    connection.state === "loading"
      ? "GitLab 확인 중"
      : connection.state === "error"
        ? "GitLab 연결 실패"
        : gitLabConnected
          ? "GitLab 연결됨"
          : "GitLab 설정 필요";
  const gitLabStatusDetail = gitLabConnected
    ? connection.data?.project?.pathWithNamespace
    : connection.error ?? connection.data?.message ?? "백엔드 응답 대기 중";

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (
        workspaceMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setWorkspaceMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [workspaceMenuOpen]);

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="주요 메뉴">
        <Link className="brand-block" href="/" aria-label="STUDY 랜딩 페이지로 이동">
          <Image
            className="brand-image"
            src="/ssafy_icon.png"
            alt="SSAFY"
            width={684}
            height={354}
            priority
            unoptimized
          />
          <div>
            <strong>STUDY</strong>
            <span>GitLab learning hub</span>
          </div>
        </Link>

        <div className="workspace-picker" ref={menuRef}>
          <button
            type="button"
            className="workspace-picker__button"
            aria-expanded={workspaceMenuOpen}
            aria-haspopup="menu"
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className="repo-badge">
              <FolderGit2 size={17} />
            </span>
            <span>
              <strong>{workspace.name}</strong>
              <small>{workspace.gitlabProjectPath}</small>
            </span>
            <ChevronDown size={17} />
          </button>
          {workspaceMenuOpen ? (
            <div className="workspace-menu" role="menu">
              <p>내 Workspace</p>
              {workspaces.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={candidate.id === workspace.id}
                  onClick={() => {
                    switchWorkspace(candidate.id);
                    setWorkspaceMenuOpen(false);
                  }}
                >
                  <span>
                    <strong>{candidate.name}</strong>
                    <small>{candidate.gitlabProjectPath}</small>
                  </span>
                  {candidate.id === workspace.id ? <Check size={17} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="primary-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                className={active ? "active" : undefined}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sync-card">
            <div>
              <span
                className={`status-dot ${
                  gitLabConnected
                    ? ""
                    : connection.state === "error"
                      ? "status-dot--danger"
                      : "status-dot--warning"
                }`}
              />
              {gitLabStatusLabel}
            </div>
            <small title={gitLabStatusDetail}>{gitLabStatusDetail}</small>
            <button
              type="button"
              onClick={connection.reload}
              disabled={connection.state === "loading"}
            >
              <RefreshCw
                className={connection.state === "loading" ? "spin" : undefined}
                size={16}
              />
              {connection.state === "loading" ? "확인 중" : "연결 다시 확인"}
            </button>
          </div>
          <div className="account-row">
            <Avatar member={currentMember} />
            <span>
              <strong>{currentMember.displayName}</strong>
              <small>@{currentMember.username}</small>
            </span>
            <button type="button" className="icon-button" aria-label="알림">
              <Bell size={18} />
            </button>
          </div>
        </div>
      </aside>

      <header className="mobile-header">
        <button
          type="button"
          className="icon-button"
          aria-label="메뉴 열기"
          onClick={() => setDrawerOpen(true)}
        >
          <Menu size={21} />
        </button>
        <Image
          className="brand-image brand-image--small"
          src="/ssafy_icon.png"
          alt="SSAFY"
          width={684}
          height={354}
          priority
          unoptimized
        />
        <span className="mobile-workspace">
          <strong>{workspace.name}</strong>
          <small>{workspace.defaultBranch}</small>
        </span>
        <Avatar member={currentMember} size="small" />
      </header>

      {drawerOpen ? (
        <div className="mobile-drawer-layer">
          <button
            type="button"
            className="mobile-drawer-scrim"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
          />
          <nav className="mobile-drawer" aria-label="모바일 주요 메뉴">
            <div className="mobile-drawer__head">
              <Image
                className="brand-image"
                src="/ssafy_icon.png"
                alt="SSAFY"
                width={684}
                height={354}
                unoptimized
              />
              <span>
                <strong>STUDY</strong>
                <small>{workspace.name}</small>
              </span>
              <button
                type="button"
                className="icon-button"
                aria-label="메뉴 닫기"
                onClick={() => setDrawerOpen(false)}
              >
                <X size={19} />
              </button>
            </div>
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  className={active ? "active" : undefined}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={19} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}

      <main className="app-main">{children}</main>
      {toast ? (
        <Toast
          key={toast.id}
          title={toast.title}
          detail={toast.detail}
          onClose={dismissToast}
        />
      ) : null}
    </div>
  );
}
