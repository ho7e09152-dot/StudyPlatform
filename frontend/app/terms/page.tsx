import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <main className="policy-page">
      <article>
        <p className="eyebrow">STUDY WORKSPACE</p>
        <h1>이용약관</h1>
        <p className="policy-updated">시행일: 2026년 8월 10일</p>
        <h2>서비스의 역할</h2>
        <p>Study Workspace는 사용자가 승인한 GitLab 프로젝트의 학습 일정과 제출 파일을 조회하고, 사용자의 GitLab 계정 권한으로 커밋을 생성하는 도구입니다.</p>
        <h2>사용자의 책임</h2>
        <p>사용자는 연결한 프로젝트에 파일을 읽고 쓸 권한이 있어야 하며, Workspace의 일정과 제출 내용이 팀 규칙 및 관련 법령을 위반하지 않도록 관리해야 합니다.</p>
        <h2>데이터와 삭제</h2>
        <p>일정과 제출 본문은 GitLab에 남습니다. Workspace 삭제는 서비스 DB에서 7일간 복원할 수 있으며, 만료 후 서비스 DB에서 제거되어도 GitLab 파일은 자동 삭제되지 않습니다.</p>
        <h2>변경 및 중단</h2>
        <p>GitLab 장애, 권한 변경 또는 유지보수로 일부 기능이 일시 중단될 수 있습니다. 중요한 변경은 서비스 화면에 알립니다.</p>
        <p className="policy-note">실제 공개 출시 전 운영 주체, 연락처, 준거법과 책임 제한 조항에 대한 법률 검토가 필요합니다.</p>
        <Link className="button" href="/login">로그인으로 돌아가기</Link>
      </article>
    </main>
  );
}

