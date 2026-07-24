import type { Metadata } from "next";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
