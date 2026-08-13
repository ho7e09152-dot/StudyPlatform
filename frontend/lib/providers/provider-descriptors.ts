export type ProviderId = "GITLAB" | "GITHUB";

export interface ProviderDescriptor {
  id: ProviderId;
  displayName: string;
  repositoryLabel: string;
  authLabel: string;
  connectLabel: string;
  reconnectLabel: string;
}

const DESCRIPTORS: Record<ProviderId, ProviderDescriptor> = {
  GITLAB: {
    id: "GITLAB",
    displayName: "GitLab",
    repositoryLabel: "GitLab 프로젝트",
    authLabel: "GitLab로 계속하기",
    connectLabel: "GitLab 연결",
    reconnectLabel: "GitLab 다시 승인",
  },
  GITHUB: {
    id: "GITHUB",
    displayName: "GitHub",
    repositoryLabel: "GitHub 저장소",
    authLabel: "GitHub로 계속하기",
    connectLabel: "GitHub 연결",
    reconnectLabel: "GitHub 다시 승인",
  },
};

export function getProviderDescriptor(provider: ProviderId) {
  return DESCRIPTORS[provider];
}

export const CURRENT_PROVIDER: ProviderId = "GITLAB";
