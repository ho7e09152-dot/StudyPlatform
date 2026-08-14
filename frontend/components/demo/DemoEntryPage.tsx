"use client";

import { useEffect } from "react";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { startDemoSession } from "@/lib/demo/session";

const DEMO_LOADING_DELAY_MS = 2_500;

export function DemoEntryPage() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    const destination = safeAppReturnUrl(requested);
    const timer = window.setTimeout(() => {
      startDemoSession();
      window.location.replace(destination);
    }, DEMO_LOADING_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return <AppLoadingScreen phase="demo" />;
}
