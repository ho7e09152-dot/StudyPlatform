import { apiGet, apiRequest } from "@/lib/api/client/http";
import type { ProviderId } from "@/lib/providers/provider-descriptors";

export interface StudyIngUser {
  id: string;
  legacyGitLabUserId: number;
  username: string;
  name: string;
  avatarUrl: string | null;
  webUrl: string | null;
  profileCompleted: boolean;
  repositoryFileName: string | null;
  timezone: string;
  termsVersion: string | null;
  termsAgreedAt: string | null;
  privacyVersion: string | null;
  privacyAgreedAt: string | null;
  minimumAgeConfirmedAt: string | null;
  requiresReconsent: boolean;
  themeMode: ThemeMode;
  accentColor: AccentColor;
}

export type ThemeMode = "LIGHT" | "DARK";
export type AccentColor = "PURPLE" | "BLUE" | "TEAL" | "ORANGE" | "ROSE";

export interface AuthSession {
  authenticated: boolean;
  mode?: "gitlab-oauth";
  identityProvider?: ProviderId;
  user?: StudyIngUser;
}

export type AuthenticatedGitLabUser = StudyIngUser;

export interface ProviderAccount {
  id: string;
  provider: ProviderId;
  externalUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  webUrl: string | null;
  status: "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED";
}

export interface ProviderCapabilities {
  authProviders: ProviderId[];
  accountLinkProviders: ProviderId[];
  repositoryProviders: ProviderId[];
  features: { workspaceDiscovery: boolean };
}

export function getAuthSession(signal?: AbortSignal) {
  return apiGet<AuthSession>("/api/v1/auth/me", signal);
}

export function listProviderAccounts(signal?: AbortSignal) {
  return apiGet<ProviderAccount[]>("/api/v1/me/provider-accounts", signal);
}

export function getProviderCapabilities(signal?: AbortSignal) {
  return apiGet<ProviderCapabilities>("/api/v1/capabilities", signal);
}

export function completeGitLabLogin() {
  return apiRequest<{ returnUrl: string }>("/api/v1/auth/gitlab/complete", { method: "POST" });
}

export function updateAccountProfile(input: {
  displayName: string;
  repositoryFileName: string;
  timezone: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  confirmMinimumAge: boolean;
}) {
  return apiRequest<StudyIngUser>("/api/v1/auth/profile", {
    method: "PUT",
    body: input,
  });
}

export function updateAccountPreferences(input: {
  themeMode: ThemeMode;
  accentColor: AccentColor;
}) {
  return apiRequest<StudyIngUser>("/api/v1/auth/preferences", {
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

export function getProviderAccountLinkUrl(provider: ProviderId, returnUrl = "/settings/accounts") {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/+$/, "");
  if (provider === "GITHUB") return `${base}/api/v1/provider-accounts/github/link`;
  return `${base}/api/v1/auth/gitlab/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}
