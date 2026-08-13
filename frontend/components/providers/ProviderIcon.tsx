import { Github, Gitlab } from "lucide-react";
import type { ComponentProps } from "react";
import type { ProviderId } from "@/lib/providers/provider-descriptors";

export function ProviderIcon({ provider, ...props }: { provider: ProviderId } & ComponentProps<typeof Gitlab>) {
  const Icon = provider === "GITHUB" ? Github : Gitlab;
  return <Icon {...props} />;
}
