import type { ProviderAccount } from "../api/services/authApi.ts";
import type { ProviderId } from "./provider-descriptors.ts";

export type ProviderAccountRow = ProviderAccount;

/** Capability is the only source that may introduce a provider row into Settings. */
export function buildProviderAccountRows(
  accounts: ProviderAccount[],
  accountLinkProviders: ProviderId[],
): ProviderAccountRow[] {
  return Array.from(new Set(accountLinkProviders)).map((provider) =>
    accounts.find((account) => account.provider === provider) ?? {
      id: `available-${provider}`,
      provider,
      externalUserId: "",
      username: null,
      displayName: null,
      avatarUrl: null,
      webUrl: null,
      status: "DISCONNECTED",
    },
  );
}

export type ProviderLinkResult = "success" | "cancelled" | "failed" | "collision" | "account-exists" | "expired" | null;

export interface ProviderLinkNotice {
  message: string;
  tone: "neutral" | "danger";
  retry: boolean;
}

export function parseProviderLinkResult(value: string | null): ProviderLinkResult {
  if (value === "github_success") return "success";
  if (value === "github_cancelled") return "cancelled";
  if (value === "github_collision") return "collision";
  if (value === "github_account_exists") return "account-exists";
  if (value === "github_expired") return "expired";
  if (value?.startsWith("github_")) return "failed";
  return null;
}

export function getProviderLinkNotice(result: ProviderLinkResult): ProviderLinkNotice | null {
  if (result === "cancelled") {
    return { message: "GitHub 계정 연결이 취소되었습니다. 필요하면 다시 연결할 수 있습니다.", tone: "neutral", retry: true };
  }
  if (result === "collision") {
    return { message: "이 GitHub 계정은 이미 다른 Study-ing 계정에 연결되어 있습니다.", tone: "danger", retry: true };
  }
  if (result === "account-exists") {
    return { message: "이미 다른 GitHub 계정이 연결되어 있습니다. 연결된 계정의 다시 승인을 이용해 주세요.", tone: "danger", retry: false };
  }
  if (result === "expired") {
    return { message: "GitHub 계정 연결 요청이 만료되었습니다. 다시 시도해 주세요.", tone: "danger", retry: true };
  }
  if (result === "failed") {
    return { message: "GitHub 계정을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", tone: "danger", retry: true };
  }
  return null;
}
