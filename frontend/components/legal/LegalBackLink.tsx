"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function LegalBackLink({ fallback }: { fallback: string }) {
  return (
    <Link
      className="legal-back-link"
      href={fallback}
      onClick={(event) => {
        if (!document.referrer) return;
        try {
          if (new URL(document.referrer).origin !== window.location.origin) return;
          event.preventDefault();
          window.history.back();
        } catch {
          // Use the safe fallback route when the referrer is not a valid URL.
        }
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" /> 돌아가기
    </Link>
  );
}
