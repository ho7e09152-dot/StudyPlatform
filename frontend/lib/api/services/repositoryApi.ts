import { apiGet } from "@/lib/api/client/http";
import type { Repository } from "@/lib/domain/repository";
import type { ProviderId } from "@/lib/providers/provider-descriptors";
import type { RepositoryImportAnalysis } from "@/lib/api/types/gitlab";

export interface RepositorySummaryDto {
  provider: Repository["provider"];
  externalId: string;
  name: string;
  fullName: string;
  visibility: string;
  defaultBranch: string | null;
  webUrl: string | null;
  capabilities: Repository["capabilities"];
  providerPermission: string | null;
  connectionState: string;
}

const REPOSITORY_PAGE_SIZE = 100;
const MAX_REPOSITORY_PAGES = 100;

export async function listRepositories(search = "", signal?: AbortSignal, provider: ProviderId = "GITLAB"): Promise<Repository[]> {
  const repositories: RepositorySummaryDto[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_REPOSITORY_PAGES; page += 1) {
    const params = new URLSearchParams({ page: String(page), perPage: String(REPOSITORY_PAGE_SIZE), provider });
    if (search.trim()) params.set("search", search.trim());
    const current = await apiGet<RepositorySummaryDto[]>(`/api/v1/repositories?${params.toString()}`, signal);
    for (const repository of current) {
      const key = `${repository.provider}:${repository.externalId}`;
      if (!seen.has(key)) {
        seen.add(key);
        repositories.push(repository);
      }
    }
    if (current.length < REPOSITORY_PAGE_SIZE) break;
  }
  return repositories.map((repository) => ({
    provider: repository.provider,
    externalId: repository.externalId,
    id: Number(repository.externalId),
    name: repository.name,
    path: repository.fullName,
    defaultBranch: repository.defaultBranch,
    webUrl: repository.webUrl,
    visibility: repository.visibility,
    accessLevel: repository.provider === "GITLAB" && repository.providerPermission != null
      ? Number(repository.providerPermission)
      : repository.capabilities.canManage ? 40 : repository.capabilities.canWrite ? 30 : repository.capabilities.canRead ? 20 : 0,
    capabilities: repository.capabilities,
  }));
}

export function getRepository(provider: ProviderId, externalId: string, signal?: AbortSignal) {
  return apiGet<RepositorySummaryDto>(
    `/api/v1/repositories/${provider}/${encodeURIComponent(externalId)}`,
    signal,
  );
}

export function analyzeRepository(provider: ProviderId, externalId: string, signal?: AbortSignal) {
  return apiGet<RepositoryImportAnalysis>(
    `/api/v1/repositories/${provider}/${encodeURIComponent(externalId)}/import-analysis`,
    signal,
  );
}

export interface RepositoryTreeEntry {
  path: string;
  name: string;
  type: "blob" | "tree";
}

export function listRepositoryTree(provider: ProviderId, externalId: string, signal?: AbortSignal) {
  return apiGet<RepositoryTreeEntry[]>(
    `/api/v1/repositories/${provider}/${encodeURIComponent(externalId)}/tree`,
    signal,
  );
}
