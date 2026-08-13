import type { Metadata } from "next";
import { SettingsWorkspace, type SettingsSection } from "@/components/settings/SettingsWorkspace";

export const metadata: Metadata = { title: "설정" };

const supported = new Set<SettingsSection>([
  "general", "study-rules", "commit-rules", "members", "notifications", "repository", "data",
  "profile", "accounts", "appearance", "account", "security", "danger",
]);

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <SettingsWorkspace section={supported.has(section as SettingsSection) ? section as SettingsSection : "general"} />;
}
