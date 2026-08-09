import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "개인정보 처리 안내" };

export default function PrivacyPage() {
  return (
    <main className="policy-page">
      <article>
        <p className="eyebrow">STUDY WORKSPACE</p>
        <h1>개인정보 처리 안내</h1>
        <p className="policy-updated">시행일: 2026년 8월 10일</p>
        <h2>수집·저장하는 정보</h2>
        <p>GitLab 사용자 ID, 사용자명, 표시 이름, 프로필 이미지 URL, 연결한 프로젝트 정보, Workspace 역할, 동기화·감사 로그와 알림을 저장합니다. OAuth access/refresh token은 서버 DB에 AES-GCM으로 암호화해 저장합니다.</p>
        <h2>이용 목적과 보관</h2>
        <p>정보는 로그인, GitLab API 요청, Workspace 접근 통제, 장애 복구와 보안 감사에만 사용합니다. 로그아웃하면 OAuth credential을 폐기하며, 계정 탈퇴 시 계정과 credential을 삭제하고 Workspace 멤버 정보는 익명화합니다.</p>
        <h2>GitLab에 남는 정보</h2>
        <p>사용자가 커밋한 일정과 제출 파일 및 Git commit 이력은 GitLab 프로젝트에 남으며 Study Workspace의 계정 삭제로 제거되지 않습니다. 해당 정보는 GitLab 프로젝트 관리자가 관리합니다.</p>
        <h2>보안</h2>
        <p>브라우저에는 HttpOnly 세션 쿠키만 전달하고 OAuth token은 노출하지 않습니다. 전송 구간은 운영 환경에서 HTTPS를 사용합니다.</p>
        <p className="policy-note">실제 공개 출시 전 운영 주체, 문의·삭제 요청 채널, 국외 이전 여부와 법정 보유기간을 확정하고 법률 검토해야 합니다.</p>
        <Link className="button" href="/login">로그인으로 돌아가기</Link>
      </article>
    </main>
  );
}

