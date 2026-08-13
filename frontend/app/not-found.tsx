import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-page__content">
        <Link className="legal-brand" href="/" aria-label="Study-ing 홈">Study-ing</Link>
        <span>404</span>
        <h1>페이지를 찾을 수 없어요.</h1>
        <p>주소가 변경되었거나 존재하지 않는 페이지입니다.</p>
        <div>
          <Link className="button button--primary" href="/"><Home size={16} /> 홈으로</Link>
          <Link className="button button--secondary" href="/today"><ArrowLeft size={16} /> 오늘로 이동</Link>
        </div>
      </div>
    </main>
  );
}
