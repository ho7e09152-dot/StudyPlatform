import type { Metadata } from "next";
import { RepositoryMigrationPage } from "@/components/settings/RepositoryMigrationPage";

export const metadata: Metadata = { title: "저장 구조 이전" };

export default function SettingsMigrationRoute() {
  return <RepositoryMigrationPage />;
}
