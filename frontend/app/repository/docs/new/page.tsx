import { LegacyLibraryRedirect } from "@/components/library/LegacyLibraryRedirect";
import { APP_ROUTES } from "@/lib/routes";

export default function LegacyRepositoryNewDocumentRoute() {
  return <LegacyLibraryRedirect destination={APP_ROUTES.libraryDocumentNew} />;
}
