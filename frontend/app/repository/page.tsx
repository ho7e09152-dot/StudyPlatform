import { LegacyLibraryRedirect } from "@/components/library/LegacyLibraryRedirect";
import { APP_ROUTES } from "@/lib/routes";

export default async function RepositoryPage({ searchParams }: { searchParams: Promise<{ document?: string }> }) {
  const { document } = await searchParams;
  return <LegacyLibraryRedirect destination={document ? APP_ROUTES.libraryDocument(document) : APP_ROUTES.learningLibrary} />;
}
