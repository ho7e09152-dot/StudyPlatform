import type { Metadata } from "next";
import { ScheduleWorkspace } from "@/components/schedule/ScheduleWorkspace";

export const metadata: Metadata = { title: "학습 일정" };

export default function SchedulePage() {
  return <ScheduleWorkspace />;
}
