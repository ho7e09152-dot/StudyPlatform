import type { GitLabProject } from "@/lib/api/types/gitlab";
import type { Workspace } from "@/lib/domain/types";
import type { ProviderId } from "../providers/provider-descriptors.ts";
import { getProviderDescriptor } from "../providers/provider-descriptors.ts";

export type RepositoryProvider = ProviderId;

export interface Repository {
  provider: RepositoryProvider;
  externalId: string;
  id: number;
  name: string;
  path: string;
  defaultBranch: string | null;
  webUrl: string | null;
  visibility: string;
  accessLevel?: number | null;
  capabilities: { canRead: boolean; canWrite: boolean; canManage: boolean };
}

export interface RepositoryConnection {
  provider: RepositoryProvider;
  externalRepositoryId: string;
  fullName?: string;
  defaultBranch?: string;
  webUrl?: string;
  visibility?: string;
  /** @deprecated use externalRepositoryId */
  repositoryId: number;
  /** @deprecated use fullName */
  repositoryPath?: string;
}

export const REPOSITORY_PROVIDER_LABEL: Record<RepositoryProvider, string> = {
  GITLAB: getProviderDescriptor("GITLAB").displayName,
  GITHUB: getProviderDescriptor("GITHUB").displayName,
};

export function toRepository(project: GitLabProject): Repository {
  return {
    provider: "GITLAB",
    externalId: String(project.id),
    id: project.id,
    name: project.name,
    path: project.pathWithNamespace,
    defaultBranch: project.defaultBranch,
    webUrl: project.webUrl,
    visibility: project.visibility,
    accessLevel: project.accessLevel,
    capabilities: {
      canRead: (project.accessLevel ?? 0) >= 20,
      canWrite: (project.accessLevel ?? 0) >= 30,
      canManage: (project.accessLevel ?? 0) >= 40,
    },
  };
}

export function getWorkspaceRepositoryConnection(
  workspace: Workspace,
): RepositoryConnection {
  return {
    provider: workspace.repository?.provider ?? "GITLAB",
    externalRepositoryId: workspace.repository?.externalRepositoryId ?? String(workspace.gitlabProjectId),
    fullName: workspace.repository?.fullName ?? (workspace.gitlabProjectPath || undefined),
    defaultBranch: workspace.repository?.defaultBranch ?? (workspace.defaultBranch || undefined),
    webUrl: workspace.repository?.webUrl ?? undefined,
    visibility: workspace.repository?.visibility ?? undefined,
    repositoryId: Number(workspace.repository?.externalRepositoryId ?? workspace.gitlabProjectId),
    repositoryPath: workspace.repository?.fullName ?? (workspace.gitlabProjectPath || undefined),
  };
}

export function getRepositoryVisibilityLabel(visibility: string) {
  const labels: Record<string, string> = {
    private: "비공개",
    internal: "내부",
    public: "공개",
  };
  return labels[visibility.toLowerCase()] ?? "공개 범위 확인 필요";
}

export function getGitLabAccessLabel(accessLevel?: number | null) {
  if (accessLevel == null) return null;
  if (accessLevel >= 50) return "Owner";
  if (accessLevel >= 40) return "Maintainer";
  if (accessLevel >= 30) return "Developer";
  if (accessLevel >= 20) return "Reporter";
  if (accessLevel >= 10) return "Guest";
  return "접근 권한 없음";
}

export function canWriteRepository(accessLevel?: number | null) {
	return accessLevel != null && accessLevel >= 30;
}
