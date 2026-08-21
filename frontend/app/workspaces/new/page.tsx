"use client";

import { WorkspaceConnectionFlow } from "@/components/onboarding/WorkspaceOnboarding";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useRouter } from "next/navigation";

export default function NewWorkspacePage() {
	const router = useRouter();
  const { workspaces, switchWorkspace, activateWorkspace } = useWorkspace();
  return (
    <WorkspaceConnectionFlow
      withinAppShell
      existingWorkspaces={workspaces}
      onOpenWorkspace={(workspace) => {
        switchWorkspace(workspace.id);
		router.push("/today");
      }}
		onCreated={(created) => {
		activateWorkspace(created, "Workspace를 사용할 준비가 되었어요");
		router.push("/today");
      }}
    />
  );
}
