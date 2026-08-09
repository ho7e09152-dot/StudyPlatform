"use client";

import { useState } from "react";
import { Check, Palette, UserRound } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAppTheme } from "@/components/providers/AppThemeProvider";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Modal } from "@/components/ui/Modal";
import {
  updateAccountProfile,
  type AccentColor,
} from "@/lib/api/services/authApi";

const accentOptions: Array<{ value: AccentColor; label: string }> = [
  { value: "PURPLE", label: "퍼플" },
  { value: "BLUE", label: "블루" },
  { value: "TEAL", label: "틸" },
  { value: "ORANGE", label: "오렌지" },
  { value: "ROSE", label: "로즈" },
];

export function ProfileSettingsDialog({ onClose }: { onClose: () => void }) {
  const { mode, user, setUser } = useAuth();
  const { accentColor, setAccentColor, saving: themeSaving } = useAppTheme();
  const { workspace, currentUserId, syncMembers } = useWorkspace();
  const member = workspace.members.find((candidate) => candidate.id === currentUserId)!;
  const [displayName, setDisplayName] = useState(user?.name ?? member.displayName);
  const [repositoryFileName, setRepositoryFileName] = useState(
    (user?.repositoryFileName ?? member.fileName).replace(/\.md$/i, ""),
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? workspace.settings.timezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "demo") {
      setError("데모 모드에서는 프로필 정보를 변경할 수 없습니다.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateAccountProfile({
        displayName,
        repositoryFileName,
        timezone,
        acceptTerms: true,
      });
      setUser(updated);
      await syncMembers();
      onClose();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "프로필을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="프로필 설정"
      description="서비스에서 보이는 이름과 개인 화면 테마를 관리합니다."
      onClose={onClose}
    >
      <form className="profile-settings-form" onSubmit={submit}>
        <section className="profile-settings-section" aria-labelledby="profile-info-title">
          <div className="profile-settings-section__heading">
            <span><UserRound size={17} /></span>
            <div><h3 id="profile-info-title">기본 정보</h3><p>GitLab 아이디와 별개로 서비스에 표시됩니다.</p></div>
          </div>
          <div className="profile-settings-fields">
            <label>
              <span>이름</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={40} required />
            </label>
            <label>
              <span>GitLab 기록 이름</span>
              <div className="profile-settings-file-input">
                <input value={repositoryFileName} onChange={(event) => setRepositoryFileName(event.target.value)} maxLength={80} required />
                <span>.md</span>
              </div>
              <small>새 제출 파일에 사용할 이름입니다. 기존 제출 파일이 있으면 경로는 유지됩니다.</small>
            </label>
            <label>
              <span>시간대</span>
              <input value={timezone} onChange={(event) => setTimezone(event.target.value)} required />
            </label>
          </div>
        </section>

        <section className="profile-settings-section" aria-labelledby="accent-title">
          <div className="profile-settings-section__heading">
            <span><Palette size={17} /></span>
            <div><h3 id="accent-title">강조 색상</h3><p>버튼, 선택 상태와 주요 안내에 적용됩니다.</p></div>
          </div>
          <div className="accent-options" role="radiogroup" aria-label="강조 색상">
            {accentOptions.map((option) => (
              <button
                key={option.value}
                className="accent-option"
                data-accent-option={option.value.toLowerCase()}
                type="button"
                role="radio"
                aria-checked={accentColor === option.value}
                disabled={themeSaving}
                onClick={() => {
                  setError("");
                  void setAccentColor(option.value).catch((requestError) => {
                    setError(requestError instanceof Error ? requestError.message : "색상 설정을 저장하지 못했습니다.");
                  });
                }}
              >
                <i>{accentColor === option.value ? <Check size={14} /> : null}</i>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="profile-settings-error" role="alert">{error}</p> : null}
        <footer className="profile-settings-actions">
          <button className="button button--ghost" type="button" onClick={onClose}>취소</button>
          <button className="button button--primary" type="submit" disabled={saving || displayName.trim().length < 2 || !repositoryFileName.trim()}>
            {saving ? "저장 중…" : "프로필 저장"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
