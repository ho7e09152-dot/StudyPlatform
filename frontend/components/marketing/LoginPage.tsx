"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpenCheck, FolderGit2, Gitlab, MessageSquareText, ShieldCheck } from "lucide-react";
import { AuthNotice } from "@/components/auth/AuthNotice";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { getAuthSession } from "@/lib/api/services/authApi";
import { getLoginNoticeState } from "@/lib/auth/loginState";
import { safeAppReturnUrl } from "@/lib/auth/redirects";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const demoMode = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export function LoginPage() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("oauthError");
  const returnUrl = safeAppReturnUrl(searchParams.get("returnUrl"));
  const gitLabLoginUrl = `${apiBaseUrl}/api/v1/auth/gitlab/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  const notice = getLoginNoticeState(oauthError);
  const currentLoginPath = `/login${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const policyReturnQuery = encodeURIComponent(currentLoginPath);

  useEffect(() => {
    if (demoMode) return;
    const controller = new AbortController();
    void getAuthSession(controller.signal)
      .then((session) => {
        if (!session.authenticated || !session.user) return;
        if (!session.user.profileCompleted) {
          window.location.replace(`/onboarding/profile?returnTo=${encodeURIComponent(returnUrl)}`);
          return;
        }
        window.location.replace(returnUrl);
      })
      .catch(() => {
        // The login entry remains usable when no authenticated session exists.
      });
    return () => controller.abort();
  }, [returnUrl]);

  return (
    <main className="auth-entry-page">
      <nav className="auth-entry-topbar" aria-label="로그인 보조 탐색">
        <Link href="/">
          <ArrowLeft size={16} aria-hidden="true" /> 홈
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
            <li><FolderGit2 size={18} aria-hidden="true" /><span>학습 기록은 GitLab에 안전하게 보관</span></li>
          </ul>
        </section>

        <section className="auth-entry-panel" aria-labelledby="login-title">
          <header className="auth-entry-panel__header">
            <span className="auth-entry-provider-mark" aria-hidden="true"><Gitlab size={22} /></span>
            <div>
              <h2 id="login-title">Study-ing 시작하기</h2>
              <p>GitLab 계정으로 안전하게 로그인합니다.</p>
            </div>
          </header>

          {notice ? <AuthNotice notice={notice} /> : null}

          <AuthProviderButton
            provider="GITLAB"
            href={gitLabLoginUrl}
          >
            {notice?.actionLabel ?? "GitLab로 계속하기"}
          </AuthProviderButton>

          {demoMode ? (
            <>
              <div className="auth-entry-divider"><span>또는</span></div>
              <Link className="auth-entry-demo" href="/today">
                <FolderGit2 size={18} aria-hidden="true" />
                <span>데모 Workspace 둘러보기</span>
              </Link>
            </>
          ) : null}

          <div className="auth-entry-security-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>안전한 OAuth 로그인</strong>
              <p>OAuth 토큰은 서버에서 암호화해 관리하고, 브라우저에는 HttpOnly 세션 쿠키만 사용합니다.</p>
            </div>
          </div>

          <footer className="auth-entry-footer">
            <Link href={`/terms?returnTo=${policyReturnQuery}`}>이용약관</Link>
            <span aria-hidden="true">·</span>
            <Link href={`/privacy?returnTo=${policyReturnQuery}`}>개인정보 처리 안내</Link>
            <p>개인 액세스 토큰을 직접 입력할 필요가 없습니다.</p>
          </footer>
        </section>
      </div>
    </main>
  );
}
