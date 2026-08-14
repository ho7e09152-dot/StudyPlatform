"use client";

import { useEffect, useState } from "react";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { startDemoSession } from "@/lib/demo/session";

const DEMO_LOADING_DELAY_MS = 2_500;

export function DemoEntryPage() {
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    const destination = safeAppReturnUrl(requested);
    const timer = window.setTimeout(() => {
      if (!startDemoSession()) {
        setStorageUnavailable(true);
        return;
      }
      window.location.replace(destination);
    }, DEMO_LOADING_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  if (storageUnavailable) {
    return (
      <main className="oauth-checking-page oauth-checking-page--demo" role="alert">
        <section className="oauth-checking-surface">
          <div className="oauth-checking-copy">
            <strong>데모를 시작하지 못했어요.</strong>
            <p>브라우저의 세션 저장소를 허용한 뒤 다시 시도해주세요.</p>
          </div>
          <a className="button button--secondary" href="/login">로그인으로 돌아가기</a>
        </section>
      </main>
    );
  }

  return <AppLoadingScreen phase="demo" />;
}
