import { LibraryWorkspace } from "@/components/library/LibraryWorkspace";

/** @deprecated 사용자-facing Library는 /library와 LibraryWorkspace를 사용합니다. */
export function RepositoryWorkspace() {
  return <LibraryWorkspace />;
}
