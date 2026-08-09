"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, FileText, Gitlab, LoaderCircle, UserRound } from "lucide-react";
import type { AuthenticatedGitLabUser } from "@/lib/api/services/authApi";

export function ProfileSetupPage({
  user,
  onSubmit,
}: {
  user: AuthenticatedGitLabUser;
  onSubmit: (input: {
    displayName: string;
    repositoryFileName: string;
    timezone: string;
    acceptTerms: boolean;
  }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.name || user.username);
  const [repositoryFileName, setRepositoryFileName] = useState(
    user.repositoryFileName?.replace(/\.md$/i, "") || user.name || user.username,
  );
  const [fileNameEdited, setFileNameEdited] = useState(Boolean(user.repositoryFileName));
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({ displayName, repositoryFileName, timezone, acceptTerms });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "프로필을 저장하지 못했습니다.");
      setSaving(false);
    }
  }

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-card" aria-labelledby="profile-setup-title">
        <div className="profile-setup-eyebrow"><Gitlab size={16} /> GitLab 계정 연결 완료</div>
        <header>
          <span><UserRound size={25} /></span>
          <div>
            <h1 id="profile-setup-title">서비스에서 사용할 이름을 알려주세요</h1>
            <p>한 번만 설정하면 Workspace와 GitLab 학습 기록에 동일하게 사용됩니다.</p>
          </div>
        </header>

        <form onSubmit={handleSubmit}>
          <label>
            표시 이름
            <input
              value={displayName}
              minLength={2}
              maxLength={40}
              autoComplete="name"
              onChange={(event) => {
                const next = event.target.value;
                setDisplayName(next);
                if (!fileNameEdited) setRepositoryFileName(next);
              }}
              placeholder="예: 김서연"
              required
            />
            <small>일정 작성자, 제출자와 Workspace 멤버 이름으로 표시됩니다.</small>
          </label>

          <label>
            GitLab 기록 이름
            <div className="profile-file-input">
              <FileText size={17} />
              <input
                value={repositoryFileName}
                maxLength={80}
                onChange={(event) => {
                  setFileNameEdited(true);
                  setRepositoryFileName(event.target.value);
                }}
                placeholder="예: 김서연"
                required
              />
              <span>.md</span>
            </div>
            <small>GitLab에는 아이디 대신 이 이름의 제출 파일이 생성됩니다.</small>
          </label>

          <div className="profile-setup-summary">
            <span><Check size={14} /> GitLab 로그인 아이디는 공개 파일명으로 사용하지 않음</span>
            <span><Check size={14} /> 감지된 시간대: {timezone}</span>
          </div>

          <label className="profile-terms">
            <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
            <span><Link href="/terms" target="_blank">이용약관</Link>과 <Link href="/privacy" target="_blank">개인정보 처리 안내</Link>를 확인하고 동의합니다.</span>
          </label>

          {error ? <div className="onboarding-error" role="alert">{error}</div> : null}

          <button className="button" type="submit" disabled={saving || !acceptTerms || displayName.trim().length < 2 || !repositoryFileName.trim()}>
            {saving ? <><LoaderCircle className="spin" size={17} /> 저장 중…</> : "프로필 저장하고 시작하기"}
          </button>
        </form>
      </section>
    </main>
  );
}
