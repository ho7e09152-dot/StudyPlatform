import type { Metadata } from "next";
import { ScheduleDetailPage } from "@/components/schedule/ScheduleDetailPage";

export const metadata: Metadata = { title: "학습 일정 상세" };

export default async function ScheduleDetailRoute({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <ScheduleDetailPage date={date} />;
}
