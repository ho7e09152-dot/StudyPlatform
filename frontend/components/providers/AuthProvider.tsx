"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client/http";
import { getAuthSession, type AuthenticatedGitLabUser } from "@/lib/api/services/authApi";
import { AppLoadingScreen } from "@/components/ui/AppLoadingScreen";

interface AuthContextValue {
  mode: "gitlab-oauth" | "demo";
  user: AuthenticatedGitLabUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const demoMode = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">(
    demoMode ? "ready" : "loading",
  );
  const [user, setUser] = useState<AuthenticatedGitLabUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    void getAuthSession(controller.signal)
      .then((session) => {
        if (!session.authenticated || !session.user) {
          window.location.replace("/login?oauthError=session_expired");
          return;
        }
        setUser(session.user);
        setState("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          window.location.replace("/login?oauthError=session_expired");
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "로그인 상태를 확인하지 못했습니다.");
        setState("error");
      });
    return () => controller.abort();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ mode: demoMode ? "demo" : "gitlab-oauth", user }),
    [user],
  );

  if (state === "loading") {
    return <AppLoadingScreen phase="auth" />;
  }

  if (state === "error") {
    return (
      <main className="app-bootstrap app-bootstrap--error" role="alert">
        <strong>앱을 시작하지 못했습니다</strong>
        <span>{error}</span>
        <button type="button" className="button" onClick={() => window.location.reload()}>다시 시도</button>
      </main>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
