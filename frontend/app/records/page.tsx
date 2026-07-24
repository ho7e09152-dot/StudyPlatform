import type { Metadata } from "next";
import { RecordsWorkspace } from "@/components/records/RecordsWorkspace";

export const metadata: Metadata = { title: "학습 기록" };

export default function RecordsPage() {
  return <RecordsWorkspace />;
}
