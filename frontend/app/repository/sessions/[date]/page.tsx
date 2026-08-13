import { LegacyLibraryRedirect } from "@/components/library/LegacyLibraryRedirect";
import { APP_ROUTES } from "@/lib/routes";

export default async function LegacyRepositorySessionRoute({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <LegacyLibraryRedirect destination={APP_ROUTES.librarySession(date)} />;
}
