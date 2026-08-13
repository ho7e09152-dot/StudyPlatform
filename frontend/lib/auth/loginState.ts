export type LoginNoticeTone = "neutral" | "warning" | "danger";

export interface LoginNoticeState {
  tone: LoginNoticeTone;
  title: string;
  description: string;
  actionLabel: string;
}
export function getLoginNoticeState(code: string | null): LoginNoticeState | null {
  if (!code) return null;

  if (code === "session_expired") {
    return {
      tone: "warning",
      title: "로그인이 만료되었습니다.",
      description: "계속하려면 다시 로그인해 주세요.",
      actionLabel: "GitLab로 다시 로그인",
    };
  }

  if (code === "reconnect_required") {
    return {
      tone: "warning",
      title: "GitLab 연결을 다시 확인해 주세요.",
      description: "연결이 만료되었거나 필요한 권한을 확인할 수 없습니다.",
      actionLabel: "GitLab 다시 연결",
    };
  }

  if (["access_denied", "oauth_cancelled", "cancelled"].includes(code)) {
    return {
      tone: "neutral",
      title: "GitLab 로그인이 취소되었습니다.",
      description: "원할 때 다시 로그인할 수 있습니다.",
      actionLabel: "GitLab로 계속하기",
    };
  }

  return {
    tone: "danger",
    title: "GitLab로 로그인하지 못했습니다.",
    description: "잠시 후 다시 시도해 주세요.",
    actionLabel: "다시 시도",
  };
}
