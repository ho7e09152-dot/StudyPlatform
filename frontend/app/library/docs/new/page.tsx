import type { Metadata } from "next";
import { LibraryDocumentEditorPage } from "@/components/library/LibraryDocumentEditorPage";

export const metadata: Metadata = { title: "새 팀 문서" };

export default function NewLibraryDocumentRoute() {
  return <LibraryDocumentEditorPage />;
}
