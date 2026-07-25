export interface GitLabUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string | null;
}

export interface GitLabProject {
  id: number;
  name: string;
  pathWithNamespace: string;
  defaultBranch: string | null;
  webUrl: string | null;
  visibility: string;
}

export interface GitLabTreeItem {
  id: string;
  name: string;
  type: "blob" | "tree";
  path: string;
  mode: string;
}

export interface GitLabConnection {
  configured: boolean;
  status: "CONNECTED" | "NOT_CONFIGURED";
  message: string;
  checkedAt: string;
  user: GitLabUser | null;
  project: GitLabProject | null;
  repositoryTree: GitLabTreeItem[];
}

export interface GitLabFileContent {
  fileName: string;
  filePath: string;
  size: number;
  content: string;
  ref: string;
  blobId: string;
  commitId: string;
  lastCommitId: string;
}
