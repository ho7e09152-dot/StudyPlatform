"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";
import { completeGitHubLogin, completeGitLabLogin } from "@/lib/api/services/authApi";
import { safeAppReturnUrl } from "@/lib/auth/redirects";

export function OAuthCallbackPage() {
  const started = useRef(false);
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") === "GITHUB" ? "GITHUB" : "GITLAB";

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const complete = provider === "GITHUB" ? completeGitHubLogin : completeGitLabLogin;
    void complete()
      .then(({ returnUrl }) => {
        window.location.replace(safeAppReturnUrl(returnUrl));
      })
      .catch(() => {
        window.location.replace(`/login?provider=${provider}&oauthError=oauth_failed`);
      });
  }, [provider]);

  return <AppLoadingScreen phase="auth" />;
}
