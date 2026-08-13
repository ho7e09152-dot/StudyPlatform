import type { Metadata } from "next";
import { LibraryWorkspace } from "@/components/library/LibraryWorkspace";

export const metadata: Metadata = { title: "학습 라이브러리" };

export default function LibraryPage() {
  return <LibraryWorkspace />;
}
