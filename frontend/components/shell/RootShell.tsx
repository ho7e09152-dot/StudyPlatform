"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { AppShell } from "@/components/shell/AppShell";
import { RepositoryConnectionProvider } from "@/lib/api/hooks/useRepositoryConnection";

const publicRoutes = new Set(["/", "/login", "/demo", "/auth/callback", "/terms", "/privacy"]);
const protectedPrefixes = [
  "/today",
  "/schedule",
  "/records",
  "/library",
  "/repository",
  "/settings",
  "/workspaces",
  "/onboarding",
];

export function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (publicRoutes.has(pathname) || !protectedRoute) {
    return children;
  }

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <RepositoryConnectionProvider>
          <AppShell>{children}</AppShell>
        </RepositoryConnectionProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
