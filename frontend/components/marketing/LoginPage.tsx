"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpenCheck, FolderGit2, MessageSquareText } from "lucide-react";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { getAuthSession, getProviderCapabilities, getProviderLoginUrl } from "@/lib/api/services/authApi";
import { getLoginNoticeState } from "@/lib/auth/loginState";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { clearDemoSession, getDemoEntryUrl } from "@/lib/demo/session";
import { getProviderDescriptor, orderLoginProviders, type ProviderId } from "@/lib/providers/provider-descriptors";

export function LoginPage({ initialAuthProviders = ["GITLAB"] }: { initialAuthProviders?: ProviderId[] }) {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("oauthError");
  const returnUrl = safeAppReturnUrl(searchParams.get("returnUrl"));
  const requestedProvider: ProviderId = searchParams.get("provider") === "GITHUB" ? "GITHUB" : "GITLAB";
  const [authProviders, setAuthProviders] = useState<ProviderId[]>(initialAuthProviders);
  const notice = getLoginNoticeState(oauthError, requestedProvider);
  const currentLoginPath = `/login${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const policyReturnQuery = encodeURIComponent(currentLoginPath);

  useEffect(() => {
    clearDemoSession();
    const controller = new AbortController();
    void getAuthSession(controller.signal)
      .then((session) => {
        if (!session.authenticated || !session.user) return;
        if (!session.user.profileCompleted) return;
        window.location.replace(returnUrl);
      })
      .catch(() => {
        // The login entry remains usable when no authenticated session exists.
      });
    void getProviderCapabilities(controller.signal)
      .then((capabilities) => setAuthProviders(capabilities.authProviders))
      .catch(() => {
        // GitLab remains the safe baseline when capability discovery is unavailable.
      });
    return () => controller.abort();
  }, [returnUrl]);

  return (
    <main className="auth-entry-page">
      <nav className="auth-entry-topbar" aria-label="로그인 보조 탐색">
        <Link href="/">
          <ArrowLeft size={16} aria-hidden="true" /> 홈으로
        </Link>
      </nav>

      <div className="auth-entry-layout">
        <section className="auth-entry-context" aria-labelledby="auth-entry-context-title">
          <Link className="auth-entry-brand" href="/" aria-label="Study-ing 홈">
            <Image
              src="/study-ing-icon.png"
              alt=""
              width={898}
              height={898}
              unoptimized
            />
            <strong>Study-ing</strong>
          </Link>

          <div className="auth-entry-context__copy">
            <h1 id="auth-entry-context-title">함께 공부하고,<br />기록은 그대로 남기세요.</h1>
            <p>오늘의 학습부터 팀 제출과 리뷰까지, 한 흐름으로 이어갑니다.</p>
          </div>

          <ul className="auth-entry-values" aria-label="Study-ing에서 할 수 있는 일">
            <li><BookOpenCheck size={18} aria-hidden="true" /><span>오늘 할 학습을 한눈에 확인</span></li>
            <li><MessageSquareText size={18} aria-hidden="true" /><span>제출과 팀 리뷰를 한곳에서 진행</span></li>
            <li><FolderGit2 size={18} aria-hidden="true" /><span>학습 기록은 연결한 저장소에 안전하게 보관</span></li>
          </ul>
        </section>

        <section className="auth-entry-panel" aria-labelledby="login-title">
          <header className="auth-entry-panel__header">
            <h2 id="login-title">Study-ing 시작하기</h2>
            <p>계정을 선택해 Study-ing을 시작하세요.</p>
          </header>

          {notice ? <AuthNotice notice={notice} /> : null}

          <div className="auth-provider-list" aria-label="로그인 Provider 선택">
            {orderLoginProviders(authProviders).map((provider) => {
              const descriptor = getProviderDescriptor(provider);
              return (
                <AuthProviderButton key={provider} provider={provider} href={getProviderLoginUrl(provider, returnUrl)}>
                  {descriptor.authLabel}
                </AuthProviderButton>
              );
            })}
          </div>

          <div className="auth-entry-divider"><span>또는</span></div>
          <Link className="auth-entry-demo" href={getDemoEntryUrl(returnUrl)}>
            <FolderGit2 size={18} aria-hidden="true" />
            <span>데모 Workspace 둘러보기</span>
          </Link>

          <footer className="auth-entry-footer">
            <Link href={`/terms?returnTo=${policyReturnQuery}`}>이용약관</Link>
            <span aria-hidden="true">·</span>
            <Link href={`/privacy?returnTo=${policyReturnQuery}`}>개인정보 처리 안내</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
