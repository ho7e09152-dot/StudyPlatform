"use client";

import Image from "next/image";
import { useEffect } from "react";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { startDemoSession } from "@/lib/demo/session";

export function DemoEntryPage() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    startDemoSession();
    window.location.replace(safeAppReturnUrl(requested));
  }, []);

  return (
    <main className="auth-transition-page">
      <div className="auth-transition" role="status" aria-live="polite">
        <Image src="/study-ing-icon.png" alt="" width={898} height={898} unoptimized priority />
        <strong>Study-ing</strong>
        <span className="auth-transition__spinner" aria-hidden="true" />
        <div><h1>데모 Workspace를 준비하고 있어요.</h1><p>잠시만 기다려주세요.</p></div>
      </div>
    </main>
  );
}
