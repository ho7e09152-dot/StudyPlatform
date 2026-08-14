import Image from "next/image";
import { LoaderCircle } from "lucide-react";

export function AppLoadingScreen({ phase }: { phase: "auth" | "workspace" | "demo" }) {
  const workspacePhase = phase === "workspace";
  const demoPhase = phase === "demo";
  const statusMessage = phase === "demo"
    ? "데모 페이지를 준비하고 있어요"
    : workspacePhase
      ? "Workspace로 이동하고 있어요"
      : "로그인하고 있어요";

  return (
    <main
      className={`oauth-checking-page${demoPhase ? " oauth-checking-page--demo" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <section className="oauth-checking-surface">
        <div className="oauth-checking-brand">
          <Image
            src="/study-ing-icon.png"
            alt=""
            width={898}
            height={898}
            unoptimized
            priority
          />
          <h1>Study-ing</h1>
        </div>

        <LoaderCircle className="oauth-checking-spinner" size={22} aria-hidden="true" />

        <div className="oauth-checking-copy">
          <strong>{statusMessage}</strong>
          <p>잠시만 기다려주세요.</p>
        </div>
      </section>
    </main>
  );
}
