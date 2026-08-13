"use client";

import { useEffect } from "react";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { safeAppReturnUrl } from "@/lib/auth/redirects";

export default function OnboardingProfileRoute() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    window.location.replace(safeAppReturnUrl(requested));
  }, []);

  return <AppLoadingScreen phase="workspace" />;
}
