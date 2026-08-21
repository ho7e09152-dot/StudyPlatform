import type { Metadata } from "next";
import { ScheduleEditorRoute } from "@/components/schedule/ScheduleEditorRoute";

export const metadata: Metadata = { title: "항목 추가" };

export default function NewSchedulePage() {
  return <ScheduleEditorRoute />;
}
