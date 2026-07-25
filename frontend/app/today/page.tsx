import type { Metadata } from "next";
import { TodayWorkspace } from "@/components/today/TodayWorkspace";

export const metadata: Metadata = {
  title: "오늘의 학습",
};

export default function TodayPage() {
  return <TodayWorkspace />;
}
