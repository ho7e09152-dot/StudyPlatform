import { LegacyLibraryRedirect } from "@/components/library/LegacyLibraryRedirect";
import { APP_ROUTES } from "@/lib/routes";

export default async function LegacyRepositoryDocumentEditRoute({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await params;
  return <LegacyLibraryRedirect destination={APP_ROUTES.libraryDocumentEdit(documentId)} />;
}
