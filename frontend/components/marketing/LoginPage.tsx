"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderGit2,
  GitBranch,
  Gitlab,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

const demoMode = process.env.NEXT_PUBLIC_APP_MODE === "demo";

export function LoginPage() {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("oauthError");
  const requestedReturnUrl = searchParams.get("returnUrl");
  const returnUrl =
    requestedReturnUrl?.startsWith("/") &&
    !requestedReturnUrl.startsWith("//") &&
    !requestedReturnUrl.includes("\\")
      ? requestedReturnUrl
      : "/today";
  const gitLabLoginUrl = `${apiBaseUrl}/api/v1/auth/gitlab/login?returnUrl=${encodeURIComponent(returnUrl)}`;

  return (
    <main className="login-page">
      <div className="login-background" aria-hidden="true">
        <span className="login-background__orb login-background__orb--one" />
        <span className="login-background__orb login-background__orb--two" />
        <span className="login-background__grid" />
      </div>

      <Link className="login-back" href="/">
        <ArrowLeft size={16} /> 홈으로
      </Link>

      <div className="login-layout">
        <section className="login-story">
          <Link className="marketing-brand marketing-brand--login" href="/">
            <Image
              src="/ssafy_icon.png"
              alt="SSAFY"
              width={684}
              height={354}
              unoptimized
            />
            <span>
              <strong>STUDY</strong>
              <small>GitLab learning hub</small>
            </span>
          </Link>

          <div className="login-story__copy">
            <div className="landing-pill landing-pill--dark">
              <Sparkles size={13} />
              기록은 GitLab에, 흐름은 Workspace에
            </div>
            <h1>
              다시 만나서 반가워요.
              <br />
              <span>오늘의 학습을 이어가세요.</span>
            </h1>
            <p>
              GitLab 계정 하나로 팀 Workspace와 저장소 권한을 안전하게
              연결합니다.
            </p>
          </div>

          <div className="login-flow-card">
            <div className="login-flow-card__head">
              <span><GitBranch size={16} /></span>
              <div>
                <small>CONNECTED WORKFLOW</small>
                <strong>로그인하면 이어지는 것들</strong>
              </div>
            </div>
            <ol>
              <li><span><Check size={12} /></span><div><b>내 Workspace 확인</b><small>접근 가능한 스터디 프로젝트를 불러옵니다.</small></div></li>
              <li><span><Check size={12} /></span><div><b>오늘 일정과 제출 복원</b><small>GitLab 원본을 기준으로 현재 상태를 보여줍니다.</small></div></li>
              <li><span><Check size={12} /></span><div><b>내 계정으로 commit</b><small>웹에서 작성해도 투명한 기록이 남습니다.</small></div></li>
            </ol>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-panel__badge"><LockKeyhole size={15} /> OAuth 보안 로그인</div>
          <header>
            <span className="login-panel__icon"><Gitlab size={28} /></span>
            <div>
              <h2 id="login-title">GitLab 계정으로 시작</h2>
              <p>별도의 비밀번호를 만들 필요가 없습니다.</p>
            </div>
          </header>

          {oauthError ? (
            <div className="login-oauth-error" role="alert">
              {oauthError === "session_expired"
                ? "로그인 세션이 만료되었습니다. GitLab로 다시 로그인해 주세요."
                : oauthError === "reconnect_required"
                  ? "GitLab 연결이 만료되거나 철회되었습니다. 권한을 다시 승인해 주세요."
                : "GitLab 로그인이 취소되었거나 승인되지 않았습니다. 다시 시도해 주세요."}
            </div>
          ) : null}

          <a
            className="gitlab-login-button"
            href={gitLabLoginUrl}
          >
            <Gitlab size={20} />
            GitLab로 계속하기
            <ArrowRight size={17} />
          </a>

          {demoMode ? (
            <>
              <div className="login-divider"><span>또는</span></div>
              <Link className="demo-login-button" href="/today">
                <span><FolderGit2 size={18} /></span>
                <div>
                  <strong>데모 Workspace 둘러보기</strong>
                  <small>로그인 없이 준비된 데이터로 기능 확인</small>
                </div>
                <ArrowRight size={17} />
              </Link>
            </>
          ) : null}

          <div className="login-security-note">
            <ShieldCheck size={19} />
            <div>
              <strong>토큰은 브라우저에 저장되지 않아요</strong>
              <p>인증 정보는 Spring 백엔드가 관리하고 브라우저에는 HttpOnly 세션 쿠키만 전달합니다.</p>
            </div>
          </div>

          <footer>
            계속하면 <Link href="/terms">이용약관</Link>과 <Link href="/privacy">개인정보 처리 안내</Link>에 동의하고,
            GitLab 계정의 기본 프로필과 접근 가능한 프로젝트를 읽도록 승인하게 됩니다.
          </footer>
        </section>
      </div>

      <div className="login-corner-note">
        <ShieldCheck size={14} />
        <span>Workspace에 연결된 프로젝트만 접근합니다.</span>
      </div>
    </main>
  );
}
