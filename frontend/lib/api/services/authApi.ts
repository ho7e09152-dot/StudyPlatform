import { apiGet, apiRequest } from "@/lib/api/client/http";

export interface AuthenticatedGitLabUser {
  id: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string | null;
  profileCompleted: boolean;
  repositoryFileName: string | null;
  timezone: string;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  themeMode: ThemeMode;
  accentColor: AccentColor;
}

export type ThemeMode = "LIGHT" | "DARK";
export type AccentColor = "PURPLE" | "BLUE" | "TEAL" | "ORANGE" | "ROSE";

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

export function updateAccountProfile(input: {
  displayName: string;
  repositoryFileName: string;
  timezone: string;
  acceptTerms: boolean;
}) {
  return apiRequest<AuthenticatedGitLabUser>("/api/v1/auth/profile", {
    method: "PUT",
    body: input,
  });
}

export function updateAccountPreferences(input: {
  themeMode: ThemeMode;
  accentColor: AccentColor;
}) {
  return apiRequest<AuthenticatedGitLabUser>("/api/v1/auth/preferences", {
    method: "PATCH",
    body: input,
  });
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
