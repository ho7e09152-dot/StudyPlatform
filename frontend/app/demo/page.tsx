import type { Metadata } from "next";
import { DemoEntryPage } from "@/components/demo/DemoEntryPage";

export const metadata: Metadata = {
  title: "데모 Workspace",
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  return <DemoEntryPage />;
}
