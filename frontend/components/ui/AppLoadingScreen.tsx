import Image from "next/image";
import { Check, Gitlab, LoaderCircle, ShieldCheck } from "lucide-react";

export function AppLoadingScreen({ phase }: { phase: "auth" | "workspace" }) {
  const workspacePhase = phase === "workspace";

  return (
    <main className="auth-transition" role="status" aria-live="polite">
      <div className="auth-transition__background" aria-hidden="true">
        <span className="auth-transition__orb auth-transition__orb--one" />
        <span className="auth-transition__orb auth-transition__orb--two" />
        <span className="auth-transition__grid" />
      </div>

      <section className="auth-transition__card">
        <div className="auth-transition__brand">
          <Image
            src="/ssafy_icon.png"
            alt=""
            width={684}
            height={354}
            unoptimized
            priority
          />
          <span>
            <strong>STUDY</strong>
            <small>GitLab learning hub</small>
          </span>
        </div>

        <div className="auth-transition__loader" aria-hidden="true">
          <span className="auth-transition__ring auth-transition__ring--outer" />
          <span className="auth-transition__ring auth-transition__ring--inner" />
          <span className="auth-transition__gitlab"><Gitlab size={27} /></span>
          <LoaderCircle className="auth-transition__spinner" size={84} />
        </div>

        <div className="auth-transition__copy">
          <span className="auth-transition__eyebrow">
            <ShieldCheck size={13} /> SECURE OAUTH CONNECTION
          </span>
          <h1>{workspacePhase ? "Workspace를 준비하고 있어요" : "GitLab 로그인을 확인하고 있어요"}</h1>
          <p>
            {workspacePhase
              ? "연결된 프로젝트와 멤버십, 오늘의 학습 기록을 불러오는 중입니다."
              : "승인된 계정과 안전한 로그인 세션을 확인하는 중입니다."}
          </p>
        </div>

        <div className="auth-transition__progress" aria-hidden="true">
          <span />
        </div>

        <ol className="auth-transition__steps" aria-label="로그인 진행 상태">
          <li className={workspacePhase ? "complete" : "active"}>
            <span>{workspacePhase ? <Check size={12} /> : 1}</span>
            GitLab 인증
          </li>
          <li className={workspacePhase ? "complete" : undefined}>
            <span>{workspacePhase ? <Check size={12} /> : 2}</span>
            세션 확인
          </li>
          <li className={workspacePhase ? "active" : undefined}>
            <span>3</span>
            Workspace 준비
          </li>
        </ol>

        <small className="auth-transition__note">잠시만 기다려 주세요. 페이지를 새로고침하지 않아도 됩니다.</small>
      </section>
    </main>
  );
}
