import type { Metadata } from "next";
import { RepositoryWorkspace } from "@/components/repository/RepositoryWorkspace";

export const metadata: Metadata = { title: "저장소" };

export default function RepositoryPage() {
  return <RepositoryWorkspace />;
}
