import { apiGet, apiRequest } from "@/lib/api/client/http";

export interface AuthenticatedGitLabUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string | null;
}

export interface AuthSession {
  authenticated: boolean;
  mode?: "gitlab-oauth";
  user?: AuthenticatedGitLabUser;
}

export function getAuthSession(signal?: AbortSignal) {
  return apiGet<AuthSession>("/api/v1/auth/me", signal);
}

export function completeGitLabLogin() {
  return apiRequest<{ returnUrl: string }>("/api/v1/auth/gitlab/complete", { method: "POST" });
}

export function logout() {
  return apiRequest<void>("/api/v1/auth/logout", { method: "POST" });
}

export function deleteAccount() {
  return apiRequest<void>("/api/v1/auth/account", { method: "DELETE" });
}

export function getGitLabReconnectUrl(returnUrl = "/settings") {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  return `${base}/api/v1/auth/gitlab/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}
