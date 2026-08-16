import type { RepositoryImportAnalysis } from "@/lib/api/types/gitlab";
import { initialWorkspaces } from "@/lib/data/seed";
import type { Repository } from "@/lib/domain/repository";
import type { Workspace } from "@/lib/domain/types";
import type { ProviderId } from "@/lib/providers/provider-descriptors";
import { DEFAULT_STORAGE_BASE_PATH, RECOMMENDED_STORAGE_LAYOUT } from "@/lib/domain/repository-storage-layout";

const demoRepositories: Repository[] = [
  {
    provider: "GITLAB",
    externalId: "900001",
    id: 900001,
    name: "데모 알고리즘 연습",
    path: "study-ing-demo/algorithm-practice",
    defaultBranch: "main",
    webUrl: null,
    visibility: "private",
    accessLevel: 40,
    capabilities: { canRead: true, canWrite: true, canManage: true },
  },
  {
    provider: "GITLAB",
    externalId: "900002",
    id: 900002,
    name: "데모 CS 스터디",
    path: "study-ing-demo/cs-study",
    defaultBranch: "main",
    webUrl: null,
    visibility: "private",
    accessLevel: 40,
    capabilities: { canRead: true, canWrite: true, canManage: true },
  },
];

export function listDemoRepositories(search = "", provider: ProviderId = "GITLAB") {
  if (provider !== "GITLAB") return [];
  const query = search.trim().toLocaleLowerCase("ko-KR");
  return demoRepositories
    .filter((repository) => !query || `${repository.name} ${repository.path}`.toLocaleLowerCase("ko-KR").includes(query))
    .map((repository) => structuredClone(repository));
}

export function getDemoRepositoryAnalysis(repository: Repository): RepositoryImportAnalysis {
  return {
    projectId: repository.id,
    projectPath: repository.path,
    defaultBranch: repository.defaultBranch ?? "main",
    classification: "EMPTY",
    repositoryBasePath: DEFAULT_STORAGE_BASE_PATH,
    repositorySchemaVersion: 3,
    treeFingerprint: `demo-${repository.externalId}`,
    totalFiles: 0,
    compatibleSessions: 0,
    compatibleSubmissions: 0,
    ignoredFiles: 0,
    issues: [],
    detectedLayout: structuredClone(RECOMMENDED_STORAGE_LAYOUT),
    layoutConfidence: 1,
    detectedRecords: 0,
  };
}

export function createDemoWorkspace(repository: Repository, name: string): Workspace {
  const template = structuredClone(initialWorkspaces[0]);
  return {
    ...template,
    id: `demo-workspace-${repository.externalId}`,
    name,
    gitlabProjectId: repository.id,
    gitlabProjectPath: repository.path,
    defaultBranch: repository.defaultBranch ?? "main",
    repositoryBasePath: DEFAULT_STORAGE_BASE_PATH,
    importMode: "EMPTY",
    lastSyncedAt: new Date().toISOString(),
    sessions: {},
    submissions: {},
    repository: {
      provider: repository.provider,
      externalRepositoryId: repository.externalId,
      fullName: repository.path,
      webUrl: null,
      visibility: repository.visibility,
      defaultBranch: repository.defaultBranch,
      canRead: true,
      canWrite: true,
      canManage: true,
      providerPermission: "DEMO",
    },
    storageLayout: structuredClone(RECOMMENDED_STORAGE_LAYOUT),
  };
}
