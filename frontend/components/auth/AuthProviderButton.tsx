import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ProviderIcon } from "@/components/providers/ProviderIcon";
import type { ProviderId } from "@/lib/providers/provider-descriptors";

export interface AuthProviderButtonProps {
  provider: ProviderId;
  href: string;
  children: ReactNode;
}

export function AuthProviderButton({ provider, href, children }: AuthProviderButtonProps) {
  return (
    <a className="auth-provider-button" data-provider={provider.toLowerCase()} href={href}>
      <span className="auth-provider-button__icon" aria-hidden="true"><ProviderIcon provider={provider} size={20} /></span>
      <strong>{children}</strong>
      <ArrowRight className="auth-provider-button__arrow" size={18} aria-hidden="true" />
    </a>
  );
}
