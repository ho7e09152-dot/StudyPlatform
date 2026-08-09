import { apiGet } from "@/lib/api/client/http";
import type {
  GitLabConnection,
  GitLabFileContent,
  GitLabProject,
  RepositoryImportAnalysis,
} from "@/lib/api/types/gitlab";

export function getGitLabConnection(projectId: number, signal?: AbortSignal) {
  return apiGet<GitLabConnection>(
    `/api/v1/gitlab/projects/${projectId}/connection-check`,
    signal,
  );
}

export function analyzeGitLabRepository(projectId: number, signal?: AbortSignal) {
  return apiGet<RepositoryImportAnalysis>(
    `/api/v1/gitlab/projects/${projectId}/import-analysis`,
    signal,
  );
}

export function listGitLabProjects(search = "", signal?: AbortSignal) {
  const params = new URLSearchParams({ perPage: "50" });
  if (search.trim()) params.set("search", search.trim());
  return apiGet<GitLabProject[]>(
    `/api/v1/gitlab/projects?${params.toString()}`,
    signal,
  );
}

export function getGitLabFile(projectId: number, path: string, signal?: AbortSignal) {
  const search = new URLSearchParams({ path });
  return apiGet<GitLabFileContent>(
    `/api/v1/gitlab/projects/${projectId}/repository/file?${search.toString()}`,
    signal,
  );
}
