import { LibraryDocumentList } from "@/components/library/LibraryDocumentList";

/** @deprecated 문서 목록은 LibraryDocumentList와 /library/docs route를 사용합니다. */
export function TeamDocumentLibrary() {
  return <LibraryDocumentList />;
}
