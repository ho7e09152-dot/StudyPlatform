import { apiGet } from "@/lib/api/client/http";
import type { Repository } from "@/lib/domain/repository";

interface RepositorySummaryDto {
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

export async function listRepositories(search = "", signal?: AbortSignal): Promise<Repository[]> {
  const params = new URLSearchParams({ perPage: "50" });
  if (search.trim()) params.set("search", search.trim());
  const repositories = await apiGet<RepositorySummaryDto[]>(`/api/v1/repositories?${params.toString()}`, signal);
  return repositories.map((repository) => ({
    provider: repository.provider,
    externalId: repository.externalId,
    id: Number(repository.externalId),
    name: repository.name,
    path: repository.fullName,
    defaultBranch: repository.defaultBranch,
    webUrl: repository.webUrl,
    visibility: repository.visibility,
    accessLevel: repository.providerPermission == null ? null : Number(repository.providerPermission),
    capabilities: repository.capabilities,
  }));
}
