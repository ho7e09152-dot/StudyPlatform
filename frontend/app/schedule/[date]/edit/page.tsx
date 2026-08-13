import type { Metadata } from "next";
import { ScheduleEditorRoute } from "@/components/schedule/ScheduleEditorRoute";

export const metadata: Metadata = { title: "학습 일정 편집" };

export default async function EditSchedulePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <ScheduleEditorRoute date={date} />;
}
