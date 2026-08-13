import type { Metadata } from "next";
import { ScheduleEditorRoute } from "@/components/schedule/ScheduleEditorRoute";

export const metadata: Metadata = { title: "새 학습 일정" };

export default function NewSchedulePage() {
  return <ScheduleEditorRoute />;
}
