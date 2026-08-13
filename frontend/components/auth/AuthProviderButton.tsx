import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { ProviderIcon } from "@/components/providers/ProviderIcon";
import { getProviderDescriptor, type ProviderId } from "@/lib/providers/provider-descriptors";

export interface AuthProviderButtonProps {
  provider: ProviderId;
  href: string;
  children: ReactNode;
}

export function AuthProviderButton({ provider, href, children }: AuthProviderButtonProps) {
  const descriptor = getProviderDescriptor(provider);
  return (
    <a className="auth-provider-button" href={href} aria-label={`${descriptor.displayName} 인증으로 ${String(children)}`}>
      <span aria-hidden="true"><ProviderIcon provider={provider} size={20} /></span>
      <strong>{children}</strong>
      <ArrowRight size={18} aria-hidden="true" />
    </a>
  );
}
