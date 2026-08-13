import type { Metadata } from "next";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const metadata: Metadata = { title: "개인정보 처리 안내" };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requested = (await searchParams).returnTo;
  const returnTo = safeAppReturnUrl(requested, "/");
  return (
    <LegalDocumentPage
      title="개인정보 처리 안내"
      effectiveDate="2026년 8월 13일"
      returnTo={returnTo}
      sections={[
        { title: "운영자 및 개인정보 문의", paragraphs: ["운영자는 개인 개발자 이호철입니다. 개인정보 관련 문의와 열람·정정·삭제 등 권리 행사는 ho7e09152@gmail.com으로 요청할 수 있습니다."] },
        { title: "수집·저장하는 정보", paragraphs: ["GitLab 사용자 ID, 사용자명, 표시 이름, 프로필 이미지 URL, 연결한 프로젝트 정보, Workspace 역할, 동기화·감사 로그와 알림을 저장합니다. OAuth access/refresh token은 서버 DB에 AES-GCM으로 암호화해 저장합니다."] },
        { title: "이용 목적", paragraphs: ["정보는 로그인, GitLab API 요청, Workspace 접근 통제, 장애 복구와 보안 감사에만 사용합니다."] },
        { title: "보관 및 삭제", paragraphs: ["로그아웃하면 OAuth credential을 폐기합니다. 계정 탈퇴 시 계정·credential·알림·세션을 삭제하고 공동 기록의 작성자 정보는 탈퇴한 사용자로 익명화합니다. 알림은 90일, 동기화 오류 기록은 30일, 감사 기록은 180일 동안 보관하며, 삭제한 Workspace는 7일간 복원할 수 있습니다. 이 기간은 Study-ing의 운영 정책입니다."] },
        { title: "GitLab에 남는 정보", paragraphs: ["사용자가 커밋한 일정과 제출 파일 및 Git commit 이력은 GitLab 프로젝트에 남으며 Study-ing 계정 삭제로 제거되지 않습니다. 해당 정보는 GitLab 프로젝트 관리자가 관리합니다."] },
        { title: "인증 및 보안", paragraphs: ["브라우저에는 HttpOnly 세션 쿠키만 전달하고 OAuth token은 노출하지 않습니다. 전송 구간은 운영 환경에서 HTTPS를 사용합니다."] },
        { title: "이용 연령", paragraphs: ["Study-ing은 현재 만 14세 미만 사용자를 대상으로 서비스를 제공하지 않습니다."] },
        { title: "사용자 권리", paragraphs: ["프로필 수정과 Study-ing 계정 탈퇴는 서비스의 계정 관리 기능에서 할 수 있습니다."] },
      ]}
    />
  );
}
