import { apiGet } from "@/lib/api/client/http";
import type {
  GitLabConnection,
  GitLabFileContent,
} from "@/lib/api/types/gitlab";

export function getGitLabConnection(signal?: AbortSignal) {
  return apiGet<GitLabConnection>("/api/v1/gitlab/connection", signal);
}

export function getGitLabFile(path: string, signal?: AbortSignal) {
  const search = new URLSearchParams({ path });
  return apiGet<GitLabFileContent>(
    `/api/v1/gitlab/repository/file?${search.toString()}`,
    signal,
  );
}
