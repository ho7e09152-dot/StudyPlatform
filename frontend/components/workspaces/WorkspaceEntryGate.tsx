"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { WorkspaceConnectionFlow } from "@/components/onboarding/WorkspaceOnboarding";
import { DiscoverableWorkspaceSection } from "@/components/workspaces/DiscoverableWorkspaceSection";
import { joinWorkspace as joinWorkspaceApi } from "@/lib/api/services/workspaceApi";
import type { Workspace } from "@/lib/domain/types";
import { APP_ROUTES } from "@/lib/routes";

export function WorkspaceEntryGate({
  forceConnection = false,
  onWorkspaceReady,
}: {
  forceConnection?: boolean;
  onWorkspaceReady: (workspace: Workspace) => void;
}) {
  if (forceConnection) {
    return <WorkspaceConnectionFlow existingWorkspaces={[]} onCreated={onWorkspaceReady} />;
  }

  return (
    <main className="workspace-entry-gate">
      <div className="workspace-hub page-workspace">
        <header className="workspace-hub__header">
          <div><h1>Workspace</h1><p>참여할 수 있는 스터디 공간을 확인하거나 새 저장소를 연결하세요.</p></div>
          <Link className="button button--secondary" href={APP_ROUTES.workspaceNew}><Plus size={17} /> 새 Workspace 연결</Link>
        </header>
        <DiscoverableWorkspaceSection
          hideWhenEmpty={false}
          onJoin={async (workspaceId) => {
            const result = await joinWorkspaceApi(workspaceId);
            onWorkspaceReady(result.workspace);
            return result.workspace;
          }}
        />
      </div>
    </main>
  );
}
