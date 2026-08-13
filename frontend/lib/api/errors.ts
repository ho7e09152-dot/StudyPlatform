import { ApiError } from "@/lib/api/client/http";

const ERROR_COPY: Record<string, string> = {
  GITLAB_RECONNECT_REQUIRED: "GitLab 연결을 다시 확인해주세요.",
  GITLAB_AUTHENTICATION_FAILED: "GitLab 연결이 만료되었습니다. 다시 연결해주세요.",
  GITLAB_PROJECT_ACCESS_DENIED: "이 GitLab 프로젝트에 접근할 권한이 없습니다.",
  REPOSITORY_ACCESS_REVOKED: "GitLab 프로젝트 접근 권한을 확인해주세요.",
  REPOSITORY_PROVIDER_UNAVAILABLE: "GitLab 연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
  PROVIDER_ACCOUNT_REQUIRED: "GitLab 계정 연결을 다시 확인해주세요.",
  WORKSPACE_ACCESS_DENIED: "현재 Workspace에 접근할 권한이 없습니다.",
  WORKSPACE_MANAGER_REQUIRED: "소유자 또는 관리자 권한이 필요합니다.",
  WORKSPACE_OWNER_REQUIRED: "소유자 권한이 필요합니다.",
  WORKSPACE_PROJECT_ALREADY_CONNECTED: "이미 다른 Workspace와 연결된 프로젝트입니다.",
	WORKSPACE_NOT_DISCOVERABLE: "참여 가능한 Workspace를 찾을 수 없습니다.",
	WORKSPACE_JOIN_PERMISSION_REQUIRED: "Workspace 참여와 학습 제출을 위해 GitLab 프로젝트 쓰기 권한이 필요합니다.",
	REPOSITORY_WRITE_PERMISSION_REQUIRED: "Workspace 연결과 학습 제출을 위해 GitLab 프로젝트 쓰기 권한이 필요합니다.",
  DOCUMENT_VERSION_CONFLICT: "다른 화면에서 문서가 변경되었습니다. 최신 내용을 다시 확인해주세요.",
  REPOSITORY_CHANGED: "확인 이후 저장소가 변경되었습니다. 다시 확인해주세요.",
  RATE_LIMITED: "요청이 많아 잠시 처리할 수 없습니다. 잠시 후 다시 시도해주세요.",
};

/**
 * API의 내부 오류나 upstream 응답을 그대로 사용자 UI에 노출하지 않는다.
 * 검증/충돌 응답은 Backend가 사용자 문구로 관리하므로 그대로 사용할 수 있다.
 */
export function getUserFacingError(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError
      ? "네트워크 연결을 확인한 뒤 다시 시도해주세요."
      : fallback;
  }

  const mapped = ERROR_COPY[error.code];
  if (mapped) return mapped;
  if (error.status === 403) return "이 작업을 수행할 권한이 없습니다.";
  if (error.status === 404) return "요청한 정보를 찾을 수 없습니다.";
  if (error.status === 400 || error.status === 409 || error.status === 422) {
    return error.message || fallback;
  }
  return fallback;
}
