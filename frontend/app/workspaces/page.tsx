import type { Metadata } from "next";
import { WorkspaceHub } from "@/components/workspaces/WorkspaceHub";

export const metadata: Metadata = { title: "Workspace" };

export default function WorkspacesPage() {
  return <WorkspaceHub />;
}
