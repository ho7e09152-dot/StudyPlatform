import type { Metadata } from "next";
import { LoginPage } from "@/components/marketing/LoginPage";
import type { ProviderId } from "@/lib/providers/provider-descriptors";

export const metadata: Metadata = {
  title: "로그인",
};

interface CapabilityResponse {
  authProviders?: unknown;
}

function isProviderId(value: unknown): value is ProviderId {
  return value === "GITLAB" || value === "GITHUB";
}

async function getInitialAuthProviders(): Promise<ProviderId[]> {
  const apiBaseUrl = (
    process.env.API_INTERNAL_BASE_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? "http://localhost:8080"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/capabilities`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return ["GITLAB"];

    const capabilities = await response.json() as CapabilityResponse;
    if (!Array.isArray(capabilities.authProviders)) return ["GITLAB"];

    const providers = capabilities.authProviders.filter(isProviderId);
    return providers.length > 0 ? providers : ["GITLAB"];
  } catch {
    return ["GITLAB"];
  }
}

export default async function LoginRoute() {
  const initialAuthProviders = await getInitialAuthProviders();
  return <LoginPage initialAuthProviders={initialAuthProviders} />;
}
