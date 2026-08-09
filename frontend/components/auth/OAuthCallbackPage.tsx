"use client";

import { useEffect, useRef } from "react";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { completeGitLabLogin } from "@/lib/api/services/authApi";

export function OAuthCallbackPage() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeGitLabLogin()
      .then(({ returnUrl }) => {
        const destination = returnUrl.startsWith("/") && !returnUrl.startsWith("//")
          ? returnUrl
          : "/today";
        window.location.replace(destination);
      })
      .catch(() => {
        window.location.replace("/login?oauthError=oauth_failed");
      });
  }, []);

  return <AppLoadingScreen phase="auth" />;
}
