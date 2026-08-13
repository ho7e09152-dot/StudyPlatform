import type { Metadata } from "next";
import { LibrarySessionPage } from "@/components/library/LibrarySessionPage";

export const metadata: Metadata = { title: "학습 세션" };

export default async function LibrarySessionRoute({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <LibrarySessionPage date={date} />;
}
