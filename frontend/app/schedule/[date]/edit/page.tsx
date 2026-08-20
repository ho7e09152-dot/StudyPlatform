import type { Metadata } from "next";
import { ScheduleEditorRoute } from "@/components/schedule/ScheduleEditorRoute";

export const metadata: Metadata = { title: "학습 일정 편집" };

export default async function EditSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { date } = await params;
  const { step } = await searchParams;
  return <ScheduleEditorRoute date={date} initialStep={step === "items" ? 2 : 1} />;
}
