"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { AppShell } from "@/components/shell/AppShell";
import { GitLabConnectionProvider } from "@/lib/api/hooks/useGitLabConnection";

const publicRoutes = new Set(["/", "/login"]);

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (publicRoutes.has(pathname)) {
    return children;
  }

  return (
    <WorkspaceProvider>
      <GitLabConnectionProvider>
        <AppShell>{children}</AppShell>
      </GitLabConnectionProvider>
    </WorkspaceProvider>
  );
}
