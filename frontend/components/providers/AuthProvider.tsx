"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client/http";
import { getAuthSession, updateAccountProfile, type StudyIngUser } from "@/lib/api/services/authApi";
import { ProfileSetupPage } from "@/components/auth/ProfileSetupPage";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { getUserFacingError } from "@/lib/api/errors";
import { isDemoSessionActive } from "@/lib/demo/session";

interface AuthContextValue {
  mode: "oauth" | "demo";
  identityProvider: "GITLAB" | "GITHUB";
  user: StudyIngUser | null;
  checking: boolean;
  setUser: (user: StudyIngUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthContextValue["mode"]>("oauth");
  const [identityProvider, setIdentityProvider] = useState<AuthContextValue["identityProvider"]>("GITLAB");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [user, setUser] = useState<StudyIngUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isDemoSessionActive()) {
      const timer = window.setTimeout(() => {
        setMode("demo");
        setState("ready");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    void getAuthSession(controller.signal)
      .then((session) => {
        if (!session.authenticated || !session.user) {
          window.location.replace("/login?oauthError=session_expired");
          return;
        }
        if (!session.user.profileCompleted && window.location.pathname !== "/onboarding/profile") {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/onboarding/profile?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        setIdentityProvider(session.identityProvider === "GITHUB" ? "GITHUB" : "GITLAB");
        setUser(session.user);
        setState("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          window.location.replace("/login?oauthError=session_expired");
          return;
        }
        setError(getUserFacingError(requestError, "로그인 상태를 확인하지 못했습니다."));
        setState("error");
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ mode, identityProvider, user, checking: state === "loading", setUser }),
    [identityProvider, mode, state, user],
  );

  if (state === "error") {
    return (
      <main className="app-bootstrap app-bootstrap--error" role="alert">
        <strong>앱을 시작하지 못했습니다</strong>
        <span>{error}</span>
        <button type="button" className="button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  }

  if (state === "loading") return null;

  if (mode !== "demo" && state === "ready" && user && !user.profileCompleted) {
    return <ProfileSetupPage user={user} identityProvider={identityProvider} onSubmit={async (input) => {
      setUser(await updateAccountProfile(input));
      const requested = new URLSearchParams(window.location.search).get("returnTo");
      window.location.replace(safeAppReturnUrl(requested));
    }} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
