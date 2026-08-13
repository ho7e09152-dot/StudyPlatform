import type { Metadata } from "next";
import { LibraryDocumentEditorPage } from "@/components/library/LibraryDocumentEditorPage";

export const metadata: Metadata = { title: "팀 문서 편집" };

export default async function EditLibraryDocumentRoute({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <LibraryDocumentEditorPage documentId={documentId} />;
}
