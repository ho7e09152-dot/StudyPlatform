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

export function parseProviderLinkResult(value: string | null): ProviderLinkResult {
  if (value === "github_success") return "success";
  if (value === "github_cancelled") return "cancelled";
  if (value === "github_collision") return "collision";
  if (value === "github_account_exists") return "account-exists";
  if (value === "github_expired") return "expired";
  if (value?.startsWith("github_")) return "failed";
  return null;
}
