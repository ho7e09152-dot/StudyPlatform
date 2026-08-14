"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Check, ChevronDown, FileText, LoaderCircle, UserRound } from "lucide-react";
import type { StudyIngUser } from "@/lib/api/services/authApi";
import { getUserFacingError } from "@/lib/api/errors";
import { ProviderIcon } from "@/components/providers/ProviderIcon";
import { getProviderDescriptor, type ProviderId } from "@/lib/providers/provider-descriptors";

export function ProfileSetupPage({
  user,
  identityProvider,
  onSubmit,
}: {
  user: StudyIngUser;
  identityProvider: ProviderId;
  onSubmit: (input: {
    displayName: string;
    repositoryFileName: string;
    timezone: string;
    acceptTerms: boolean;
    acceptPrivacy: boolean;
    confirmMinimumAge: boolean;
  }) => Promise<void>;
}) {
  const provider = getProviderDescriptor(identityProvider);
  const [displayName, setDisplayName] = useState(user.name || user.username);
  const [repositoryFileName, setRepositoryFileName] = useState(
    user.repositoryFileName?.replace(/\.md$/i, "") || user.name || user.username,
  );
  const [fileNameEdited, setFileNameEdited] = useState(Boolean(user.repositoryFileName));
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [confirmMinimumAge, setConfirmMinimumAge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [timezone, setTimezone] = useState(
    user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({ displayName, repositoryFileName, timezone, acceptTerms, acceptPrivacy, confirmMinimumAge });
    } catch (requestError) {
      setError(getUserFacingError(requestError, "프로필을 저장하지 못했습니다."));
      setSaving(false);
    }
  }

  return (
    <main className="profile-setup-page">
      <section className="profile-setup-card" aria-labelledby="profile-setup-title">
        <div className="profile-setup-eyebrow"><ProviderIcon provider={identityProvider} size={16} /> {provider.displayName} 계정 연결 완료</div>
        <header>
          <span><UserRound size={25} /></span>
          <div>
            <h1 id="profile-setup-title">Study-ing에서 사용할 이름을 알려주세요</h1>
            <p>한 번 설정하면 Workspace, 일정, 제출과 리뷰에서 사용됩니다.</p>
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
            <small>Workspace, 일정, 제출, 리뷰 등에서 표시됩니다.</small>
          </label>

          <details className="profile-advanced">
            <summary><span><ChevronDown size={16} /> 고급 설정</span><small>학습 기록 이름 · 시간대</small></summary>
            <div>
              <label>
                학습 기록 이름
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
                <small>학습 기록 파일 이름에 사용됩니다.</small>
              </label>
              <label>
                시간대
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
                <small>마감과 일정 시간을 표시할 때 사용됩니다.</small>
              </label>
            </div>
          </details>

          <div className="profile-setup-summary">
            <span><Check size={14} /> 연결 계정 아이디는 공개 파일명으로 사용하지 않음</span>
            <span><Check size={14} /> 사용할 시간대: {timezone}</span>
          </div>

          <fieldset className="profile-consents">
            <legend>이용 확인</legend>
            <label className="profile-terms">
              <input type="checkbox" checked={confirmMinimumAge} onChange={(event) => setConfirmMinimumAge(event.target.checked)} />
              <span>만 14세 이상입니다.</span>
            </label>
            <label className="profile-terms">
              <input type="checkbox" checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} />
              <span><Link href="/terms" target="_blank">이용약관</Link>을 확인하고 동의합니다.</span>
            </label>
            <label className="profile-terms">
              <input type="checkbox" checked={acceptPrivacy} onChange={(event) => setAcceptPrivacy(event.target.checked)} />
              <span><Link href="/privacy" target="_blank">개인정보 처리 안내</Link>를 확인하고 동의합니다.</span>
            </label>
          </fieldset>

          {error ? <div className="onboarding-error" role="alert">{error}</div> : null}

          <button className="button button--primary" type="submit" disabled={saving || !confirmMinimumAge || !acceptTerms || !acceptPrivacy || displayName.trim().length < 2 || !repositoryFileName.trim()}>
            {saving ? <><LoaderCircle className="spin" size={17} /> 저장 중…</> : "프로필 저장하고 계속하기"}
          </button>
        </form>
      </section>
    </main>
  );
}
