import type { Metadata } from "next";
import { RepositoryWorkspace } from "@/components/repository/RepositoryWorkspace";

export const metadata: Metadata = { title: "학습 라이브러리" };

export default function RepositoryPage() {
  return <RepositoryWorkspace />;
}
