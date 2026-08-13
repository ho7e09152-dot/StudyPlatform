import type { Metadata } from "next";
import { LibraryDocumentPage } from "@/components/library/LibraryDocumentPage";

export const metadata: Metadata = { title: "팀 문서" };

export default async function LibraryDocumentRoute({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <LibraryDocumentPage documentId={documentId} />;
}
