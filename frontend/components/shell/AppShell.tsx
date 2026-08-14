"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  AlertTriangle,
  FolderGit2,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ActivityInbox } from "@/components/notifications/ActivityInbox";
import { AppThemeProvider, useAppTheme } from "@/components/providers/AppThemeProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Toast } from "@/components/ui/Toast";
import { PageTransition } from "@/components/ui/PageTransition";
import { WorkspaceSwitcher } from "@/components/shell/WorkspaceSwitcher";
import { useRepositoryConnection } from "@/lib/api/hooks/useRepositoryConnection";
import { APP_ROUTES } from "@/lib/routes";
import { getWorkspaceRepositoryConnection, REPOSITORY_PROVIDER_LABEL } from "@/lib/domain/repository";
import type { StudyMember } from "@/lib/domain/types";
import { getPageTransitionPath } from "@/lib/motion/pageTransition";
import { useExitTransition } from "@/lib/motion/useExitTransition";

const navigation = [
  { href: "/today", label: "오늘", icon: LayoutDashboard },
  { href: "/schedule", label: "일정", icon: CalendarDays },
  { href: "/records", label: "기록", icon: ChartNoAxesColumnIncreasing },
  { href: APP_ROUTES.learningLibrary, label: "학습 라이브러리", icon: FolderGit2 },
  { href: "/settings", label: "설정", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppThemeProvider><ThemedAppShell>{children}</ThemedAppShell></AppThemeProvider>;
}

function ThemedAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageTransitionPath = getPageTransitionPath(pathname);
  const scheduleEditorRoute = pathname === APP_ROUTES.scheduleNew
    || /^\/schedule\/[^/]+\/edit$/.test(pathname);
  const { themeMode, accentColor } = useAppTheme();
  const {
    workspaces,
    workspace,
    currentUserId,
    switchWorkspace,
    toast,
    dismissToast,
  } = useWorkspace();
  const connection = useRepositoryConnection();
  const repositoryConnection = getWorkspaceRepositoryConnection(workspace);
  const providerLabel = REPOSITORY_PROVIDER_LABEL[repositoryConnection.provider];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const currentMember = workspace.members.find(
    (member) => member.id === currentUserId,
  )!;
  const repositoryConnected =
    connection.state === "ready" &&
    connection.data?.connectionState === "AVAILABLE";
  const repositoryAccessRevoked = [
    "GITLAB_PROJECT_ACCESS_DENIED",
    "GITLAB_PROJECT_NOT_FOUND",
    "GITHUB_REPOSITORY_ACCESS_DENIED",
    "GITHUB_REPOSITORY_NOT_FOUND",
    "REPOSITORY_ACCESS_REVOKED",
  ].includes(connection.errorCode ?? "");
  const repositoryStatusLabel =
    connection.state === "loading"
      ? `${providerLabel} 확인 중`
      : repositoryAccessRevoked
        ? `${providerLabel} 접근 권한 필요`
        : connection.state === "error"
          ? `${providerLabel} 연결 확인 필요`
        : repositoryConnected
          ? `${providerLabel} 연결됨`
          : `${providerLabel} 설정 필요`;
  const repositoryStatusDetail = repositoryAccessRevoked
    ? `현재 Workspace의 ${providerLabel} 저장소 접근 권한을 확인해주세요.`
    : repositoryConnected
    ? repositoryConnection.repositoryPath ?? connection.data?.fullName
    : connection.state === "loading"
      ? "연결 상태를 확인하고 있습니다."
      : `${providerLabel} 연결 상태를 다시 확인해주세요.`;

  return (
    <div className="app-frame" data-theme={themeMode.toLowerCase()} data-accent={accentColor.toLowerCase()}>
      <aside className="sidebar" aria-label="주요 메뉴">
        <Link className="brand-block" href="/" aria-label="Study-ing 랜딩 페이지로 이동">
          <Image className="app-brand-icon" src="/study-ing-icon.png" alt="" width={898} height={898} unoptimized priority />
          <div>
            <strong>Study-ing</strong>
            <span>학습 Workspace</span>
          </div>
        </Link>

        <WorkspaceSwitcher
          workspaces={workspaces}
          workspace={workspace}
          onSwitch={switchWorkspace}
        />

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
          <ActivityInbox />
        </nav>

        <div className="sidebar-foot">
          <div className={`sync-card ${repositoryConnected ? "sync-card--healthy" : "sync-card--attention"}`}>
            <div>
              <span
                className={`status-dot ${
                  repositoryConnected
                    ? ""
                    : connection.state === "error"
                      ? "status-dot--danger"
                      : "status-dot--warning"
                }`}
              />
              {repositoryStatusLabel}
            </div>
            {!repositoryConnected ? (
              <>
                <small title={repositoryStatusDetail}>{repositoryStatusDetail}</small>
                <button
                  type="button"
                  onClick={connection.reload}
                  disabled={connection.state === "loading"}
                >
                  <RefreshCw
                    className={connection.state === "loading" ? "spin" : undefined}
                    size={16}
                  />
                  {connection.state === "loading" ? "확인 중" : "다시 확인"}
                </button>
              </>
            ) : null}
          </div>
          <AccountMenu member={currentMember} />
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
        <Link className="mobile-brand" href="/" aria-label="Study-ing 랜딩 페이지로 이동">
          <Image src="/study-ing-icon.png" alt="" width={898} height={898} unoptimized priority />
          <strong>Study-ing</strong>
        </Link>
        <span className="mobile-workspace">
          <strong>{workspace.name}</strong>
          <small>학습 Workspace</small>
        </span>
        <ActivityInbox variant="mobile" />
        <button className="mobile-profile-button" type="button" aria-label="프로필 메뉴 열기" onClick={() => setDrawerOpen(true)}>
          <Avatar member={currentMember} size="small" />
        </button>
      </header>

      {drawerOpen ? (
        <MobileNavigationDrawer
          workspaceName={workspace.name}
          pathname={pathname}
          member={currentMember}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}

      <main className={`app-main${scheduleEditorRoute ? " app-main--schedule-editor" : ""}`}>
        <PageTransition transitionKey={`${workspace.id}:${pageTransitionPath}`}>
          {repositoryAccessRevoked && !pathname.startsWith("/workspaces") && pathname !== "/settings/accounts" ? (
            <div className="page-stack library-route-state" role="alert">
              <AlertTriangle size={24} aria-hidden="true" />
              <strong>{providerLabel} 저장소 접근 권한을 확인해주세요.</strong>
              <p>현재 Workspace의 저장소에 접근할 수 없어 학습 내용을 표시하지 않습니다.</p>
              <div className="inline-actions">
                <button type="button" className="button button--secondary" onClick={connection.reload}>다시 확인</button>
                <Link className="button button--ghost" href={APP_ROUTES.workspaces}>다른 Workspace 선택</Link>
              </div>
            </div>
          ) : children}
        </PageTransition>
      </main>
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

function MobileNavigationDrawer({
  workspaceName,
  pathname,
  member,
  onClose,
}: {
  workspaceName: string;
  pathname: string;
  member: StudyMember;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef(true);
  const { motionState, requestClose } = useExitTransition(onClose, 200);
  const navigateAndClose = () => {
    restoreFocusRef.current = false;
    requestClose();
  };

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const panel = panelRef.current;
    panel?.focus();
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (restoreFocusRef.current) previous?.focus();
    };
  }, [requestClose]);

  return (
    <div className="mobile-drawer-layer" data-motion-state={motionState}>
      <button type="button" className="mobile-drawer-scrim" aria-label="메뉴 닫기" onClick={requestClose} />
      <nav ref={panelRef} className="mobile-drawer" aria-label="모바일 주요 메뉴" tabIndex={-1}>
        <div className="mobile-drawer__head">
          <Image className="app-brand-icon" src="/study-ing-icon.png" alt="" width={898} height={898} unoptimized priority />
          <span><strong>Study-ing</strong><small>{workspaceName}</small></span>
          <button type="button" className="icon-button" aria-label="메뉴 닫기" onClick={requestClose}><X size={19} /></button>
        </div>
        <Link href={APP_ROUTES.workspaces} onClick={navigateAndClose}><FolderGit2 size={19} />모든 Workspace</Link>
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link key={item.href} className={active ? "active" : undefined} href={item.href} aria-current={active ? "page" : undefined} onClick={navigateAndClose}>
              <Icon size={19} />{item.label}
            </Link>
          );
        })}
        <div className="mobile-drawer__account"><AccountMenu member={member} /></div>
      </nav>
    </div>
  );
}
