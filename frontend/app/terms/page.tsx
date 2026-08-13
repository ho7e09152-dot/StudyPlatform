import type { Metadata } from "next";
import { safeAppReturnUrl } from "@/lib/auth/redirects";
import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const metadata: Metadata = { title: "이용약관" };

export default async function TermsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const requested = (await searchParams).returnTo;
  const returnTo = safeAppReturnUrl(requested, "/");
  return (
    <LegalDocumentPage
      title="이용약관"
      effectiveDate="2026년 8월 13일"
      returnTo={returnTo}
      sections={[
        { title: "운영자 및 문의", paragraphs: ["Study-ing은 개인 개발자 이호철이 운영합니다. 서비스 및 개인정보 관련 문의는 ho7e09152@gmail.com으로 접수할 수 있습니다."] },
        { title: "서비스의 역할", paragraphs: ["Study-ing은 사용자가 승인한 GitLab 프로젝트의 학습 일정과 제출 파일을 조회하고, 사용자의 GitLab 계정 권한으로 커밋을 생성하는 도구입니다."] },
        { title: "이용 대상", paragraphs: ["Study-ing은 현재 만 14세 이상 사용자를 대상으로 하며 만 14세 미만 사용자를 위한 법정대리인 동의 절차는 제공하지 않습니다."] },
        { title: "사용자의 책임", paragraphs: ["사용자는 연결한 프로젝트에 파일을 읽고 쓸 권한이 있어야 하며, Workspace의 일정과 제출 내용이 팀 규칙 및 관련 법령을 위반하지 않도록 관리해야 합니다."] },
        { title: "데이터와 삭제", paragraphs: ["일정과 제출 본문은 GitLab에 남습니다. Workspace 삭제는 서비스 DB에서 7일간 복원할 수 있으며, 만료 후 Workspace와 연결된 서비스 데이터가 정리되어도 감사 기록은 생성일부터 최대 180일, GitLab 파일과 commit은 GitLab 정책에 따라 남을 수 있습니다."] },
        { title: "서비스 변경 및 중단", paragraphs: ["GitLab 장애, 권한 변경 또는 유지보수로 일부 기능이 일시 중단될 수 있습니다. 중요한 변경은 서비스 화면에 알립니다."] },
      ]}
    />
  );
}
