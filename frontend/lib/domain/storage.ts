import { getProviderDescriptor, type ProviderId } from "@/lib/providers/provider-descriptors";

export function getStorageDetailsCopy(provider: ProviderId) {
  const name = getProviderDescriptor(provider).displayName;
  return {
    title: `${name} 저장 정보`,
    originalLabel: `${name} 원본`,
  };
}
